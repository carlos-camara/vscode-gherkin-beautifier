import * as assert from 'assert';
import * as vscode from 'vscode';
import { DeferredBootstrap, BootstrapComponents } from '../../bootstrap';


suite('DeferredBootstrap Test Suite', () => {
    let components: BootstrapComponents;
    let bootstrap: DeferredBootstrap;
    let disposables: vscode.Disposable[] = [];

    // Track calls to ensureInitialized / indexWorkspace / initialize
    let symbolCacheCalled = 0;
    let featureCacheCalled: number;
    let workspaceGraphCalled: number;
    let impactRefreshCalled = 0;
    let eventBusSubscribed = false;
    let watchersSetup = false;

    setup(() => {
        symbolCacheCalled = 0;
        featureCacheCalled = 0;
        workspaceGraphCalled = 0;
        impactRefreshCalled = 0;
        eventBusSubscribed = false;
        watchersSetup = false;

        components = {
            symbolCache: { ensureInitialized: async () => { symbolCacheCalled++; } },
            featureCache: { ensureInitialized: async () => { featureCacheCalled++; } },
            workspaceGraph: { initialize: async () => { workspaceGraphCalled++; } },
            impactCodeLensProvider: { refresh: () => { impactRefreshCalled++; } },
            eventBus: {
                onEvent: () => {
                    eventBusSubscribed = true;
                    const d = { dispose: () => {} };
                    disposables.push(d);
                    return d;
                },
                publish: () => {}
            },
            discoveryService: {
                setupWatchers: () => {
                    watchersSetup = true;
                    const d = { dispose: () => {} };
                    disposables.push(d);
                    return [d];
                }
            },
            featureDiscoveryService: {
                setupWatchers: () => {
                    const d = { dispose: () => {} };
                    disposables.push(d);
                    return [d];
                }
            }
        };

        // Create with a small delay for testing
        bootstrap = new DeferredBootstrap(components, 10);
    });

    teardown(() => {
        bootstrap.dispose();
        disposables = [];
    });

    test('Normal delayed startup initializes all components safely', async () => {
        bootstrap.start();

        // Wait longer than the delay
        await new Promise(resolve => setTimeout(resolve, 250));

        assert.strictEqual(symbolCacheCalled, 1);
        assert.strictEqual(workspaceGraphCalled, 1);
        assert.strictEqual(impactRefreshCalled, 1);
        assert.strictEqual(watchersSetup, true);
        assert.strictEqual(eventBusSubscribed, true);

        const diags = bootstrap.getDiagnostics();
        assert.strictEqual(diags.every(d => d.state === 'ready'), true);
        assert.strictEqual(bootstrap.state, 'finished');
    });

    test('Deactivation before timeout prevents initialization entirely', async () => {
        bootstrap.start();
        bootstrap.dispose(); // Immediate cancel

        await new Promise(resolve => setTimeout(resolve, 250));

        assert.strictEqual(symbolCacheCalled, 0);
        assert.strictEqual(watchersSetup, false);
        const diags = bootstrap.getDiagnostics();
        assert.strictEqual(diags.every(d => d.state === 'cancelled'), true);
    });

    test('Deactivation during initialization cancels tasks', async () => {
        components.symbolCache.ensureInitialized = async () => {
            symbolCacheCalled++;
            await new Promise(resolve => setTimeout(resolve, 50));
        };

        bootstrap.start();

        await new Promise(resolve => setTimeout(resolve, 20)); // wait for timeout to start task
        bootstrap.dispose();
        await new Promise(resolve => setTimeout(resolve, 80)); // wait for task to finish

        // symbolCache was started but workspaceGraph shouldn't be
        assert.strictEqual(symbolCacheCalled, 1);
        assert.strictEqual(workspaceGraphCalled, 0);

        const diags = bootstrap.getDiagnostics();
        const symbolCap = diags.find(d => d.id === 'symbolCache');
        assert.strictEqual(symbolCap?.state, 'cancelled');
        assert.strictEqual(bootstrap.state, 'disposed');
    });

    test('Single optional capability failure does not halt watchers', async () => {
        components.featureCache.ensureInitialized = async () => {
            featureCacheCalled++;
            throw new Error("Optional cache failed");
        };

        bootstrap.start();

        // Wait long enough for 3 retries (10ms * 2^x)
        await new Promise(resolve => setTimeout(resolve, 1000));

        assert.strictEqual(watchersSetup, true); // Essential watcher setup still works
        assert.strictEqual(symbolCacheCalled, 1);
        assert.strictEqual(featureCacheCalled, 3); // It retried 3 times!

        const diags = bootstrap.getDiagnostics();
        assert.strictEqual(diags.find(d => d.id === 'featureCache')?.state, 'failed');
        assert.strictEqual(diags.find(d => d.id === 'watchers')?.state, 'ready');
        assert.strictEqual(bootstrap.state, 'finished');
    });

    test('Single essential capability failure does not halt watchers', async () => {
        components.symbolCache.ensureInitialized = async () => {
            symbolCacheCalled++;
            throw new Error("Essential cache failed");
        };

        bootstrap.start();
        await new Promise(resolve => setTimeout(resolve, 1000));

        assert.strictEqual(watchersSetup, true); // Still set up!
        assert.strictEqual(symbolCacheCalled, 3); // Retried
        assert.strictEqual(workspaceGraphCalled, 0); // Dependent graph did NOT run!

        const diags = bootstrap.getDiagnostics();
        assert.strictEqual(diags.find(d => d.id === 'symbolCache')?.state, 'failed');
        assert.strictEqual(diags.find(d => d.id === 'workspaceGraph')?.state, 'failed'); // Marked failed because dependency failed
    });

    test('featureCache failure does not block other tasks', async () => {
        components.featureCache.ensureInitialized = async () => { throw new Error('fail'); };

        bootstrap.start();
        await new Promise(r => setTimeout(r, 1000));

        assert.strictEqual(bootstrap.state, 'finished');
    });

    test('Multiple simultaneous failures', async () => {
        components.symbolCache.ensureInitialized = async () => { throw new Error("B"); };

        bootstrap.start();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const diags = bootstrap.getDiagnostics();
        assert.strictEqual(diags.find(d => d.id === 'symbolCache')?.state, 'failed');
        assert.strictEqual(diags.find(d => d.id === 'workspaceGraph')?.state, 'failed');
        assert.strictEqual(diags.find(d => d.id === 'watchers')?.state, 'ready');
    });

    test('Retry mechanism recovers on 2nd attempt', async () => {
        components.symbolCache.ensureInitialized = async () => {
            symbolCacheCalled++;
            if (symbolCacheCalled === 1) {
                throw new Error("Flaky network");
            }
        };

        bootstrap.start();
        await new Promise(resolve => setTimeout(resolve, 1000));

        assert.strictEqual(symbolCacheCalled, 2);
        assert.strictEqual(workspaceGraphCalled, 1); // Recovered and proceeded!

        const diags = bootstrap.getDiagnostics();
        const sc = diags.find(d => d.id === 'symbolCache');
        assert.strictEqual(sc?.state, 'ready');
        assert.strictEqual(sc?.retryCount, 1);
    });

    test('Dispose is idempotent', () => {
        bootstrap.dispose();
        bootstrap.dispose();
        bootstrap.dispose();
        assert.strictEqual(bootstrap.state, 'disposed');
    });
});
