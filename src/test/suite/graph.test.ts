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

    // Since WorkspaceGraph depends heavily on AstRepository and file system events,
    // comprehensive tests would require mocking those out or using real test fixtures.
    // Here we ensure the APIs are callable and don't throw.
});
