import * as vscode from 'vscode';
import { logger } from './logger';

export type CapabilityState = 'pending' | 'running' | 'ready' | 'failed' | 'cancelled';
export type CapabilityCriticality = 'essential' | 'optional' | 'dependent';

export interface CapabilityStatus {
    id: string;
    criticality: CapabilityCriticality;
    state: CapabilityState;
    error?: string;
    retryCount: number;
}

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
    featureDiscoveryService: { setupWatchers: () => vscode.Disposable[] };
}

export class DeferredBootstrap implements vscode.Disposable {
    private timeoutHandle?: NodeJS.Timeout;
    private cts?: vscode.CancellationTokenSource;
    private subscriptions: vscode.Disposable[] = [];
    public state: 'idle' | 'waiting' | 'running' | 'finished' | 'disposed' = 'idle';

    private capabilities: Map<string, CapabilityStatus> = new Map([
        ['watchers', { id: 'watchers', criticality: 'essential', state: 'pending', retryCount: 0 }],
        ['eventBusListeners', { id: 'eventBusListeners', criticality: 'essential', state: 'pending', retryCount: 0 }],
        ['symbolCache', { id: 'symbolCache', criticality: 'essential', state: 'pending', retryCount: 0 }],
        ['workspaceGraph', { id: 'workspaceGraph', criticality: 'dependent', state: 'pending', retryCount: 0 }],
        ['featureCache', { id: 'featureCache', criticality: 'optional', state: 'pending', retryCount: 0 }],
        ['usageIndexer', { id: 'usageIndexer', criticality: 'optional', state: 'pending', retryCount: 0 }],
        ['impactCodeLens', { id: 'impactCodeLens', criticality: 'dependent', state: 'pending', retryCount: 0 }]
    ]);

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
            if (token.isCancellationRequested) return;
            this.state = 'running';
            logger.debug('DeferredBootstrap: Starting lazy initialization of services');

            // Wire up synchronous/essential watchers immediately
            this.initWatchers(token);
            this.initEventBusListeners(token);

            // Start asynchronous initializations concurrently but safely isolated
            const initTasks = [
                this.runWithRetry('symbolCache', () => this.components.symbolCache.ensureInitialized(), token)
                    .then(success => {
                        if (success && !token.isCancellationRequested) {
                            return this.runWithRetry('workspaceGraph', () => this.components.workspaceGraph.initialize(), token)
                                .then(graphSuccess => {
                                    if (graphSuccess && !token.isCancellationRequested) {
                                        this.initImpactCodeLens(token);
                                    } else {
                                        this.markCancelledOrFailed('impactCodeLens', token, 'Dependency workspaceGraph failed');
                                    }
                                });
                        } else {
                            this.markCancelledOrFailed('workspaceGraph', token, 'Dependency symbolCache failed');
                            this.markCancelledOrFailed('impactCodeLens', token, 'Dependency workspaceGraph failed');
                        }
                    }),
                this.runWithRetry('featureCache', () => this.components.featureCache.ensureInitialized(), token),
                this.runWithRetry('usageIndexer', () => this.components.usageIndexer.indexWorkspace(), token)
            ];

            await Promise.allSettled(initTasks);

            if (token.isCancellationRequested) {
                logger.debug('DeferredBootstrap: Cancelled during initialization wait');
                return;
            }

            this.state = 'finished';
            logger.debug('DeferredBootstrap: Initialization completed');
        }, this.delayMs);
    }

    private markCancelledOrFailed(id: string, token: vscode.CancellationToken, reason: string) {
        const cap = this.capabilities.get(id);
        if (cap && cap.state === 'pending') {
            cap.state = token.isCancellationRequested ? 'cancelled' : 'failed';
            cap.error = reason;
        }
    }

    private initWatchers(token: vscode.CancellationToken) {
        if (token.isCancellationRequested) return;
        const cap = this.capabilities.get('watchers')!;
        cap.state = 'running';
        try {
            const serviceWatchers = this.components.discoveryService.setupWatchers();
            serviceWatchers.forEach(w => this.subscriptions.push(w));

            const featureWatchers = this.components.featureDiscoveryService.setupWatchers();
            featureWatchers.forEach(w => this.subscriptions.push(w));

            if (!token.isCancellationRequested) {
                cap.state = 'ready';
            } else {
                cap.state = 'cancelled';
            }
        } catch (e: any) {
            cap.state = 'failed';
            cap.error = e.message || e.toString();
            logger.error(`DeferredBootstrap: Watchers failed: ${cap.error}`);
        }
    }

    private initEventBusListeners(token: vscode.CancellationToken) {
        if (token.isCancellationRequested) return;
        const cap = this.capabilities.get('eventBusListeners')!;
        cap.state = 'running';
        try {
            this.subscriptions.push(this.components.eventBus.onEvent(e => {
                if (['featureFileCreated', 'featureFileChanged', 'featureFileDeleted', 'stepFileCreated', 'stepDefinitionsUpdated', 'stepFileDeleted'].includes(e.type)) {
                    this.components.impactCodeLensProvider.refresh();
                }
            }));
            if (!token.isCancellationRequested) {
                cap.state = 'ready';
            } else {
                cap.state = 'cancelled';
            }
        } catch (e: any) {
            cap.state = 'failed';
            cap.error = e.message || e.toString();
            logger.error(`DeferredBootstrap: Event bus listeners failed: ${cap.error}`);
        }
    }

    private initImpactCodeLens(token: vscode.CancellationToken) {
        if (token.isCancellationRequested) {
            this.markCancelledOrFailed('impactCodeLens', token, 'Cancelled');
            return;
        }
        const cap = this.capabilities.get('impactCodeLens')!;
        cap.state = 'running';
        try {
            this.components.impactCodeLensProvider.refresh();
            if (!token.isCancellationRequested) {
                cap.state = 'ready';
            } else {
                cap.state = 'cancelled';
            }
        } catch (e: any) {
            cap.state = 'failed';
            cap.error = e.message || e.toString();
            logger.error(`DeferredBootstrap: Impact CodeLens failed: ${cap.error}`);
        }
    }

    private async runWithRetry(id: string, task: () => Promise<void>, token: vscode.CancellationToken, maxRetries = 3): Promise<boolean> {
        const cap = this.capabilities.get(id)!;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (token.isCancellationRequested) {
                cap.state = 'cancelled';
                return false;
            }

            cap.state = 'running';
            cap.retryCount = attempt - 1;

            try {
                await task();

                if (token.isCancellationRequested) {
                    cap.state = 'cancelled';
                    return false;
                }

                cap.state = 'ready';
                cap.error = undefined;
                return true;
            } catch (e: any) {
                cap.error = e.message || e.toString();
                logger.debug(`DeferredBootstrap: ${id} failed (attempt ${attempt}/${maxRetries}): ${cap.error}`);

                if (attempt < maxRetries && !token.isCancellationRequested) {
                    // Exponential backoff
                    const delay = Math.pow(2, attempt) * 10; // Fast for testing/UX
                    await new Promise(res => setTimeout(res, delay));
                } else {
                    if (!token.isCancellationRequested) {
                        cap.state = 'failed';
                        logger.error(`DeferredBootstrap: ${id} permanently failed after ${maxRetries} attempts.`);
                    } else {
                        cap.state = 'cancelled';
                    }
                    return false;
                }
            }
        }
        return false;
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

        // Mark remaining capabilities as cancelled
        for (const cap of this.capabilities.values()) {
            if (cap.state === 'pending' || cap.state === 'running') {
                cap.state = 'cancelled';
            }
        }

        logger.debug('DeferredBootstrap: Disposed gracefully');
    }

    public getDiagnostics(): CapabilityStatus[] {
        return Array.from(this.capabilities.values());
    }
}
