import * as vscode from 'vscode';
import { WorkspaceEventBus } from './eventBus';
import { WorkspaceGraph } from './graph';
import { SymbolCache } from './cache';
import { calculateHealthMetrics } from './statistics';
import { AntiPatternEngine, AntiPattern } from './antiPatternEngine';
import { logger } from './logger';

export class AntiPatternDiagnosticsManager {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private engine: AntiPatternEngine;
    private timeout: NodeJS.Timeout | undefined;

    constructor(
        private graph: WorkspaceGraph,
        private symbolCache: SymbolCache,
        private eventBus: WorkspaceEventBus
    ) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('gherkin-antipatterns');
        this.engine = new AntiPatternEngine();

        this.eventBus.onEvent(event => {
            if (
                event.type === 'featureFileChanged' ||
                event.type === 'stepFileChanged' ||
                event.type === 'stepDefinitionsUpdated' ||
                event.type === 'configurationChanged' ||
                event.type === 'textDocumentOpened' // To show diagnostics when opening a file
            ) {
                this.triggerAnalysis();
            }
        });
    }

    private triggerAnalysis() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        // Debounce the analysis by 1.5 seconds to avoid locking up on every keystroke/save
        this.timeout = setTimeout(() => {
            this.runAnalysis();
        }, 1500);
    }

    private async runAnalysis() {
        try {
            const config = vscode.workspace.getConfiguration('gherkinPowerTools.antiPatterns');
            if (!config.get<boolean>('enabled', true)) {
                this.diagnosticCollection.clear();
                return;
            }

            const ruleConfig = config.get<Record<string, string>>('rules', {});
            const metrics = await calculateHealthMetrics(this.graph, this.symbolCache);
            let antiPatterns = this.engine.generateAntiPatterns(this.graph, metrics, ruleConfig);
            
            // Filter out patterns that are already handled in real-time by the Linter 
            // to prevent double-squiggles in the editor.
            antiPatterns = antiPatterns.filter(ap => 
                ap.title !== 'Undefined Steps' && 
                ap.title !== 'Ambiguous Steps in Feature Files'
            );
            
            this.updateDiagnostics(antiPatterns);
        } catch (error) {
            logger.error(`Error running anti-pattern analysis: ${error}`);
        }
    }

    private updateDiagnostics(antiPatterns: AntiPattern[]) {
        this.diagnosticCollection.clear();

        const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

        for (const pattern of antiPatterns) {
            const vscodeSeverity = this.mapSeverity(pattern.severity);
            if (vscodeSeverity === undefined) continue;

            // Handle specific affected items
            if (pattern.affectedItems && pattern.affectedItems.length > 0) {
                for (const item of pattern.affectedItems) {
                    const uriString = item.uri;
                    if (!diagnosticsMap.has(uriString)) {
                        diagnosticsMap.set(uriString, []);
                    }
                    
                    // All item.lines from antiPatternEngine are now 1-indexed
                    const line = item.line !== undefined && item.line > 0 ? item.line - 1 : 0;
                    
                    const range = new vscode.Range(line, 0, line, 200); // Highlight the whole line roughly
                    
                    const diag = new vscode.Diagnostic(range, `${pattern.title}: ${pattern.explanation}\n\nSuggested Fix: ${pattern.suggestedFix}`, vscodeSeverity);
                    diag.source = 'Gherkin PowerTools';
                    diag.code = pattern.title;
                    
                    diagnosticsMap.get(uriString)!.push(diag);
                }
            } else if (pattern.affectedFiles && pattern.affectedFiles.length > 0) {
                // Fallback to affected files (highlighting the top of the file)
                for (const fileUri of pattern.affectedFiles) {
                    if (!diagnosticsMap.has(fileUri)) {
                        diagnosticsMap.set(fileUri, []);
                    }
                    const range = new vscode.Range(0, 0, 0, 100);
                    const diag = new vscode.Diagnostic(range, `${pattern.title}: ${pattern.explanation}\n\nSuggested Fix: ${pattern.suggestedFix}`, vscodeSeverity);
                    diag.source = 'Gherkin PowerTools';
                    diag.code = pattern.title;

                    diagnosticsMap.get(fileUri)!.push(diag);
                }
            } else {
                // Project-wide issue (e.g. poor maintainability score), maybe attach to active editor or don't show as inline diagnostic
                // Alternatively, could attach it to workspace config file
            }
        }

        // Apply to collection
        for (const [uriString, diagnostics] of diagnosticsMap.entries()) {
            this.diagnosticCollection.set(vscode.Uri.parse(uriString), diagnostics);
        }
    }

    private mapSeverity(severity: string): vscode.DiagnosticSeverity | undefined {
        switch (severity) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            case 'hint': return vscode.DiagnosticSeverity.Hint;
            case 'off': return undefined;
            default: return vscode.DiagnosticSeverity.Warning;
        }
    }

    public dispose() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.diagnosticCollection.dispose();
    }
}
