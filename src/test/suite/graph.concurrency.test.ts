import * as assert from 'assert';

import { WorkspaceGraph } from '../../graph';
import { SymbolCache } from '../../cache';

suite('WorkspaceGraph Concurrency and Isolation Test Suite', () => {
    let symbolCache: SymbolCache;
    let graph: WorkspaceGraph;

    setup(() => {
        symbolCache = new SymbolCache();
        graph = new WorkspaceGraph(symbolCache);
    });

    test('Concurrent transactions queue and resolve cleanly', async () => {
        const uriStr = 'file:///test/concurrent.feature';
        
        let tx1Started = false;
        let tx2Started = false;

        // Mock updateRequests to always return the reqId so we don't drop the transaction
        const originalGet = graph['updateRequests'].get.bind(graph['updateRequests']);
        graph['updateRequests'].get = (key: string) => {
            if (key === uriStr) return tx1Started ? 2 : 1;
            return originalGet(key);
        };

        const p1 = graph.executeTransaction(1, uriStr, async (tx) => {
            tx1Started = true;
            tx.setNode({ id: 'node1', type: 'Feature', uri: uriStr, line: 1 } as any);
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        const p2 = graph.executeTransaction(2, uriStr, async (tx) => {
            // p2 should not start until p1 releases the mutex
            assert.ok(tx1Started, 'Tx1 should have started before Tx2');
            tx2Started = true;
            tx.setNode({ id: 'node2', type: 'Feature', uri: uriStr, line: 2 } as any);
        });

        await Promise.all([p1, p2]);

        assert.ok(tx1Started);
        assert.ok(tx2Started);
        
        const nodes = graph.currentGeneration.getAllNodes();
        assert.strictEqual(nodes.length, 2);
    });

    test('Structural sharing: old generation remains immutable', async () => {
        const uriStr = 'file:///test/immutability.feature';
        
        graph['updateRequests'].set(uriStr, 1);
        await graph.executeTransaction(1, uriStr, async (tx) => {
            tx.setNode({ id: 'node1', type: 'Feature', uri: uriStr, line: 1 } as any);
        });

        const gen1 = graph.currentGeneration;
        assert.strictEqual(gen1.version, 1);
        assert.strictEqual(gen1.getAllNodes().length, 1);

        graph['updateRequests'].set(uriStr, 2);
        await graph.executeTransaction(2, uriStr, async (tx) => {
            tx.setNode({ id: 'node2', type: 'Feature', uri: uriStr, line: 2 } as any);
        });

        const gen2 = graph.currentGeneration;
        assert.strictEqual(gen2.version, 2);
        assert.strictEqual(gen2.getAllNodes().length, 2);
        
        // gen1 should remain unchanged
        assert.strictEqual(gen1.getAllNodes().length, 1, 'Generation 1 should be immutable');
        assert.ok(!gen1.getNode('node2'));
    });

    test('Obsolete update requests are discarded', async () => {
        const uriStr = 'file:///test/obsolete.feature';
        
        // Simulating sequence where req2 is issued after req1 but req1 executes slowly.
        
        graph['updateRequests'].set(uriStr, 2);

        await graph.executeTransaction(1, uriStr, async (tx) => {
            tx.setNode({ id: 'node1', type: 'Feature', uri: uriStr, line: 1 } as any);
        });

        // The transaction for req1 should have been dropped because req2 is pending
        assert.strictEqual(graph.currentGeneration.version, 0);
        assert.strictEqual(graph.currentGeneration.getAllNodes().length, 0);
    });

    test('Failed transaction does not commit', async () => {
        const uriStr = 'file:///test/failure.feature';
        
        graph['updateRequests'].set(uriStr, 1);
        await graph.executeTransaction(1, uriStr, async (tx) => {
            tx.setNode({ id: 'node1', type: 'Feature', uri: uriStr, line: 1 } as any);
        });
        
        const genBefore = graph.currentGeneration;
        
        try {
            graph['updateRequests'].set(uriStr, 2);
            await graph.executeTransaction(2, uriStr, async (tx) => {
                tx.setNode({ id: 'node2', type: 'Feature', uri: uriStr, line: 2 } as any);
                throw new Error('Simulated failure');
            });
        } catch (e) {
            // expected
        }

        // Graph should not advance version or include node2
        assert.strictEqual(graph.currentGeneration.version, 1);
        assert.strictEqual(graph.currentGeneration, genBefore);
        assert.strictEqual(graph.currentGeneration.getAllNodes().length, 1);
        assert.ok(!graph.currentGeneration.getNode('node2'));
    });
});
