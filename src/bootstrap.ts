import * as vscode from 'vscode';
import { logger } from './logger';

export interface BootstrapComponents {
    symbolCache: { ensureInitialized: () => Promise<void> };
    featureCache: { ensureInitialized: () => Promise<void> };
    usageIndexer: { indexWorkspace: () => Promise<void> };
    workspaceGraph: { initialize: () => Promise<void> };
    impactCodeLensProvider: { refresh: () => void };
    eventBus: { 
        onEvent: (handler: (event: any) => void) => vscode.Disposable,
        publish: (event: any) => void 
    };
    discoveryService: { setupWatchers: () => vscode.Disposable[] };
}

export class DeferredBootstrap implements vscode.Disposable {
    private timeoutHandle?: NodeJS.Timeout;
    private cts?: vscode.CancellationTokenSource;
    private subscriptions: vscode.Disposable[] = [];
    private state: 'idle' | 'waiting' | 'running' | 'finished' | 'disposed' = 'idle';

    constructor(
        private components: BootstrapComponents,
        private delayMs: number = 2000
    ) {}

    public start(): void {
        if (this.state !== 'idle') {
            logger.debug('DeferredBootstrap: start() called but state is already ' + this.state);
            return;
        }
        
        this.state = 'waiting';
        this.cts = new vscode.CancellationTokenSource();
        const token = this.cts.token;

        this.timeoutHandle = setTimeout(async () => {
            if (token.isCancellationRequested) {
                return;
            }
            this.state = 'running';
            logger.debug('DeferredBootstrap: Starting lazy initialization of services');

            try {
                // Initialize all core caches concurrently
                await Promise.all([
                    this.components.symbolCache.ensureInitialized(),
                    this.components.featureCache.ensureInitialized(),
                    this.components.usageIndexer.indexWorkspace(),
                    this.components.workspaceGraph.initialize()
                ]);

                // Ensure we haven't been cancelled while awaiting initialization
                if (token.isCancellationRequested) {
                    logger.debug('DeferredBootstrap: Cancelled during initialization wait');
                    return;
                }

                // Refresh CodeLenses after initial graph build
                this.components.impactCodeLensProvider.refresh();

                // Wire up event listeners
                this.subscriptions.push(this.components.eventBus.onEvent(e => {
                    if (['featureFileCreated', 'featureFileChanged', 'featureFileDeleted', 'stepFileCreated', 'stepDefinitionsUpdated', 'stepFileDeleted'].includes(e.type)) {
                        this.components.impactCodeLensProvider.refresh();
                    }
                }));

                // Initialize service watchers
                const serviceWatchers = this.components.discoveryService.setupWatchers();
                serviceWatchers.forEach(w => this.subscriptions.push(w));

                // Initialize global feature file watcher
                const featureWatcher = vscode.workspace.createFileSystemWatcher('**/*.feature');
                featureWatcher.onDidCreate(uri => this.components.eventBus.publish({ type: 'featureFileCreated', uri }));
                featureWatcher.onDidChange(uri => this.components.eventBus.publish({ type: 'featureFileChanged', uri }));
                featureWatcher.onDidDelete(uri => this.components.eventBus.publish({ type: 'featureFileDeleted', uri }));
                this.subscriptions.push(featureWatcher);

                this.state = 'finished';
                logger.debug('DeferredBootstrap: Initialization completed successfully');
            } catch (err: any) {
                logger.error(`DeferredBootstrap: Partial initialization failed: ${err.message || err}`);
                // Safely clean up any watchers or subscriptions that were partially created
                this.cleanup();
            }
        }, this.delayMs);
    }

    private cleanup(): void {
        this.subscriptions.forEach(s => s.dispose());
        this.subscriptions = [];
    }

    public dispose(): void {
        if (this.state === 'disposed') return;
        this.state = 'disposed';
        
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = undefined;
        }
        
        if (this.cts) {
            this.cts.cancel();
            this.cts.dispose();
            this.cts = undefined;
        }
        
        this.cleanup();
        logger.debug('DeferredBootstrap: Disposed gracefully');
    }
}
