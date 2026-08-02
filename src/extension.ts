import * as vscode from 'vscode';
import { WorkspaceEventBus } from './eventBus';
import { GherkinFormattingEditProvider } from './formatter';
import { GherkinDocumentSymbolProvider } from './outline';
import { GherkinLinter } from './linter';
import { GherkinHighlighter } from './highlighter';
import { showProjectHealthDashboard } from './statistics';

import { GherkinDefinitionProvider } from './definition';
import { SymbolCache, FeatureCache } from './cache';
import { logger } from './logger';
import { GherkinCodeActionProvider, createStepDefinition } from './codeAction';
import { GherkinCompletionProvider } from './completion';
import { CompletionRankingService } from './completionRanking';
import { GherkinHoverProvider } from './hover';
import { astRepository } from './ast';
import { WorkspaceGraph } from './graph';
import { metricsLogger } from './metrics';
import { discoveryService } from './discovery';
import { runBehave, runBehaveWithPrompt, debugBehave, registerExecutionListeners } from './execution';

import { showDiagnosticsReport } from './diagnostics';
import { showOnboardingNotificationIfNeeded, FirstRunExperience } from './onboarding';
import { showCommandCenter } from './commandCenter';
import { GherkinTestController } from './testController';
import { StepRefactoringService } from './refactoring';
import { GherkinRenameProvider } from './renameProvider';

import { ConfigurationService } from './configuration';
import { ContextualFeatureDiscoveryService } from './contextualDiscovery';

const GHERKIN_LANGUAGES = ['feature', 'gherkin'];

/**
 * Activates the Gherkin PowerTools extension.
 * This method is called when the extension is activated by VS Code.
 *
 * @param context The extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext) {
    logger.info('Extension "vscode-gherkin-powertools" is now active.');
    const eventBus = new WorkspaceEventBus();
    context.subscriptions.push(eventBus);


    registerExecutionListeners(context);

    const configDiagnostics = vscode.languages.createDiagnosticCollection('gherkin-configuration');
    context.subscriptions.push(configDiagnostics);
    const configService = new ConfigurationService(configDiagnostics);

    const configWatcher = vscode.workspace.createFileSystemWatcher('**/.gherkin-powertoolsrc.json');
    context.subscriptions.push(configWatcher);

    discoveryService.configService = configService;
    discoveryService.eventBus = eventBus;
    const testController = new GherkinTestController(context, configService);
    testController.setEventBus(eventBus);
    context.subscriptions.push(testController);

    const formatter = new GherkinFormattingEditProvider(configService);
    const symbolProvider = new GherkinDocumentSymbolProvider();

    // Initialize Symbol Cache for definitions
    const symbolCache = new SymbolCache();
    symbolCache.setEventBus(eventBus);

    // Initialize Feature Cache for workspace-wide tag statistics
    const featureCache = new FeatureCache();
    featureCache.setEventBus(eventBus);

    // Initialize Completion Ranking Service for contextual completions
    const rankingService = new CompletionRankingService();
    rankingService.usageIndexer.setEventBus(eventBus);

    // Initialize AST Repository to centralize parsing
    astRepository.setEventBus(eventBus);
    context.subscriptions.push({ dispose: () => astRepository.dispose() });

    // Initialize WorkspaceGraph
    const workspaceGraph = new WorkspaceGraph(symbolCache);
    workspaceGraph.setEventBus(eventBus);
    context.subscriptions.push({ dispose: () => workspaceGraph.dispose() });

    // Initialize Contextual Feature Discovery
    new ContextualFeatureDiscoveryService(context, workspaceGraph);

    // Initialize Refactoring Service
    const refactoringService = new StepRefactoringService(workspaceGraph, symbolCache);
    const renameProvider = new GherkinRenameProvider(refactoringService, workspaceGraph);

    // Non-blocking activation: initialize caches lazily after VS Code startup
    const linter = new GherkinLinter(symbolCache, configService);
    linter.setEventBus(eventBus);

    const highlighter = new GherkinHighlighter();
    highlighter.setEventBus(eventBus);



    // Rebuild discovery logic on configuration change
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('gherkinPowerTools')) {
            configService.invalidateCache();
            eventBus.publish({ type: 'configurationChanged', event: e });
        }
    }));

    // Listen to changes in project configuration files
    configWatcher.onDidChange(() => eventBus.publish({ type: 'configurationChanged' }));
    configWatcher.onDidCreate(() => eventBus.publish({ type: 'configurationChanged' }));
    configWatcher.onDidDelete(() => eventBus.publish({ type: 'configurationChanged' }));

    // Defer heavy I/O scanning and watcher setup to allow VS Code to start up quickly
    setTimeout(() => {
        symbolCache.ensureInitialized().catch(err => logger.error(`Error during lazy symbol cache load: ${err}`));
        featureCache.ensureInitialized().catch(err => logger.error(`Error during lazy feature cache load: ${err}`));
        rankingService.usageIndexer.indexWorkspace().catch(err => logger.error(`Error during lazy usage indexer load: ${err}`));

        discoveryService.setupWatchers().forEach(w => context.subscriptions.push(w));

        const featureWatcher = vscode.workspace.createFileSystemWatcher('**/*.feature');
        featureWatcher.onDidCreate(uri => eventBus.publish({ type: 'featureFileCreated', uri }));
        featureWatcher.onDidChange(uri => eventBus.publish({ type: 'featureFileChanged', uri }));
        featureWatcher.onDidDelete(uri => eventBus.publish({ type: 'featureFileDeleted', uri }));
        context.subscriptions.push(featureWatcher);
    }, 2000);

    // Asynchronously trigger onboarding recommendation check
    showOnboardingNotificationIfNeeded(context, configService).catch(err => {
        logger.error(`Error checking onboarding notification: ${err}`);
    });

    // First run experience check
    FirstRunExperience.checkAndRun(context).catch(err => {
        logger.error(`Error checking first run experience: ${err}`);
    });

    // Asynchronously trigger peek view recommendation check
    checkPeekViewRecommendation(context).catch(err => {
        logger.error(`Error checking peek view recommendation: ${err}`);
    });
    // Register the context menu command to format the document
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.format', async () => {
            let editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'feature') {
                const featureEditor = vscode.window.visibleTextEditors.find(e => e.document.languageId === 'feature');
                if (featureEditor) {
                    editor = featureEditor;
                } else {
                    const messyGherkin = `Feature: Formatting Demo
  Scenario: Look at this messy file
  Given some precondition
    When I perform an action
        Then it should be formatted perfectly
  | column 1 | col 2 |
|val 1| value 2|
`;
                    const document = await vscode.workspace.openTextDocument({
                        content: messyGherkin,
                        language: 'feature'
                    });
                    editor = await vscode.window.showTextDocument(document, { preview: false, viewColumn: vscode.ViewColumn.Beside });
                    
                    vscode.window.showInformationMessage("Gherkin PowerTools: Watch the magic! Auto-formatting in 2 seconds...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            const config = configService.getConfiguration(editor.document.uri);
            if (config.formatter?.enabled === false) {
                vscode.window.showWarningMessage("Gherkin PowerTools: Formatter is disabled in settings ('gherkinPowerTools.formatter.enabled' is false).");
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
                vscode.window.showInformationMessage("Gherkin PowerTools: Document is already formatted or could not be formatted.");
            }
        }),
        vscode.commands.registerCommand('gherkinPowerTools.showMetrics', () => {
            metricsLogger.showMetrics();
        }),
        vscode.commands.registerCommand('gherkinPowerTools.replayOnboarding', () => {
            FirstRunExperience.replayOnboarding(context);
        })
    );

    // Register internal completion tracking command
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.internal.recordCompletion', (pattern: string) => {
            rankingService.recordCompletion(pattern);
        })
    );

    // Register the project health dashboard command
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.showStatistics', () => {
            showProjectHealthDashboard(context, workspaceGraph, symbolCache);
        })
    );


    // Register the custom command for creating step definitions
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.createStepDefinition', async (...args) => {
            const uri = await createStepDefinition(...args as [string, string, vscode.Uri?]);
            if (uri) {
                await symbolCache.updateFile(uri);
                eventBus.publish({ type: 'stepFileChanged', uri });
            }
        })
    );

    // Register Command Center
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.commandCenter', showCommandCenter)
    );

    // Register Behave execution commands
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.runFeature', (uri?: vscode.Uri) => {
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (finalUri && finalUri.fsPath.endsWith('.feature')) {
                return runBehave(finalUri, undefined, configService);
            } else {
                vscode.window.showInformationMessage("Gherkin PowerTools: Open a saved .feature file first to run it, or click the Play button in the Test Explorer.");
            }
        })
    );
    
    // Register interactive demo commands for Walkthrough
    context.subscriptions.push(
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
            vscode.window.showInformationMessage("Gherkin PowerTools: Press Cmd+. (or Ctrl+.) or click the lightbulb to see Quick Fixes!");
            
            // Trigger quick fix menu automatically after a short delay
            setTimeout(() => {
                vscode.commands.executeCommand('editor.action.quickFix');
            }, 2000);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.demoGoToDefinition', async () => {
            let editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'feature') {
                vscode.commands.executeCommand('editor.action.revealDefinition');
                return;
            }
            vscode.window.showInformationMessage("Gherkin PowerTools: To test Go to Definition, please open a saved .feature file from your workspace, right-click a step and select 'Go to Definition'.");
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.runScenario', (uri?: vscode.Uri, line?: number) => {
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            const finalLine = line !== undefined ? line : vscode.window.activeTextEditor?.selection.active.line;
            if (finalUri) return runBehave(finalUri, finalLine, configService);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.runFeatureWithArgs', (uri?: vscode.Uri) => {
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (finalUri) runBehaveWithPrompt(finalUri, undefined, configService);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.runScenarioWithArgs', (uri?: vscode.Uri, line?: number) => {
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            const finalLine = line !== undefined ? line : vscode.window.activeTextEditor?.selection.active.line;
            if (finalUri) runBehaveWithPrompt(finalUri, finalLine, configService);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.debugScenario', (uri?: vscode.Uri, line?: number) => {
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            const finalLine = line !== undefined ? line : vscode.window.activeTextEditor?.selection.active.line;
            if (finalUri) return debugBehave(finalUri, finalLine, configService);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.debugFeature', (uri?: vscode.Uri) => {
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (finalUri) return debugBehave(finalUri, undefined, configService);
        })
    );

    // Register the workspace diagnostic command
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.diagnoseWorkspace', () => {
            return showDiagnosticsReport(context, symbolCache, featureCache, configService);
        })
    );

    // "Edit args & Run" button in the Testing panel toolbar (pencil icon via view/title menu)
    // Shows the Behave args prompt, contextualized to the active feature file if open.
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.testExplorerEditAndRun', async () => {
            const activeEditor = vscode.window.activeTextEditor;
            const uri = activeEditor?.document.uri;
            if (uri && (activeEditor.document.languageId === 'feature' || uri.fsPath.endsWith('.feature'))) {
                await runBehaveWithPrompt(uri, undefined, configService);
            } else {
                const folders = vscode.workspace.workspaceFolders;
                if (folders && folders.length > 0) {
                    await runBehaveWithPrompt(folders[0].uri, undefined, configService);
                } else {
                    vscode.window.showWarningMessage('Open a .feature file to edit Behave arguments.');
                }
            }
        })
    );

    context.subscriptions.push(linter);

    // Register refactoring commands
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.refactor.extractStep', async () => {
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
            const targetOptions = targetUris.map(uri => ({ label: vscode.workspace.asRelativePath(uri), uri }));
            const selectedTarget = await vscode.window.showQuickPick(targetOptions, { placeHolder: 'Select target step definition file' });
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
    );

    context.subscriptions.push(
        vscode.languages.registerRenameProvider(
            { language: 'python' },
            renameProvider
        )
    );    context.subscriptions.push(highlighter);

    // Initial lint & highlight for all open feature files
    vscode.workspace.textDocuments.forEach(doc => {
        linter.immediateLint(doc);
    });
    if (vscode.window.activeTextEditor) {
        highlighter.highlight(vscode.window.activeTextEditor);
    }

    // Event Bus publish for workspace events
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            eventBus.publish({ type: 'activeEditorChanged', editor });
        }),
        vscode.workspace.onDidOpenTextDocument(document => {
            eventBus.publish({ type: 'textDocumentOpened', document });
        }),
        vscode.workspace.onDidSaveTextDocument(() => {
            // Can be treated as change or open depending on needs. Linter just lint on textDocumentChanged.
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            eventBus.publish({ type: 'textDocumentChanged', event });
        }),
        vscode.workspace.onDidCloseTextDocument(doc => linter.clear(doc))
    );

    if (vscode.window.activeTextEditor) {
        eventBus.publish({ type: 'activeEditorChanged', editor: vscode.window.activeTextEditor });
    }

    // Register the formatter for both full documents and selections/ranges
    // We register for both 'feature' and 'gherkin' language identifiers to ensure maximum compatibility
    GHERKIN_LANGUAGES.forEach(language => {
        context.subscriptions.push(
            vscode.languages.registerDocumentFormattingEditProvider(
                { language },
                formatter
            ),
            vscode.languages.registerDocumentRangeFormattingEditProvider(
                { language },
                formatter
            ),

            vscode.languages.registerDocumentSymbolProvider(
                { language },
                symbolProvider
            ),
            vscode.languages.registerDefinitionProvider(
                { language },
                new GherkinDefinitionProvider(symbolCache)
            ),
            vscode.languages.registerCompletionItemProvider(
                { language },
                new GherkinCompletionProvider(symbolCache, rankingService),
                ' ', '<' // trigger on space or <
            ),
            vscode.languages.registerHoverProvider(
                { language },
                new GherkinHoverProvider(symbolCache, featureCache)
            ),
            vscode.languages.registerCodeActionsProvider(
                { language },
                new GherkinCodeActionProvider(),
                {
                    providedCodeActionKinds: GherkinCodeActionProvider.providedCodeActionKinds
                }
            ),
            vscode.languages.registerRenameProvider(
                { language },
                renameProvider
            )
        );
    });

    logger.info('Activation finished successfully.');
}

/**
 * Deactivates the Gherkin PowerTools extension.
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
    discoveryService.dispose();
}

async function checkPeekViewRecommendation(context: vscode.ExtensionContext) {
    const stateKey = 'gherkinPowerTools.promptedPeekView';
    const prompted = context.globalState.get<boolean>(stateKey, false);

    if (prompted) {
        return;
    }

    const testingConfig = vscode.workspace.getConfiguration('testing');
    const currentValue = testingConfig.get<string>('automaticallyOpenPeekView');

    if (currentValue !== 'never') {
        const choice = await vscode.window.showInformationMessage(
            "For the best BDD experience with Gherkin PowerTools, we recommend disabling the automatic Test Peek View.",
            "Disable Peek View", "Keep Current"
        );

        if (choice === "Disable Peek View") {
            // Set it in the user's global settings to affect their standard VS Code experience
            await testingConfig.update('automaticallyOpenPeekView', 'never', vscode.ConfigurationTarget.Global);
            logger.info("testing.automaticallyOpenPeekView has been set to 'never'");
        }
    }

    // Mark as prompted so we don't bother the user again
    await context.globalState.update(stateKey, true);
}
