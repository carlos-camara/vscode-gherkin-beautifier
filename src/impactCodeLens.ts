import * as vscode from 'vscode';
import { WorkspaceGraph } from './graph';
import { ImpactAnalyzer } from './impactAnalysis';
import { parsePythonDecorators } from './tokenizer';

class ImpactCodeLens extends vscode.CodeLens {
    constructor(
        range: vscode.Range,
        public readonly defId: string
    ) {
        super(range);
    }
}

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
        token: vscode.CancellationToken
    ): vscode.CodeLens[] {
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
            if (token.isCancellationRequested) {
                return lenses;
            }

            const def = allDefs.find(d => d.pattern === dec.argumentText && !matchedDefs.has(d.id));
            if (!def) continue;

            matchedDefs.add(def.id);
            const range = new vscode.Range(dec.startLine, 0, dec.startLine, 0);
            lenses.push(new ImpactCodeLens(range, def.id));
        }

        return lenses;
    }

    public resolveCodeLens(
        lens: vscode.CodeLens,
        token: vscode.CancellationToken
    ): vscode.CodeLens | null {
        if (token.isCancellationRequested) return null;
        if (!(lens instanceof ImpactCodeLens)) return lens;

        const report = this.analyzer.calculateImpact(lens.defId);
        
        let title = '';
        if (report.affectedScenarios > 0) {
            title = `Impact: ${report.severity} (${report.affectedScenarios} Scenario${report.affectedScenarios > 1 ? 's' : ''})`;
        } else {
            title = `Impact: Unused`;
        }

        lens.command = {
            title,
            command: 'gherkin-powertools.showImpactDetails',
            arguments: [report]
        };

        return lens;
    }
}
