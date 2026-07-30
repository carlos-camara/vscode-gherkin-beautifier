import * as assert from 'assert';
import { WorkspaceGraph } from '../../graph';
import { SymbolCache } from '../../cache';
import { WorkspaceEventBus } from '../../eventBus';

suite('WorkspaceGraph Test Suite', () => {
    let graph: WorkspaceGraph;
    let symbolCache: SymbolCache;
    let eventBus: WorkspaceEventBus;

    setup(() => {
        symbolCache = new SymbolCache();
        graph = new WorkspaceGraph(symbolCache);
        eventBus = new WorkspaceEventBus();
        graph.setEventBus(eventBus);
    });

    teardown(() => {
        graph.dispose();
        symbolCache.dispose();
        eventBus.dispose();
    });

    test('Graph should be empty initially', () => {
        const dups = graph.getDuplicateImplementations();
        assert.strictEqual(dups.length, 0);
    });

    test('getImpactedScenarios returns empty for non-existent tag', () => {
        const impacted = graph.getImpactedScenarios('Tag:@nonexistent');
        assert.strictEqual(impacted.length, 0);
    });

    test('getUsages returns empty for non-existent step definition', () => {
        const usages = graph.getUsages('nonexistent-id');
        assert.strictEqual(usages.length, 0);
    });

    test('getReferences returns undefined for non-existent step', () => {
        const ref = graph.getReferences('nonexistent-id');
        assert.strictEqual(ref, undefined);
    });

    test('Removes nodes correctly when a file is deleted', () => {
        const uri = 'file:///test.feature';
        
        // Manually inject some nodes to simulate parsing
        (graph as any).nodes.set(`${uri}:Feature:Test`, { id: `${uri}:Feature:Test`, type: 'Feature', uri });
        (graph as any).nodes.set(`${uri}:Scenario:1`, { id: `${uri}:Scenario:1`, type: 'Scenario', uri, parent: `${uri}:Feature:Test`, tags: [] });
        
        assert.ok(graph.getAllNodes().length > 0, 'Graph should have nodes after update');

        // Simulate file removal
        (graph as any).removeNodesByUri(uri);
        const nodesAfter = graph.getAllNodes().filter(n => n.uri === uri);
        assert.strictEqual(nodesAfter.length, 0, 'Nodes should be removed for the URI');
    });

    test('Handles cyclic or repeated updates gracefully', async () => {
        // Since we cannot mock AST safely here without complex setup, 
        // we test that dispose and remove don't crash and leave state clean
        const uri = 'file:///test.feature';
        (graph as any).nodes.set(`${uri}:Feature:Test`, { id: `${uri}:Feature:Test`, type: 'Feature', uri });
        
        const nodeCount1 = graph.getAllNodes().length;
        (graph as any).removeNodesByUri(uri);
        (graph as any).nodes.set(`${uri}:Feature:Test`, { id: `${uri}:Feature:Test`, type: 'Feature', uri });
        const nodeCount2 = graph.getAllNodes().length;

        assert.strictEqual(nodeCount1, nodeCount2, 'Node count should remain stable across replacement updates');
    });
});
