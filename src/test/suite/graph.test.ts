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

    test('indexFeatureFile handles AST with Rule, Background, and Scenario with tags', async () => {
        const uri = require('vscode').Uri.parse('file:///rule.feature');
        const mockAST = {
            feature: {
                location: { line: 1 },
                name: 'Test Feature',
                tags: [{ name: '@feature' }],
                children: [
                    {
                        rule: {
                            location: { line: 3 },
                            name: 'Test Rule',
                            tags: [{ name: '@rule' }],
                            children: [
                                {
                                    background: {
                                        location: { line: 5 },
                                        steps: [{ location: { line: 6 }, keyword: 'Given', text: 'bg step' }]
                                    }
                                },
                                {
                                    scenario: {
                                        location: { line: 8 },
                                        name: 'Rule Scenario',
                                        tags: [{ name: '@scenario' }],
                                        steps: [{ location: { line: 9 }, keyword: 'When', text: 'scen step' }],
                                        examples: [
                                            { location: { line: 11 }, name: 'Ex1', tags: [{ name: '@ex' }] }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        };
        symbolCache.getFeatureAST = async () => mockAST as any;
        await (graph as any).indexFeatureFile(uri);

        const nodes = graph.getAllNodes();
        const ruleNode = nodes.find(n => n.type === 'Rule');
        assert.ok(ruleNode, 'Should create Rule node');
        assert.strictEqual((ruleNode as any).tags[0], '@rule');

        const bgNode = nodes.find(n => n.type === 'Background');
        assert.ok(bgNode, 'Should create Background node');

        const scNode = nodes.find(n => n.type === 'Scenario');
        assert.ok(scNode, 'Should create Scenario node');
        assert.ok((scNode as any).tags.includes('@scenario'));

        const exNode = nodes.find(n => n.type === 'Example');
        assert.ok(exNode, 'Should create Example node');

        const tagNode = nodes.find(n => n.type === 'Tag' && n.id === 'Tag:@rule');
        assert.ok(tagNode, 'Should create Tag node for @rule');
        assert.ok((tagNode as any).targets.includes(scNode.id), 'Tag node should target scenario inside rule');
    });

    test('indexFeatureFile handles AST errors gracefully', async () => {
        const uri = require('vscode').Uri.parse('file:///error.feature');
        symbolCache.getFeatureAST = async () => { throw new Error('Parse error'); };
        await (graph as any).indexFeatureFile(uri);
        // Should not throw, should just log and exit
        assert.ok(true);
    });

    test('indexPythonFile handles file with no definitions', async () => {
        const uri = require('vscode').Uri.parse('file:///empty.py');
        symbolCache.getAllStepDefinitions = async () => [];
        await (graph as any).indexPythonFile(uri);
        
        const nodes = graph.getAllNodes();
        const pyNodes = nodes.filter(n => n.uri === uri.toString());
        assert.strictEqual(pyNodes.length, 0, 'Should not create nodes for empty python file');
    });
});
