import * as vscode from 'vscode';
import { WorkspaceGraph } from './graph';
import { ImpactAnalyzer } from './impactAnalysis';
import { parsePythonDecorators } from './tokenizer';

export class ImpactCodeLensProvider implements vscode.CodeLensProvider {
    private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

    private analyzer: ImpactAnalyzer;

    constructor(
        private graph: WorkspaceGraph
    ) {
        this.analyzer = new ImpactAnalyzer(graph);
    }

    public refresh() {
        this.onDidChangeCodeLensesEmitter.fire();
    }

    public provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        // By default, impact analysis is enabled unless configured otherwise
        const enabled = vscode.workspace.getConfiguration('gherkinPowerTools').get<boolean>('impactAnalysis.enabled', true);
        if (enabled === false) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];
        const uriStr = document.uri.toString();

        const allDefs = this.graph.getAllStepDefNodes().filter(d => d.uri === uriStr);
        if (allDefs.length === 0) return [];

        const decorators = parsePythonDecorators(document.getText());
        const matchedDefs = new Set<string>();

        for (const dec of decorators) {
            const def = allDefs.find(d => d.pattern === dec.argumentText && !matchedDefs.has(d.id));
            if (!def) continue;

            matchedDefs.add(def.id);
            const report = this.analyzer.calculateImpact(def.id);
            
            let title = `Impact: ${report.severity}`;
            if (report.affectedScenarios > 0) {
                title += ` (${report.affectedScenarios} Scenario${report.affectedScenarios > 1 ? 's' : ''})`;
            } else {
                title += ` (Unused)`;
            }

            const range = new vscode.Range(dec.startLine, 0, dec.startLine, 0);
            const lens = new vscode.CodeLens(range, {
                title,
                command: 'gherkin-powertools.showImpactDetails',
                arguments: [report]
            });
            lenses.push(lens);
        }

        return lenses;
    }
}
