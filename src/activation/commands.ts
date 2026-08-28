import * as vscode from 'vscode';
import { GherkinPowerToolsCommands } from '../commands';
import { ConfigurationService } from '../configuration';
import { StepRefactoringService } from '../refactoring';
import { SymbolCache } from '../cache';
import { WorkspaceEventBus } from '../eventBus';
import { runBehave, runBehaveWithPrompt, debugBehave } from '../execution';
import { createStepDefinition } from '../codeAction';
import { SourceLocationPresenter } from '../utils/sourceLocationPresenter';
import { ImpactReport } from '../impactAnalysis';

interface CommandServices {
    configService: ConfigurationService;
    refactoringService: StepRefactoringService;
    symbolCache: SymbolCache;
    eventBus: WorkspaceEventBus;
}

/**
 * Utility function to enforce Workspace Trust before executing commands.
 */
function checkWorkspaceTrust(): boolean {
    if (!vscode.workspace.isTrusted) {
        vscode.window.showWarningMessage("Execution disabled in untrusted workspace.", "Manage Workspace Trust").then(res => {
            if (res === "Manage Workspace Trust") {
                vscode.commands.executeCommand("workbench.trust.manage");
            }
        });
        return false;
    }
    return true;
}

/**
 * Registers production user-facing commands that provide custom UX (QuickPicks, InputBoxes, etc).
 */
export function registerProductionCommands(services: CommandServices): vscode.Disposable[] {
    const { configService, refactoringService, symbolCache, eventBus } = services;

    return [
        // Register Impact Analysis details command
        vscode.commands.registerCommand(GherkinPowerToolsCommands.showImpactDetails.id, async (report: ImpactReport) => {
            if (!report || report.affectedScenarios === 0) {
                vscode.window.showInformationMessage("This step definition is not used in any scenario.");
                return;
            }
            const items = report.usages.map(usage => {
                const parsedUri = vscode.Uri.parse(usage.uri);
                const description = `${SourceLocationPresenter.formatShort(parsedUri)}:${usage.line}`;
                let icon = 'symbol-event';
                if (usage.semanticType === 'when') icon = 'symbol-method';
                else if (usage.semanticType === 'then') icon = 'symbol-constant';

                return {
                    label: `$(${icon}) ${usage.keyword.trim()} ${usage.text}`,
                    description,
                    node: usage
                };
            });
            const selection = await vscode.window.showQuickPick(items, {
                placeHolder: `Select a step to navigate to (Impact: ${report.severity})`
            });
            if (selection) {
                const uri = vscode.Uri.parse(selection.node.uri);
                const doc = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(doc);
                const pos = new vscode.Position(Math.max(0, selection.node.line - 1), 0);
                editor.selection = new vscode.Selection(pos, pos);
                editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
            }
        }),
        
        // Wrapper for impact details backward compatibility or alternate namespace
        vscode.commands.registerCommand('gherkin-powertools.showImpactDetails', async (...args) => {
            return vscode.commands.executeCommand(GherkinPowerToolsCommands.showImpactDetails.id, ...args);
        }),

        // Custom command for creating step definitions
        vscode.commands.registerCommand('gherkinPowerTools.createStepDefinition', async (...args) => {
            if (!checkWorkspaceTrust()) return;
            const uri = await createStepDefinition(...args as [string, string, vscode.Uri?]);
            if (uri) {
                await symbolCache.updateFile(uri);
                eventBus.publish({ type: 'stepFileChanged', uri });
            }
        }),

        // Behave execution commands
        vscode.commands.registerCommand('gherkinPowerTools.runFeature', (uri?: vscode.Uri) => {
            if (!checkWorkspaceTrust()) return;
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (finalUri && finalUri.fsPath.endsWith('.feature')) {
                return runBehave(finalUri, undefined, configService);
            } else {
                vscode.window.showInformationMessage("Open a .feature file to run it.");
            }
        }),

        vscode.commands.registerCommand('gherkinPowerTools.runScenario', (uri?: vscode.Uri, line?: number) => {
            if (!checkWorkspaceTrust()) return;
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            const finalLine = line !== undefined ? line : vscode.window.activeTextEditor?.selection.active.line;
            if (finalUri) return runBehave(finalUri, finalLine, configService);
        }),

        vscode.commands.registerCommand('gherkinPowerTools.runFeatureWithArgs', (uri?: vscode.Uri) => {
            if (!checkWorkspaceTrust()) return;
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (finalUri) runBehaveWithPrompt(finalUri, undefined, configService);
        }),

        vscode.commands.registerCommand('gherkinPowerTools.runScenarioWithArgs', (uri?: vscode.Uri, line?: number) => {
            if (!checkWorkspaceTrust()) return;
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            const finalLine = line !== undefined ? line : vscode.window.activeTextEditor?.selection.active.line;
            if (finalUri) runBehaveWithPrompt(finalUri, finalLine, configService);
        }),

        vscode.commands.registerCommand('gherkinPowerTools.debugScenario', (uri?: vscode.Uri, line?: number) => {
            if (!checkWorkspaceTrust()) return;
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            const finalLine = line !== undefined ? line : vscode.window.activeTextEditor?.selection.active.line;
            if (finalUri) return debugBehave(finalUri, finalLine, configService);
        }),

        vscode.commands.registerCommand('gherkinPowerTools.debugFeature', (uri?: vscode.Uri) => {
            if (!checkWorkspaceTrust()) return;
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (finalUri) return debugBehave(finalUri, undefined, configService);
        }),

        // "Edit args & Run" button in the Testing panel toolbar
        vscode.commands.registerCommand('gherkinPowerTools.testExplorerEditAndRun', async () => {
            if (!checkWorkspaceTrust()) return;
            const activeEditor = vscode.window.activeTextEditor;
            const uri = activeEditor?.document.uri;
            if (uri && (activeEditor.document.languageId === 'feature' || uri.fsPath.endsWith('.feature'))) {
                await runBehaveWithPrompt(uri, undefined, configService);
            } else {
                const folders = vscode.workspace.workspaceFolders;
                if (folders && folders.length > 0) {
                    await runBehaveWithPrompt(folders[0].uri, undefined, configService);
                } else {
                    vscode.window.showWarningMessage('Open a .feature file to edit arguments.');
                }
            }
        }),

        // Refactoring commands
        vscode.commands.registerCommand('gherkinPowerTools.refactor.extractStep', async () => {
            if (!checkWorkspaceTrust()) return;
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            // Provide a basic UX via prompts, real implementations would use QuickPicks or input boxes.
            const newName = await vscode.window.showInputBox({ prompt: 'Enter new step name (without Given/When/Then)' });
            if (!newName) return;

            const targetUris = await vscode.workspace.findFiles('**/steps/*.py', '**/node_modules/**');
            if (targetUris.length === 0) {
                vscode.window.showErrorMessage('No Python step definition files found.');
                return;
            }
            const targetOptions = targetUris.map(uri => ({ label: SourceLocationPresenter.formatShort(uri), uri }));
            const selectedTarget = await vscode.window.showQuickPick(targetOptions, { placeHolder: 'Select target file' });
            if (!selectedTarget) return;

            const edit = await refactoringService.extractStep(editor.document, editor.selection, newName, selectedTarget.uri);
            if (edit) {
                const applied = await vscode.workspace.applyEdit(edit);
                if (applied) {
                    await editor.document.save();
                    const targetDoc = await vscode.workspace.openTextDocument(selectedTarget.uri);
                    await targetDoc.save();
                }
            }
        }),

        vscode.commands.registerCommand('gherkinPowerTools.refactor.renameStep', async () => {
            await vscode.commands.executeCommand('editor.action.rename');
        })
    ];
}
