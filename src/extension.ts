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
import { GherkinCodeActionProvider } from './codeAction';
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
import { ConfigurationService } from './configuration';
import { ContextualFeatureDiscoveryService } from './contextualDiscovery';
import { ImpactCodeLensProvider } from './impactCodeLens';
import { AntiPatternDiagnosticsManager } from './antiPatternDiagnostics';
import { DeferredBootstrap } from './bootstrap';

import { executeMigrations } from './activation/migration';
import { GherkinContextService } from './activation/contextService';
import { registerWalkthroughCommands } from './activation/walkthrough';
import { registerProductionCommands } from './activation/commands';

const GHERKIN_LANGUAGES = ['feature', 'gherkin'];

export async function activate(context: vscode.ExtensionContext) {
    logger.info('Extension "vscode-gherkin-powertools" is now active.');
    
    // 1. Migrations & Legacy Cleanup
    await executeMigrations(context);

    // 2. Core Services
    const eventBus = new WorkspaceEventBus();
    context.subscriptions.push(eventBus);

    const configDiagnostics = vscode.languages.createDiagnosticCollection('gherkin-configuration');
    context.subscriptions.push(configDiagnostics);
    const configService = new ConfigurationService(configDiagnostics);

    const configWatcher = vscode.workspace.createFileSystemWatcher('**/.gherkin-powertoolsrc.json');
    context.subscriptions.push(configWatcher);

    const contextService = new GherkinContextService();
    context.subscriptions.push(contextService);

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

    const rankingService = new CompletionRankingService();
    rankingService.usageIndexer.setEventBus(eventBus);

    astRepository.setEventBus(eventBus);
    context.subscriptions.push({ dispose: () => astRepository.dispose() });

    const workspaceGraph = new WorkspaceGraph(symbolCache);
    workspaceGraph.setEventBus(eventBus);
    context.subscriptions.push({ dispose: () => workspaceGraph.dispose() });

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
        usageIndexer: rankingService.usageIndexer,
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
            vscode.window.showInformationMessage("Gherkin PowerTools: Feature recommendations have been reset.");
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
            vscode.window.showInformationMessage("Gherkin PowerTools: Historical trends cleared.");
        }),
        vscode.commands.registerCommand('gherkinPowerTools.commandCenter', showCommandCenter),
        vscode.commands.registerCommand('gherkinPowerTools.diagnoseWorkspace', () => {
            return showDiagnosticsReport(context, symbolCache, featureCache, configService, bootstrap);
        })
    );

    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: 'python' }, impactCodeLensProvider));

    // 7. Providers Initialization
    const linter = new GherkinLinter(symbolCache, configService);
    linter.setEventBus(eventBus);

    const highlighter = new GherkinHighlighter();
    highlighter.setEventBus(eventBus);

    context.subscriptions.push(linter);
    context.subscriptions.push(highlighter);

    context.subscriptions.push(
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
    configWatcher.onDidChange(() => eventBus.publish({ type: 'configurationChanged' }));
    configWatcher.onDidCreate(() => eventBus.publish({ type: 'configurationChanged' }));
    configWatcher.onDidDelete(() => eventBus.publish({ type: 'configurationChanged' }));

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
