import * as vscode from 'vscode';
import { WorkspaceEventBus } from './eventBus';
import { WorkspaceGraph } from './graph';
import { SymbolCache } from './cache';
import { calculateHealthMetrics } from './statistics';
import { AntiPatternEngine, AntiPattern } from './antiPatternEngine';
import { SuppressionEngine } from './suppressions';
import { RuleDiagnostic, RuleId, antiPatternRegistry } from './rules';
import { logger } from './logger';

export class AntiPatternDiagnosticsManager {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private engine: AntiPatternEngine;
    private suppressionEngine: SuppressionEngine;
    private timeout: NodeJS.Timeout | undefined;

    constructor(
        private graph: WorkspaceGraph,
        private symbolCache: SymbolCache,
        private eventBus: WorkspaceEventBus
    ) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('gherkin-antipatterns');
        this.engine = new AntiPatternEngine();

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;
        this.suppressionEngine = new SuppressionEngine(workspaceRoot);

        this.eventBus.onEvent(event => {
            if (
                event.type === 'featureFileChanged' ||
                event.type === 'stepFileChanged' ||
                event.type === 'stepDefinitionsUpdated' ||
                event.type === 'configurationChanged' ||
                event.type === 'textDocumentOpened' // To show diagnostics when opening a file
            ) {
                const immediate = (event.type === 'textDocumentOpened' || event.type === 'configurationChanged');
                this.triggerAnalysis(immediate);
            }
        });
    }

    private triggerAnalysis(immediate: boolean = false) {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        if (immediate) {
            this.suppressionEngine.reload();
            this.runAnalysis();
        } else {
            // Debounce the analysis by 500ms to avoid locking up on every keystroke/save
            this.timeout = setTimeout(() => {
                this.runAnalysis();
            }, 500);
        }
    }

    private async runAnalysis() {
        try {
            const config = vscode.workspace.getConfiguration('gherkinPowerTools');
            const antiPatternsConfig = vscode.workspace.getConfiguration('gherkinPowerTools.antiPatterns');
            if (!antiPatternsConfig.get<boolean>('enabled', true)) {
                this.diagnosticCollection.clear();
                return;
            }

            let ruleConfig = config.get<Record<string, any>>('rules', {});
            // Fallback for deprecated config
            if (!ruleConfig || Object.keys(ruleConfig).length === 0) {
                ruleConfig = antiPatternsConfig.get<Record<string, any>>('rules', {});
            }
            const metrics = await calculateHealthMetrics(this.graph, this.symbolCache);
            const profile = config.get<string>('profile', 'default');
            let antiPatterns = this.engine.generateAntiPatterns(this.graph, metrics, { profile: profile as any, rules: ruleConfig });

            // Filter out patterns that are already handled in real-time by the Linter
            // to prevent double-squiggles in the editor.
            antiPatterns = antiPatterns.filter(ap =>
                ap.title !== 'Undefined Steps' &&
                ap.title !== 'Ambiguous Steps in Feature Files' &&
                ap.title !== 'Syntax Error'
            );

            this.updateDiagnostics(antiPatterns);
        } catch (error) {
            logger.error(`Error running anti-pattern analysis: ${error}`);
        }
    }

    private updateDiagnostics(antiPatterns: AntiPattern[]) {
        this.diagnosticCollection.clear();
        antiPatternRegistry.clear();

        const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

        for (const pattern of antiPatterns) {
            const vscodeSeverity = this.mapSeverity(pattern.severity);
            if (vscodeSeverity === undefined) continue;

            // Handle specific affected items
            if (pattern.affectedItems && pattern.affectedItems.length > 0) {
                // Pre-load dynamic suppression engines for all affected URIs
                const dynamicEngines = new Map<string, SuppressionEngine>();
                const getEngine = (uriString: string) => {
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(uriString));
                    const root = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
                    if (!root) return this.suppressionEngine; // Fallback
                    if (!dynamicEngines.has(root)) {
                        dynamicEngines.set(root, new SuppressionEngine(root));
                    }
                    return dynamicEngines.get(root)!;
                };

                for (const item of pattern.affectedItems) {
                    if (item.uri) {
                        const uriString = item.uri;
                        if (!diagnosticsMap.has(uriString)) {
                            diagnosticsMap.set(uriString, []);
                        }
                        
                        const engine = getEngine(uriString);
                        // Check if this specific item is suppressed
                        if (engine.isSuppressed(pattern.id, uriString, item.scopeType, item.scopeValue)) {
                            continue;
                        }

                        // item.lines from antiPatternEngine are 1-indexed
                        const line = item.line !== undefined && item.line > 0 ? item.line - 1 : 0;

                        const range = new vscode.Range(line, 0, line, 200); // Highlight the whole line roughly

                        const categoryIcon = pattern.category === 'Style' ? '🎨' : (pattern.category === 'Correctness' ? '🛑' : '📊');
                        const inlineMessage = item.description || pattern.explanation;
                        
                        const message = `\u00A0\n${categoryIcon} ${pattern.title} (${pattern.category})\n\n${inlineMessage}\n\n📖 Rationale:\n${pattern.rationale}\n\n💡 Fix:\n${pattern.suggestedFix}\n\u00A0`;

                        const diag = new RuleDiagnostic(
                            range, 
                            message, 
                            vscodeSeverity, 
                            pattern.id as RuleId, 
                            0, 
                            { scopeType: item.scopeType, scopeValue: item.scopeValue }
                        );
                        
                        if (item.subItems && item.subItems.length > 0) {
                            diag.relatedInformation = item.subItems.map(s => {
                                const uri = s.uri ? vscode.Uri.parse(s.uri) : vscode.Uri.parse(uriString);
                                const l = s.line !== undefined && s.line > 0 ? s.line - 1 : 0;
                                return new vscode.DiagnosticRelatedInformation(
                                    new vscode.Location(uri, new vscode.Position(l, 0)),
                                    s.label
                                );
                            });
                        }
                        
                        diag.source = 'Gherkin PowerTools';

                        diagnosticsMap.get(uriString)!.push(diag);
                    }
                }
            } else if (pattern.affectedFiles && pattern.affectedFiles.length > 0) {
                // Pre-load dynamic suppression engines for all affected URIs
                const dynamicEngines = new Map<string, SuppressionEngine>();
                const getEngine = (uriString: string) => {
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(uriString));
                    const root = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
                    if (!root) return this.suppressionEngine; // Fallback
                    if (!dynamicEngines.has(root)) {
                        dynamicEngines.set(root, new SuppressionEngine(root));
                    }
                    return dynamicEngines.get(root)!;
                };

                // Fallback to affected files (highlighting the top of the file)
                for (const fileUri of pattern.affectedFiles) {
                    if (!diagnosticsMap.has(fileUri)) {
                        diagnosticsMap.set(fileUri, []);
                    }
                    const engine = getEngine(fileUri);
                    if (engine.isSuppressed(pattern.id, fileUri)) {
                        continue;
                    }

                    const range = new vscode.Range(0, 0, 0, 100);

                    const categoryIcon = pattern.category === 'Style' ? '🎨' : (pattern.category === 'Correctness' ? '🛑' : '📊');
                    const message = `\u00A0\n${categoryIcon} ${pattern.title} (${pattern.category})\n\n${pattern.explanation}\n\n📖 Rationale:\n${pattern.rationale}\n\n💡 Fix:\n${pattern.suggestedFix}\n\u00A0`;

                    const diag = new RuleDiagnostic(
                        range, 
                        message, 
                        vscodeSeverity, 
                        pattern.id as RuleId, 
                        0, 
                        undefined
                    );
                    diag.source = 'Gherkin PowerTools';

                    diagnosticsMap.get(fileUri)!.push(diag);
                }
            } else {
                // Project-wide issue (e.g. test suite bloat), maybe attach to active editor or don't show as inline diagnostic
                // Alternatively, could attach it to workspace config file
            }
        }

        // Apply to collection
        for (const [uriString, diagnostics] of diagnosticsMap.entries()) {
            this.diagnosticCollection.set(vscode.Uri.parse(uriString), diagnostics);
            antiPatternRegistry.set(uriString, diagnostics as RuleDiagnostic[]);
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
