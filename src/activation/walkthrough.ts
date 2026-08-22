import * as vscode from 'vscode';
import { GherkinFormattingEditProvider } from '../formatter';
import { ConfigurationService } from '../configuration';

/**
 * Registers commands specific to interactive walkthroughs and demos.
 * These commands inject messy content or provide simulated interactions.
 * 
 * @param formatter The active formatter provider
 * @param configService Configuration service
 * @returns Array of disposables
 */
export function registerWalkthroughCommands(
    formatter: GherkinFormattingEditProvider,
    configService: ConfigurationService
): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('gherkinPowerTools.format', async () => {
            let editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'feature') {
                const featureEditor = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'feature');
                if (featureEditor) {
                    editor = featureEditor;
                } else {
                    const messyGherkin = `Feature: Formatting Demo\n  Scenario: Look at this messy file\n  Given some precondition\n    When I perform an action\n        Then it should be formatted perfectly\n  | column 1 | col 2 |\n|val 1| value 2|\n`;
                    const document = await vscode.workspace.openTextDocument({
                        content: messyGherkin,
                        language: 'feature'
                    });
                    editor = await vscode.window.showTextDocument(document, { preview: false, viewColumn: vscode.ViewColumn.Beside });
                    
                    vscode.window.showInformationMessage("Auto-formatting document...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            const config = configService.getConfiguration(editor.document.uri);
            if (config.formatter?.enabled === false) {
                vscode.window.showWarningMessage("Formatting is disabled in settings.");
                return;
            }

            const edits = await formatter.provideDocumentFormattingEdits(editor.document, {} as any, new vscode.CancellationTokenSource().token);
            if (edits && edits.length > 0) {
                await editor.edit(editBuilder => {
                    for (const edit of edits) {
                        editBuilder.replace(edit.range, edit.newText);
                    }
                });
            } else {
                vscode.window.showInformationMessage("Document is already formatted.");
            }
        }),

        vscode.commands.registerCommand('gherkinPowerTools.demoQuickFix', async () => {
            let editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'feature') {
                vscode.commands.executeCommand('editor.action.quickFix');
                return;
            }
            const messyGherkin = `Feature: Quick Fix Demo\n  Scenario: Missing steps\n    Given this step does not exist in Python\n`;
            const document = await vscode.workspace.openTextDocument({
                content: messyGherkin,
                language: 'feature'
            });
            editor = await vscode.window.showTextDocument(document, { preview: false, viewColumn: vscode.ViewColumn.Beside });
            
            // Move cursor to the undefined step
            const position = new vscode.Position(2, 10);
            editor.selection = new vscode.Selection(position, position);
            vscode.window.showInformationMessage("Press ⌘. (macOS) / Ctrl+. (Windows) or click the lightbulb to see Quick Fixes.");
            
            // Trigger quick fix menu automatically after a short delay
            setTimeout(() => {
                vscode.commands.executeCommand('editor.action.quickFix');
            }, 2000);
        }),

        vscode.commands.registerCommand('gherkinPowerTools.demoGoToDefinition', async () => {
            let editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'feature') {
                vscode.commands.executeCommand('editor.action.revealDefinition');
                return;
            }
            vscode.window.showInformationMessage("To test Go to Definition, open a saved .feature file and right-click a step.");
        })
    ];
}
