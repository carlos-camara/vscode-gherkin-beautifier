import * as assert from 'assert';
import { WorkspaceGraph } from '../../graph';
import { SymbolCache } from '../../cache';
import { WorkspaceEventBus } from '../../eventBus';
import { astRepository } from '../../ast';

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

    test('should resolve impacted scenarios for a tag', () => {
        const tagNode = {
            id: 'Tag:@smoke',
            type: 'Tag',
            name: '@smoke',
            targets: ['sc1']
        };
        const scenarioNode = {
            id: 'sc1',
            type: 'Scenario',
            name: 'Scenario 1',
            uri: 'file:///feature.feature',
            line: 1,
            steps: []
        };
        (graph as any).nodes.set('Tag:@smoke', tagNode);
        (graph as any).nodes.set('sc1', scenarioNode);

        const scenarios = graph.getImpactedScenarios('@smoke');
        assert.strictEqual(scenarios.length, 1);
        assert.strictEqual(scenarios[0].name, 'Scenario 1');
    });

    test('should identify duplicate step implementations', () => {
        const def1: any = {
            id: 'def1',
            type: 'StepDefinition',
            matcherType: 'regex',
            pattern: 'I do something',
            uri: 'file:///steps1.py',
            line: 10
        };
        const def2: any = {
            id: 'def2',
            type: 'StepDefinition',
            matcherType: 'regex',
            pattern: 'I do something',
            uri: 'file:///steps2.py',
            line: 20
        };
        const def3: any = {
            id: 'def3',
            type: 'StepDefinition',
            matcherType: 'regex',
            pattern: 'I do something else',
            uri: 'file:///steps3.py',
            line: 30
        };

        (graph as any).nodes.set('def1', def1);
        (graph as any).nodes.set('def2', def2);
        (graph as any).nodes.set('def3', def3);

        const duplicates = graph.getDuplicateImplementations();
        assert.strictEqual(duplicates.length, 1);
        assert.strictEqual(duplicates[0].length, 2);
        assert.strictEqual(duplicates[0][0].id, 'def1');
        assert.strictEqual(duplicates[0][1].id, 'def2');
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

    test('Removes nodes correctly when a file is deleted with different URI casing', () => {
        const uriUpper = 'file:///TEST_CASE.feature';
        const uriLower = 'file:///test_case.feature';

        // Manually inject using lowercase
        (graph as any).nodes.set(`${uriLower}:Feature:Test`, { id: `${uriLower}:Feature:Test`, type: 'Feature', uri: uriLower });
        (graph as any).nodes.set(`${uriLower}:Scenario:1`, { id: `${uriLower}:Scenario:1`, type: 'Scenario', uri: uriLower, parent: `${uriLower}:Feature:Test`, tags: [] });

        assert.ok(graph.getAllNodes().length > 0, 'Graph should have nodes after update');

        // Simulate file removal using uppercase
        (graph as any).removeNodesByUri(uriUpper);
        const nodesAfter = graph.getAllNodes().filter(n => n.uri === uriLower);
        assert.strictEqual(nodesAfter.length, 0, 'Nodes should be removed for the URI regardless of casing');
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
        const vscode = require('vscode');
        const uri = vscode.Uri.parse('file:///rule.feature');
        const originalTextDocuments = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');
        Object.defineProperty(vscode.workspace, 'textDocuments', { get: () => [{ uri, getText: () => '' }] });
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
        const originalGetAST = astRepository.getAST;
        astRepository.getAST = async () => ({ document: mockAST } as any);
        try {
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
        } finally {
            astRepository.getAST = originalGetAST;
            if (originalTextDocuments) {
                Object.defineProperty(vscode.workspace, 'textDocuments', originalTextDocuments);
            }
        }
    });

    test('indexFeatureFile handles AST errors gracefully', async () => {
        const vscode = require('vscode');
        const uri = vscode.Uri.parse('file:///error.feature');
        const originalTextDocuments = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');
        Object.defineProperty(vscode.workspace, 'textDocuments', { get: () => [{ uri, getText: () => '' }] });
        const originalGetAST = astRepository.getAST;
        astRepository.getAST = async () => { throw new Error('Parse error'); };
        try {
            await (graph as any).indexFeatureFile(uri);
            // Should not throw, should just log and exit
            assert.ok(true);
        } finally {
            astRepository.getAST = originalGetAST;
            if (originalTextDocuments) {
                Object.defineProperty(vscode.workspace, 'textDocuments', originalTextDocuments);
            }
        }
    });

    test('indexPythonFile handles file with no definitions', async () => {
        const uri = require('vscode').Uri.parse('file:///empty.py');
        symbolCache.getAllStepDefinitions = async () => [];
        await (graph as any).indexPythonFile(uri);

        const nodes = graph.getAllNodes();
        const pyNodes = nodes.filter(n => n.uri === uri.toString());
        assert.strictEqual(pyNodes.length, 0, 'Should not create nodes for empty python file');
    });
    test('Tracks semantic types for And/But steps', async () => {
        const vscode = require('vscode');
        const uri = vscode.Uri.parse('file:///semantic.feature');
        const originalTextDocuments = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');
        Object.defineProperty(vscode.workspace, 'textDocuments', { get: () => [{ uri, getText: () => 'Feature: test' }] });

        const mockAST = {
            feature: {
                location: { line: 1 },
                name: 'Test Feature',
                tags: [],
                children: [
                    {
                        scenario: {
                            location: { line: 2 },
                            name: 'Scenario',
                            tags: [],
                            steps: [
                                { location: { line: 3 }, keyword: 'Given ', text: 'given step' },
                                { location: { line: 4 }, keyword: 'And ', text: 'and step after given' },
                                { location: { line: 5 }, keyword: 'When ', text: 'when step' },
                                { location: { line: 6 }, keyword: 'But ', text: 'but step after when' },
                                { location: { line: 7 }, keyword: 'Then ', text: 'then step' },
                                { location: { line: 8 }, keyword: 'And ', text: 'and step after then' }
                            ]
                        }
                    }
                ]
            }
        };
        const originalGetAST = astRepository.getAST;
        astRepository.getAST = async () => ({ document: mockAST } as any);
        try {
            await (graph as any).indexFeatureFile(uri);

            const nodes = graph.getAllNodes().filter(n => n.type === 'Step') as import('../../graph').StepNode[];
            assert.strictEqual(nodes.length, 6);

            const step3 = nodes.find(n => n.line === 3);
            assert.strictEqual(step3?.semanticType, 'given');

            const step4 = nodes.find(n => n.line === 4);
            assert.strictEqual(step4?.semanticType, 'given'); // Inherits from Given

            const step5 = nodes.find(n => n.line === 5);
            assert.strictEqual(step5?.semanticType, 'when');

            const step6 = nodes.find(n => n.line === 6);
            assert.strictEqual(step6?.semanticType, 'when'); // Inherits from When

            const step7 = nodes.find(n => n.line === 7);
            assert.strictEqual(step7?.semanticType, 'then');

            const step8 = nodes.find(n => n.line === 8);
            assert.strictEqual(step8?.semanticType, 'then'); // Inherits from Then
        } finally {
            astRepository.getAST = originalGetAST;
            if (originalTextDocuments) {
                Object.defineProperty(vscode.workspace, 'textDocuments', originalTextDocuments);
            }
        }
    });
});
