import * as assert from 'assert';
import * as vscode from 'vscode';
import { WorkspaceGraph } from '../../graph';
import { SymbolCache } from '../../cache';
import { WorkspaceEventBus } from '../../eventBus';

suite('Completion Intelligence Test Suite', () => {
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

    test('Relaxed ambiguity policy: Ambiguous steps contribute usage to all candidates', async () => {
        const featureUri = 'file:///project/test.feature';
        const pythonUri1 = 'file:///project/steps1.py';
        const pythonUri2 = 'file:///project/steps2.py';

        // 1. Mock symbol cache to return 2 definitions for the ambiguous step
        symbolCache.getStepDefinitions = async (text: string) => {
            if (text === 'I am ambiguous') {
                return [
                    { uri: vscode.Uri.parse(pythonUri1), decoratorRange: new vscode.Range(10, 0, 10, 0) } as any,
                    { uri: vscode.Uri.parse(pythonUri2), decoratorRange: new vscode.Range(20, 0, 20, 0) } as any
                ];
            } else if (text === 'I am unambiguous') {
                return [
                    { uri: vscode.Uri.parse(pythonUri1), decoratorRange: new vscode.Range(15, 0, 15, 0) } as any
                ];
            }
            return [];
        };

        const tx = {
            nodes: new Map<string, any>(),
            unresolvedSteps: new Set<string>(),
            uriToNodes: new Map<string, Set<string>>(),
            setNode(n: any) { this.nodes.set(n.id, n); },
            getNodeForMutation(id: string) { return this.nodes.get(id); }
        };

        const step1 = {
            id: 'Step:1',
            type: 'Step',
            text: 'I am ambiguous',
            parent: 'sc1',
            keyword: 'Given',
            uri: featureUri
        };

        const step2 = {
            id: 'Step:2',
            type: 'Step',
            text: 'I am unambiguous',
            parent: 'sc1',
            keyword: 'When',
            uri: featureUri
        };

        tx.setNode(step1);
        tx.setNode(step2);

        tx.setNode({
            id: 'file:///project/steps1.py:10',
            type: 'StepDefinition',
            pattern: 'I am ambiguous',
            usages: [],
            uri: pythonUri1
        });

        tx.setNode({
            id: 'file:///project/steps2.py:20',
            type: 'StepDefinition',
            pattern: 'I am ambiguous',
            usages: [],
            uri: pythonUri2
        });

        tx.setNode({
            id: 'file:///project/steps1.py:15',
            type: 'StepDefinition',
            pattern: 'I am unambiguous',
            usages: [],
            uri: pythonUri1
        });

        await (graph as any).resolveStepDefinitionTx(tx, step1);
        await (graph as any).resolveStepDefinitionTx(tx, step2);

        // Verify ambiguous step
        assert.strictEqual((step1 as any).definitionId, undefined, 'Ambiguous step should not have a definitionId');
        assert.strictEqual((step1 as any).ambiguousCandidates?.length, 2, 'Ambiguous step should track candidates');
        
        const ambiguousDef1 = tx.nodes.get('file:///project/steps1.py:10');
        const ambiguousDef2 = tx.nodes.get('file:///project/steps2.py:20');
        assert.strictEqual(ambiguousDef1.usages.length, 1, 'Ambiguous definition 1 should have 1 usage');
        assert.strictEqual(ambiguousDef2.usages.length, 1, 'Ambiguous definition 2 should have 1 usage');
        assert.strictEqual(ambiguousDef1.usages[0], 'Step:1', 'Ambiguous definition 1 usage should point to step');
        assert.strictEqual(ambiguousDef2.usages[0], 'Step:1', 'Ambiguous definition 2 usage should point to step');

        // Verify unambiguous step
        assert.strictEqual((step2 as any).definitionId, 'file:///project/steps1.py:15', 'Unambiguous step should have correct definitionId');
        assert.strictEqual((step2 as any).ambiguousCandidates, undefined, 'Unambiguous step should have no candidates');

        const unambiguousDef = tx.nodes.get('file:///project/steps1.py:15');
        assert.strictEqual(unambiguousDef.usages.length, 1, 'Unambiguous definition should have 1 usage');
        assert.strictEqual(unambiguousDef.usages[0], 'Step:2', 'Unambiguous definition usage should point to step');
    });
});
