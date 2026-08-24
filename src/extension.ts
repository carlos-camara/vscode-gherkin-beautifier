import * as vscode from 'vscode';
import { WorkspaceEventBus } from './eventBus';
import { GherkinFormattingEditProvider } from './formatter';
import { GherkinDocumentSymbolProvider } from './outline';
import { GherkinLinter } from './linter';
import { GherkinHighlighter } from './highlighter';
import { showProjectHealthDashboard } from './statistics';
import { MetricsHistory } from './history';
import { GherkinDefinitionProvider } from './definition';
import { SymbolCache, FeatureCache } from './cache';
import { logger } from './logger';
import { GherkinCodeActionProvider, generateSafeFixAllEdit } from './codeAction';
import { diagnosticRegistry } from './rules';
import { SuppressionEngine } from './suppressions';
import { GherkinCompletionProvider } from './completion';
import { CompletionRankingService } from './completionRanking';
import { GherkinHoverProvider } from './hover';
import { astRepository } from './ast';
import { WorkspaceGraph } from './graph';
import { metricsLogger } from './metrics';
import { discoveryService } from './discovery';
import { featureDiscoveryService } from './featureDiscovery';
import { registerExecutionListeners } from './execution';
import { showDiagnosticsReport } from './diagnostics';
import { showOnboardingNotificationIfNeeded, FirstRunExperience } from './onboarding';
import { showCommandCenter } from './commandCenter';
import { GherkinTestController } from './testController';
import { StepRefactoringService } from './refactoring';
import { GherkinRenameProvider } from './renameProvider';
import { ConfigurationService, ConfigurationLoader, ProjectConfiguration } from './configuration';
import { ContextualFeatureDiscoveryService } from './contextualDiscovery';
import { ImpactCodeLensProvider } from './impactCodeLens';
import { AntiPatternDiagnosticsManager } from './antiPatternDiagnostics';
import { DeferredBootstrap } from './bootstrap';

import { executeMigrations } from './activation/migration';
import { GherkinContextService } from './activation/contextService';
import { registerWalkthroughCommands } from './activation/walkthrough';
import { registerProductionCommands } from './activation/commands';

const GHERKIN_LANGUAGES = ['feature', 'gherkin'];

class VsCodeConfigurationLoader implements ConfigurationLoader {
    async load(workspaceFolder: vscode.WorkspaceFolder | undefined): Promise<ProjectConfiguration | null> {
        if (!workspaceFolder) return null;

        try {
            const configUri = vscode.Uri.joinPath(workspaceFolder.uri, '.gherkin-powertoolsrc.json');

            try {
                // Try to stat first to avoid throwing if not found, since readFile throws
                await vscode.workspace.fs.stat(configUri);
            } catch (e) {
                return null; // File doesn't exist
            }

            const fileData = await vscode.workspace.fs.readFile(configUri);
            const content = new TextDecoder('utf-8').decode(fileData);
            let parsed = null;
            try {
                parsed = JSON.parse(content);
            } catch (e) {
                // Return content anyway for diagnostics
            }

            return {
                content,
                parsed,
                uri: configUri
            };
        } catch (e) {
            return null;
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {
    logger.info('Extension "vscode-gherkin-powertools" is now active.');

    // 1. Migrations & Legacy Cleanup
    await executeMigrations(context);

    // 2. Core Services
    const eventBus = new WorkspaceEventBus();
    context.subscriptions.push(eventBus);

    const configDiagnostics = vscode.languages.createDiagnosticCollection('gherkin-configuration');
    context.subscriptions.push(configDiagnostics);
    const configLoader = new VsCodeConfigurationLoader();
    const configService = new ConfigurationService(configDiagnostics, configLoader);
    await configService.initialize();

    const configWatcher = vscode.workspace.createFileSystemWatcher('**/.gherkin-powertoolsrc.json');
    context.subscriptions.push(configWatcher);

    const suppressionWatcher = vscode.workspace.createFileSystemWatcher('**/.gherkin-pt-suppressions.json');
    context.subscriptions.push(suppressionWatcher);

    const contextService = new GherkinContextService();
    context.subscriptions.push(contextService);

    metricsLogger.bind(context);
    registerExecutionListeners(context);

    // 3. Service Dependencies
    discoveryService.configService = configService;
    discoveryService.eventBus = eventBus;
    featureDiscoveryService.configService = configService;
    featureDiscoveryService.eventBus = eventBus;

    const testController = new GherkinTestController(context, configService);
    testController.setEventBus(eventBus);
    context.subscriptions.push(testController);

    // Caches and Analytics
    const symbolCache = new SymbolCache();
    symbolCache.setEventBus(eventBus);

    const featureCache = new FeatureCache();
    featureCache.setEventBus(eventBus);

    astRepository.setEventBus(eventBus);
    context.subscriptions.push({ dispose: () => astRepository.dispose() });

    const workspaceGraph = new WorkspaceGraph(symbolCache);
    workspaceGraph.setEventBus(eventBus);
    context.subscriptions.push({ dispose: () => workspaceGraph.dispose() });

    const rankingService = new CompletionRankingService(workspaceGraph);

    const antiPatternDiagnostics = new AntiPatternDiagnosticsManager(workspaceGraph, symbolCache, eventBus);
    context.subscriptions.push(antiPatternDiagnostics);

    const contextualDiscoveryService = new ContextualFeatureDiscoveryService(context, workspaceGraph);
    context.subscriptions.push(contextualDiscoveryService);

    // 4. Action Services & Command Modules
    const refactoringService = new StepRefactoringService(workspaceGraph, symbolCache);
    const renameProvider = new GherkinRenameProvider(refactoringService, workspaceGraph);
    const impactCodeLensProvider = new ImpactCodeLensProvider(workspaceGraph);
    const formatter = new GherkinFormattingEditProvider(configService);
    const symbolProvider = new GherkinDocumentSymbolProvider();

    // 5. Deferred background tasks
    const bootstrap = new DeferredBootstrap({
        symbolCache,
        featureCache,
        workspaceGraph,
        impactCodeLensProvider,
        eventBus,
        discoveryService,
        featureDiscoveryService
    });
    context.subscriptions.push(bootstrap);

    // 6. Contextual Subscriptions for commands
    context.subscriptions.push(
        ...registerWalkthroughCommands(formatter, configService),
        ...registerProductionCommands({ configService, refactoringService, symbolCache, eventBus })
    );

    // Additional generic commands
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.showMetrics', () => { metricsLogger.showMetrics(); }),
        vscode.commands.registerCommand('gherkinPowerTools.replayOnboarding', () => { FirstRunExperience.replayOnboarding(context); }),
        vscode.commands.registerCommand('gherkinPowerTools.resetContextualRecommendations', async () => {
            await contextualDiscoveryService.reset();
            vscode.window.showInformationMessage("Feature recommendations reset.");
        }),
        vscode.commands.registerCommand('gherkinPowerTools.internal.recordCompletion', (pattern: string) => { rankingService.recordCompletion(pattern); }),
        vscode.commands.registerCommand('gherkinPowerTools.showGherkinHealth', () => { showProjectHealthDashboard(context, workspaceGraph, symbolCache); }),
        vscode.commands.registerCommand('gherkinPowerTools.analytics.exportHistory', async () => {
            const history = new MetricsHistory(context);
            const data = history.exportHistory();
            const doc = await vscode.workspace.openTextDocument({ content: data, language: 'json' });
            await vscode.window.showTextDocument(doc);
        }),
        vscode.commands.registerCommand('gherkinPowerTools.analytics.clearHistory', () => {
            const history = new MetricsHistory(context);
            history.clearHistory();
            vscode.window.showInformationMessage("Historical trends cleared.");
        }),
        vscode.commands.registerCommand('gherkinPowerTools.commandCenter', showCommandCenter),
        vscode.commands.registerCommand('gherkinPowerTools.diagnoseWorkspace', () => {
            return showDiagnosticsReport(context, symbolCache, featureCache, configService, bootstrap);
        })
    );

    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: 'python' }, impactCodeLensProvider));

    // 7. Providers Initialization
    const linter = new GherkinLinter(symbolCache, configService);
    linter.setWorkspaceGraph(workspaceGraph);
    linter.setEventBus(eventBus);

    const highlighter = new GherkinHighlighter();
    highlighter.setEventBus(eventBus);

    context.subscriptions.push(linter);
    context.subscriptions.push(highlighter);

    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.suppressFinding', async (ruleId: string, uriString: string, scopeType?: string, scopeValue?: string) => {
            const uri = vscode.Uri.parse(uriString);
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage("Cannot suppress finding outside of a workspace.");
                return;
            }

            const reason = await vscode.window.showInputBox({
                prompt: `Reason for suppressing '${ruleId}'`,
                placeHolder: "E.g. Approved exception for legacy component",
                validateInput: text => {
                    return text.trim().length > 0 ? null : 'A reason is required.';
                }
            });

            if (!reason) {
                return; // User cancelled
            }

            const engine = new SuppressionEngine(workspaceRoot);

            try {
                engine.addSuppression({
                    ruleId,
                    uri: uri.fsPath, // engine.addSuppression resolves relative
                    scopeType,
                    scopeValue,
                    reason,
                    timestamp: new Date().toISOString(),
                    by: process.env.USER || 'Unknown'
                });
                vscode.window.showInformationMessage(`Suppressed '${ruleId}'`);
                // Re-lint the file to remove the diagnostic immediately
                const doc = await vscode.workspace.openTextDocument(uri);
                linter.immediateLint(doc);
                eventBus.publish({ type: 'configurationChanged' });
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to add suppression: ${err}`);
            }
        }),
        vscode.commands.registerCommand('gherkinPowerTools.fixAllAuto', async (uri: vscode.Uri) => {
            const document = await vscode.workspace.openTextDocument(uri);
            const edit = generateSafeFixAllEdit(document, diagnosticRegistry.get(document.uri.toString()) || []);
            if (edit) {
                await vscode.workspace.applyEdit(edit);
                linter.immediateLint(document);
            }
        }),
        vscode.commands.registerCommand('gherkinPowerTools.fixAllSafe', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const doc = editor.document;
            const diagnostics = diagnosticRegistry.get(doc.uri.toString()) || [];
            const edit = generateSafeFixAllEdit(doc, diagnostics);
            if (edit && edit.size > 0) {
                await vscode.workspace.applyEdit(edit);
            } else {
                vscode.window.showInformationMessage("No safe deterministic fixes available in this file.");
            }
        }),
        vscode.languages.registerRenameProvider({ language: 'python' }, renameProvider)
    );

    GHERKIN_LANGUAGES.forEach(language => {
        context.subscriptions.push(
            vscode.languages.registerDocumentFormattingEditProvider({ language }, formatter),
            vscode.languages.registerDocumentRangeFormattingEditProvider({ language }, formatter),
            vscode.languages.registerDocumentSymbolProvider({ language }, symbolProvider),
            vscode.languages.registerDefinitionProvider({ language }, new GherkinDefinitionProvider(symbolCache)),
            vscode.languages.registerCompletionItemProvider({ language }, new GherkinCompletionProvider(symbolCache, rankingService), ' ', '<'),
            vscode.languages.registerHoverProvider({ language }, new GherkinHoverProvider(symbolCache, featureCache)),
            vscode.languages.registerCodeActionsProvider({ language }, new GherkinCodeActionProvider(), { providedCodeActionKinds: GherkinCodeActionProvider.providedCodeActionKinds }),
            vscode.languages.registerRenameProvider({ language }, renameProvider)
        );
    });

    // 8. Reactive Watchers and Bus bindings
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('gherkinPowerTools')) {
            configService.invalidateCache();
            eventBus.publish({ type: 'configurationChanged', event: e });
        }
    }));
    configWatcher.onDidChange(async (uri) => {
        await configService.loadConfiguration(uri);
        eventBus.publish({ type: 'configurationChanged' });
    });
    configWatcher.onDidCreate(async (uri) => {
        await configService.loadConfiguration(uri);
        eventBus.publish({ type: 'configurationChanged' });
    });
    configWatcher.onDidDelete(async (uri) => {
        await configService.loadConfiguration(uri);
        eventBus.publish({ type: 'configurationChanged' });
    });

    suppressionWatcher.onDidChange(() => eventBus.publish({ type: 'configurationChanged' }));
    suppressionWatcher.onDidCreate(() => eventBus.publish({ type: 'configurationChanged' }));
    suppressionWatcher.onDidDelete(() => eventBus.publish({ type: 'configurationChanged' }));

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => { eventBus.publish({ type: 'textDocumentOpened', document }); }),
        vscode.workspace.onDidChangeTextDocument(event => { eventBus.publish({ type: 'textDocumentChanged', event }); }),
        vscode.workspace.onDidCloseTextDocument(doc => linter.clear(doc)),
        vscode.window.onDidChangeActiveTextEditor(editor => { eventBus.publish({ type: 'activeEditorChanged', editor }); })
    );

    // Initial state setup
    vscode.workspace.textDocuments.forEach(doc => { linter.immediateLint(doc); });
    if (vscode.window.activeTextEditor) {
        highlighter.highlight(vscode.window.activeTextEditor);
        eventBus.publish({ type: 'activeEditorChanged', editor: vscode.window.activeTextEditor });
    }

    bootstrap.start();

    showOnboardingNotificationIfNeeded(context, configService).catch(err => { logger.error(`Error checking onboarding notification: ${err}`); });
    FirstRunExperience.checkAndRun(context).catch(err => { logger.error(`Error checking first run experience: ${err}`); });

    logger.info('Activation finished successfully.');
}

export function deactivate() {
    discoveryService.dispose();
}
