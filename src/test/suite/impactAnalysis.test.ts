import * as assert from 'assert';
import { WorkspaceGraph, FeatureNode, ScenarioNode, StepNode, StepDefNode } from '../../graph';
import { SymbolCache } from '../../cache';
import { ImpactAnalyzer } from '../../impactAnalysis';

suite('Impact Analysis Test Suite', () => {
    let graph: WorkspaceGraph;
    let symbolCache: SymbolCache;
    let analyzer: ImpactAnalyzer;

    setup(() => {
        symbolCache = new SymbolCache();
        graph = new WorkspaceGraph(symbolCache);
        analyzer = new ImpactAnalyzer(graph);
    });

    teardown(() => {
        graph.dispose();
        symbolCache.dispose();
    });

    test('calculateImpact should return correct counts and severity for low impact', () => {
        // Mock graph nodes
        const defNode: StepDefNode = { id: 'def1', type: 'StepDefinition', uri: 'file:///steps.py', line: 10, pattern: 'test', matcherType: 'given', pythonFile: 'file:///steps.py', usages: ['step1', 'step2'] };
        const featureNode: FeatureNode = { id: 'f1', type: 'Feature', uri: 'file:///test.feature', line: 1, children: ['s1'], tags: [], name: 'Feature 1' };
        const scNode1: ScenarioNode = { id: 's1', type: 'Scenario', uri: 'file:///test.feature', line: 5, steps: ['step1'], examples: [], tags: [], parent: 'f1', name: 'Scenario 1' };
        const scNode2: ScenarioNode = { id: 's2', type: 'Scenario', uri: 'file:///test.feature', line: 10, steps: ['step2'], examples: [], tags: [], parent: 'f1', name: 'Scenario 2' };
        
        const step1: StepNode = { id: 'step1', type: 'Step', uri: 'file:///test.feature', line: 6, text: 'test', parent: 's1', keyword: 'Given', definitionId: 'def1' };
        const step2: StepNode = { id: 'step2', type: 'Step', uri: 'file:///test.feature', line: 11, text: 'test', parent: 's2', keyword: 'Given', definitionId: 'def1' };

        // Inject directly into private nodes map for testing
        graph.setNodeForTest(defNode as any);
        graph.setNodeForTest(featureNode as any);
        graph.setNodeForTest(scNode1 as any);
        graph.setNodeForTest(scNode2 as any);
        graph.setNodeForTest(step1 as any);
        graph.setNodeForTest(step2 as any);

        const report = analyzer.calculateImpact('def1');
        assert.strictEqual(report.affectedFeatures, 1);
        assert.strictEqual(report.affectedScenarios, 2);
        assert.strictEqual(report.severity, 'Low');
    });

    test('calculateImpact should handle missing parents gracefully', () => {
        const defNode: StepDefNode = { id: 'def1', type: 'StepDefinition', uri: 'file:///steps.py', line: 10, pattern: 'test', matcherType: 'given', pythonFile: 'file:///steps.py', usages: ['step1'] };
        const step1: StepNode = { id: 'step1', type: 'Step', uri: 'file:///test.feature', line: 6, text: 'test', parent: 's1', keyword: 'Given', definitionId: 'def1' };

        graph.setNodeForTest(defNode as any);
        graph.setNodeForTest(step1 as any); // parent s1 does not exist in graph

        const report = analyzer.calculateImpact('def1');
        assert.strictEqual(report.affectedFeatures, 0);
        assert.strictEqual(report.affectedScenarios, 0);
        assert.strictEqual(report.severity, 'Low');
    });

    test('Performance Benchmark: Impact Analyzer 1000 usages', () => {
        const defNode: StepDefNode = { id: 'def1', type: 'StepDefinition', uri: 'file:///steps.py', line: 10, pattern: 'test', matcherType: 'given', pythonFile: 'file:///steps.py', usages: [] };
        graph.setNodeForTest(defNode as any);

        const featureNode: FeatureNode = { id: 'f1', type: 'Feature', uri: 'file:///test.feature', line: 1, children: [], tags: [], name: 'Feature 1' };
        graph.setNodeForTest(featureNode as any);

        // Generate 1000 usages across 1000 scenarios
        for (let i = 0; i < 1000; i++) {
            const scId = `s${i}`;
            const stepId = `step${i}`;
            
            const scNode: ScenarioNode = { id: scId, type: 'Scenario', uri: 'file:///test.feature', line: i * 5, steps: [stepId], examples: [], tags: [], parent: 'f1', name: `Scenario ${i}` };
            const stepNode: StepNode = { id: stepId, type: 'Step', uri: 'file:///test.feature', line: i * 5 + 1, text: 'test', parent: scId, keyword: 'Given', definitionId: 'def1' };
            
            graph.setNodeForTest(scNode as any);
            graph.setNodeForTest(stepNode as any);
            defNode.usages.push(stepId);
        }

        const start = process.hrtime.bigint();
        const report = analyzer.calculateImpact('def1');
        const end = process.hrtime.bigint();
        
        const durationMs = Number(end - start) / 1000000;
        
        assert.strictEqual(report.affectedScenarios, 1000);
        assert.strictEqual(report.severity, 'High');
        assert.ok(durationMs < 50, `Impact calculation took too long: ${durationMs}ms`);
    });

    test('calculateImpact should resolve scenarios under Feature when step is in Background', () => {
        const defNode: StepDefNode = { id: 'def1', type: 'StepDefinition', uri: 'file:///steps.py', line: 10, pattern: 'test', matcherType: 'given', pythonFile: 'file:///steps.py', usages: ['bg_step1'] };
        const featureNode: FeatureNode = { id: 'f1', type: 'Feature', uri: 'file:///test.feature', line: 1, children: ['bg1', 's1', 's2'], tags: [], name: 'Feature 1' };
        
        const bgNode: any = { id: 'bg1', type: 'Background', uri: 'file:///test.feature', line: 3, steps: ['bg_step1'], parent: 'f1' };
        const scNode1: ScenarioNode = { id: 's1', type: 'Scenario', uri: 'file:///test.feature', line: 5, steps: [], examples: [], tags: [], parent: 'f1', name: 'Scenario 1' };
        const scNode2: ScenarioNode = { id: 's2', type: 'Scenario', uri: 'file:///test.feature', line: 10, steps: [], examples: [], tags: [], parent: 'f1', name: 'Scenario 2' };
        
        const bgStep1: StepNode = { id: 'bg_step1', type: 'Step', uri: 'file:///test.feature', line: 4, text: 'test', parent: 'bg1', keyword: 'Given', definitionId: 'def1' };

        graph.setNodeForTest(defNode as any);
        graph.setNodeForTest(featureNode as any);
        graph.setNodeForTest(bgNode as any);
        graph.setNodeForTest(scNode1 as any);
        graph.setNodeForTest(scNode2 as any);
        graph.setNodeForTest(bgStep1 as any);

        const report = analyzer.calculateImpact('def1');
        assert.strictEqual(report.affectedFeatures, 1);
        assert.strictEqual(report.affectedScenarios, 2);
        assert.strictEqual(report.scenarios.length, 2);
        assert.strictEqual(report.severity, 'Low');
    });
});
