import * as vscode from 'vscode';
import { GherkinFormattingEditProvider } from './formatter';
import { GherkinDocumentSymbolProvider } from './outline';
import { GherkinLinter } from './linter';
import { GherkinHighlighter } from './highlighter';
import { showStatisticsDashboard } from './statistics';
import { GherkinDefinitionProvider } from './definition';
import { SymbolCache, FeatureCache } from './cache';
import { logger } from './logger';
import { GherkinCodeActionProvider, createStepDefinition } from './codeAction';
import { GherkinCompletionProvider } from './completion';
import { GherkinHoverProvider } from './hover';
import { discoveryService } from './discovery';
import { runBehave, runBehaveWithPrompt, debugBehave, registerExecutionListeners } from './execution';
import { BehaveCodeLensProvider } from './codelens';
import { showDiagnosticsReport } from './diagnostics';
import { showOnboardingNotificationIfNeeded } from './onboarding';
import { showCommandCenter } from './commandCenter';
import { GherkinTestController } from './testController';

import { ConfigurationService } from './configuration';

const GHERKIN_LANGUAGES = ['feature', 'gherkin'];

/**
 * Activates the Gherkin PowerTools extension.
 * This method is called when the extension is activated by VS Code.
 * 
 * @param context The extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext) {
    logger.info('Extension "vscode-gherkin-powertools" is now active.');
    
    registerExecutionListeners(context);

    const configDiagnostics = vscode.languages.createDiagnosticCollection('gherkin-configuration');
    context.subscriptions.push(configDiagnostics);
    const configService = new ConfigurationService(configDiagnostics);

    const configWatcher = vscode.workspace.createFileSystemWatcher('**/.gherkin-powertoolsrc.json');
    context.subscriptions.push(configWatcher);

    discoveryService.configService = configService;

    const testController = new GherkinTestController(configService);
    context.subscriptions.push(testController);

    const formatter = new GherkinFormattingEditProvider(configService);
    const symbolProvider = new GherkinDocumentSymbolProvider();
    
    // Initialize Symbol Cache for definitions
    const symbolCache = new SymbolCache();
    const symbolInit = symbolCache.initialize();

    // Initialize Feature Cache for workspace-wide tag statistics
    const featureCache = new FeatureCache();
    featureCache.initialize().catch(err => {
        logger.error(`Error during initial feature cache load: ${err}`);
    });

    // Non-blocking activation: initialize caches in the background
    // symbolInit and featureInit are Promises that run asynchronously

    const linter = new GherkinLinter(symbolCache);

    const reLintOpenFiles = () => {
        vscode.workspace.textDocuments.forEach(doc => {
            if (GHERKIN_LANGUAGES.includes(doc.languageId)) {
                linter.immediateLint(doc);
            }
        });
    };

    // Once the symbol cache finishes its initial background load, re-lint 
    // all open files so that "undefined step" diagnostics appear.
    symbolInit.then(() => {
        reLintOpenFiles();
    }).catch(err => {
        logger.error(`Error during initial symbol cache load: ${err}`);
    });

    // Watch for changes in Python step files
    const setupStepWatchers = () => {
        const watchers = discoveryService.setupWatchers(
            async uri => { await symbolCache.updateFile(uri); reLintOpenFiles(); },
            async uri => { await symbolCache.updateFile(uri); reLintOpenFiles(); },
            uri => { symbolCache.removeFile(uri); reLintOpenFiles(); }
        );
        watchers.forEach(w => context.subscriptions.push(w));
    };
    setupStepWatchers();

    const rebuildDiscovery = async () => {
        configService.invalidateCache();
        setupStepWatchers();
        await symbolCache.initialize();
        reLintOpenFiles();
    };

    // Rebuild discovery logic on configuration change
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
        if (e.affectsConfiguration('gherkinPowerTools')) {
            configService.invalidateCache();
            if (e.affectsConfiguration('gherkinPowerTools.behave.stepGlobs') || 
                e.affectsConfiguration('gherkinPowerTools.behave.ignoreGlobs')) {
                await rebuildDiscovery();
            }
        }
    }));
    
    // Listen to changes in project configuration files
    configWatcher.onDidChange(rebuildDiscovery);
    configWatcher.onDidCreate(rebuildDiscovery);
    configWatcher.onDidDelete(rebuildDiscovery);
    
    // Watch for changes in feature files to update tag statistics
    const featureWatcher = vscode.workspace.createFileSystemWatcher('**/*.feature');
    featureWatcher.onDidCreate(async uri => { await featureCache.updateFile(uri); });
    featureWatcher.onDidChange(async uri => { await featureCache.updateFile(uri); });
    featureWatcher.onDidDelete(uri => { featureCache.removeFile(uri); });
    context.subscriptions.push(featureWatcher);
    
    // Asynchronously trigger onboarding recommendation check
    showOnboardingNotificationIfNeeded(context, configService).catch(err => {
        logger.error(`Error checking onboarding notification: ${err}`);
    });
    
    // Register the context menu command to format the document
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.format', () => {
            vscode.commands.executeCommand('editor.action.formatDocument');
        })
    );

    // Register the statistics dashboard command
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.showStatistics', () => {
            showStatisticsDashboard(context);
        })
    );

    // Register the custom command for creating step definitions
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.createStepDefinition', createStepDefinition)
    );

    // Register Command Center
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.commandCenter', showCommandCenter)
    );

    // Register Behave execution commands
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.runFeature', (uri?: vscode.Uri) => {
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (finalUri) runBehave(finalUri, undefined, configService);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.runScenario', (uri?: vscode.Uri, line?: number) => {
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            const finalLine = line !== undefined ? line : vscode.window.activeTextEditor?.selection.active.line;
            if (finalUri) runBehave(finalUri, finalLine, configService);
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
            if (finalUri) debugBehave(finalUri, finalLine, configService);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.debugFeature', (uri?: vscode.Uri) => {
            const finalUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (finalUri) debugBehave(finalUri, undefined, configService);
        })
    );

    // Register the workspace diagnostic command
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinPowerTools.diagnoseWorkspace', () => {
            return showDiagnosticsReport(context, symbolCache, featureCache, configService);
        })
    );
    
    context.subscriptions.push(linter);


    const highlighter = new GherkinHighlighter();
    context.subscriptions.push(highlighter);

    // Initial lint & highlight for all open feature files
    vscode.workspace.textDocuments.forEach(doc => {
        linter.immediateLint(doc);
    });
    if (vscode.window.activeTextEditor) {
        highlighter.highlight(vscode.window.activeTextEditor);
    }

    // On file open or active editor change
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                highlighter.highlight(editor);
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            linter.immediateLint(doc);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(doc => {
            linter.immediateLint(doc);
        })
    );

    // On text change
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
            linter.scheduleLint(e.document);
            if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
                highlighter.highlight(vscode.window.activeTextEditor);
            }
        })
    );

    // Clear on close
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(doc => linter.clear(doc))
    );

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
                new GherkinCompletionProvider(symbolCache),
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
            vscode.languages.registerCodeLensProvider(
                { language },
                new BehaveCodeLensProvider()
            )
        );
    });
}

/**
 * Deactivates the Gherkin PowerTools extension.
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
    discoveryService.disposeWatchers();
}
