import * as vscode from 'vscode';
import { WorkspaceGraph } from './graph';

export class ContextualFeatureDiscoveryService implements vscode.Disposable {
    private context: vscode.ExtensionContext;
    private graph: WorkspaceGraph;
    
    // Lifecycle management
    private disposables: vscode.Disposable[] = [];
    private disposeCts = new vscode.CancellationTokenSource();
    
    // In-memory set to prevent spamming within the same session if they don't click "Don't show again"
    private sessionDismissed = new Set<string>();

    constructor(context: vscode.ExtensionContext, graph: WorkspaceGraph) {
        this.context = context;
        this.graph = graph;

        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(this.onDidSaveTextDocument.bind(this)),
            vscode.window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor.bind(this))
        );
    }

    public dispose() {
        this.disposeCts.cancel();
        this.disposeCts.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    public async reset() {
        this.sessionDismissed.clear();
        const ruleIds = ['formatterRule', 'generateStepRule', 'dashboardRule', 'commandCenterRule'];
        for (const ruleId of ruleIds) {
            await this.context.globalState.update(`discovery.${ruleId}.dismissed`, undefined);
        }
    }

    private isGherkinDocument(document: vscode.TextDocument): boolean {
        return document.languageId === 'feature' || document.languageId === 'gherkin';
    }

    private hasBeenShown(ruleId: string): boolean {
        if (this.sessionDismissed.has(ruleId)) {
            return true;
        }
        return this.context.globalState.get<boolean>(`discovery.${ruleId}.dismissed`, false);
    }

    private async showRecommendation(ruleId: string, message: string, actionTitle: string, commandId: string, args?: any[]) {
        if (this.hasBeenShown(ruleId)) {
            return;
        }

        // Add to session dismissed immediately so we don't show it twice concurrently
        this.sessionDismissed.add(ruleId);

        const tryIt = `Try it (${actionTitle})`;
        const dontShowAgain = "Don't show again";

        const selection = await vscode.window.showInformationMessage(message, tryIt, dontShowAgain);
        
        if (this.disposeCts.token.isCancellationRequested) {
            return;
        }

        if (selection === tryIt) {
            if (args) {
                vscode.commands.executeCommand(commandId, ...args);
            } else {
                vscode.commands.executeCommand(commandId);
            }
        } else if (selection === dontShowAgain) {
            await this.context.globalState.update(`discovery.${ruleId}.dismissed`, true);
        }
    }

    private onDidSaveTextDocument(document: vscode.TextDocument) {
        if (!this.isGherkinDocument(document)) { return; }
        
        this.checkFormatterRule(document);
        this.checkGenerateStepRule(document);
    }

    private onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined) {
        if (!editor) { return; }
        if (!this.isGherkinDocument(editor.document)) { return; }

        this.checkDashboardRule();
        this.checkCommandCenterRule();
    }

    private checkFormatterRule(document: vscode.TextDocument) {
        const ruleId = 'formatterRule';
        if (this.hasBeenShown(ruleId)) { return; }

        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        // Look for multiple styling diagnostics (we don't have exact diagnostic codes, but we can look at messages or just count general errors if they look like formatting)
        // Usually, the linter reports trailing spaces, indentation, etc.
        const formatRelatedDiagnostics = diagnostics.filter(d => 
            d.message.toLowerCase().includes('space') || 
            d.message.toLowerCase().includes('indent') || 
            d.message.toLowerCase().includes('empty line')
        );

        if (formatRelatedDiagnostics.length >= 3) {
            this.showRecommendation(
                ruleId,
                "Tip: You can automatically format Gherkin files to fix spacing and indentation.",
                "Format Document",
                "editor.action.formatDocument"
            );
        }
    }

    private checkGenerateStepRule(document: vscode.TextDocument) {
        const ruleId = 'generateStepRule';
        if (this.hasBeenShown(ruleId)) { return; }

        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const undefinedSteps = diagnostics.filter(d => 
            d.message.includes('Undefined step') || 
            (d.source === 'Gherkin PowerTools' && d.severity === vscode.DiagnosticSeverity.Warning) // Assuming undefined steps are warnings
        );

        if (undefinedSteps.length >= 2) {
            this.showRecommendation(
                ruleId,
                "Tip: You can automatically generate Python step definitions using Quick Fix (Code Actions) or from the Command Palette.",
                "Generate Step",
                "gherkinPowerTools.createStepDefinition"
            );
        }
    }

    private checkDashboardRule() {
        const ruleId = 'dashboardRule';
        if (this.hasBeenShown(ruleId)) { return; }

        const nodes = this.graph.currentGeneration.getAllNodes();
        const features = nodes.filter(n => n.type === 'Feature');

        if (features.length >= 5) {
            this.showRecommendation(
                ruleId,
                "Tip: View metrics and unused steps for your project in the Gherkin PowerTools Dashboard.",
                "Open Dashboard",
                "gherkinPowerTools.showDashboard"
            );
        }
    }

    private checkCommandCenterRule() {
        const ruleId = 'commandCenterRule';
        if (this.hasBeenShown(ruleId)) { return; }

        // Trigger on first open of a Gherkin file if they haven't seen it
        this.showRecommendation(
            ruleId,
            "Tip: Access all Gherkin PowerTools features quickly from the Command Center.",
            "Open Command Center",
            "gherkinPowerTools.commandCenter"
        );
    }
}
