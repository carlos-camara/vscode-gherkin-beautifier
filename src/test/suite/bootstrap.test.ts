import * as assert from 'assert';
import * as vscode from 'vscode';
import { DeferredBootstrap, BootstrapComponents } from '../../bootstrap';


suite('DeferredBootstrap Test Suite', () => {
    let components: BootstrapComponents;
    let bootstrap: DeferredBootstrap;
    let disposables: vscode.Disposable[] = [];
    
    // Track calls to ensureInitialized / indexWorkspace / initialize
    let symbolCacheCalled = false;
    let featureCacheCalled = false;
    let usageIndexerCalled = false;
    let workspaceGraphCalled = false;
    let impactRefreshCalled = false;

    setup(() => {
        symbolCacheCalled = false;
        featureCacheCalled = false;
        usageIndexerCalled = false;
        workspaceGraphCalled = false;
        impactRefreshCalled = false;
        
        components = {
            symbolCache: { ensureInitialized: async () => { symbolCacheCalled = true; } },
            featureCache: { ensureInitialized: async () => { featureCacheCalled = true; } },
            usageIndexer: { indexWorkspace: async () => { usageIndexerCalled = true; } },
            workspaceGraph: { initialize: async () => { workspaceGraphCalled = true; } },
            impactCodeLensProvider: { refresh: () => { impactRefreshCalled = true; } },
            eventBus: {
                onEvent: () => {
                    const d = { dispose: () => {} };
                    disposables.push(d);
                    return d;
                },
                publish: () => {}
            },
            discoveryService: {
                setupWatchers: () => {
                    const d = { dispose: () => {} };
                    disposables.push(d);
                    return [d];
                }
            }
        };

        // Create with a small delay for testing
        bootstrap = new DeferredBootstrap(components, 50);
    });

    teardown(() => {
        bootstrap.dispose();
        disposables = [];
    });

    test('Normal delayed startup initializes all components', async () => {
        bootstrap.start();
        
        // Wait longer than the 50ms delay
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(symbolCacheCalled, true);
        assert.strictEqual(featureCacheCalled, true);
        assert.strictEqual(usageIndexerCalled, true);
        assert.strictEqual(workspaceGraphCalled, true);
        assert.strictEqual(impactRefreshCalled, true);
        
        // Should have created event listeners and watchers (at least 3 from our mocks + 1 file watcher)
        assert.ok((bootstrap as any).subscriptions.length > 0);
    });

    test('Deactivation before timeout prevents initialization', async () => {
        bootstrap.start();
        bootstrap.dispose(); // Immediate cancel
        
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(symbolCacheCalled, false);
        assert.strictEqual(featureCacheCalled, false);
        assert.strictEqual(impactRefreshCalled, false);
        assert.strictEqual((bootstrap as any).subscriptions.length, 0);
    });

    test('Deactivation while indexing prevents state mutation', async () => {
        // Slow down one of the components
        components.symbolCache.ensureInitialized = async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            symbolCacheCalled = true;
        };

        bootstrap.start();
        
        // Wait for the timeout to trigger, but not for the initialization to finish
        await new Promise(resolve => setTimeout(resolve, 60));
        
        // Dispose while initialization is running
        bootstrap.dispose();
        
        // Wait for the slow initialization to finish
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(symbolCacheCalled, true); // It ran, but we should not have refreshed or wired up watchers
        assert.strictEqual(impactRefreshCalled, false);
        assert.strictEqual((bootstrap as any).subscriptions.length, 0);
    });

    test('One failed service halts initialization safely', async () => {
        components.workspaceGraph.initialize = async () => {
            workspaceGraphCalled = true;
            throw new Error("Failed to load graph");
        };

        bootstrap.start();
        
        await new Promise(resolve => setTimeout(resolve, 100));

        assert.strictEqual(symbolCacheCalled, true);
        assert.strictEqual(workspaceGraphCalled, true);
        assert.strictEqual(impactRefreshCalled, false); // Should not proceed to refresh
        assert.strictEqual((bootstrap as any).subscriptions.length, 0); // Watchers should not be wired up or should be cleaned up
    });

    test('Repeated activation does not run twice', async () => {
        bootstrap.start();
        bootstrap.start(); // Second call should be ignored

        assert.strictEqual((bootstrap as any).state, 'waiting');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        assert.strictEqual((bootstrap as any).state, 'finished');
        assert.strictEqual(symbolCacheCalled, true);
        
        // Calling start after finished should do nothing
        bootstrap.start();
        assert.strictEqual((bootstrap as any).state, 'finished');
    });

    test('Watcher and Subscription disposal', async () => {
        bootstrap.start();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const subsLength = (bootstrap as any).subscriptions.length;
        assert.ok(subsLength > 0);
        
        bootstrap.dispose();
        assert.strictEqual((bootstrap as any).subscriptions.length, 0);
    });
});
