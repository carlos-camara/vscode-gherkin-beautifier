import * as assert from 'assert';
import { RecommendationEngine } from '../../recommendationEngine';
import { WorkspaceGraph } from '../../graph';
import { ProjectHealthMetrics } from '../../statistics';
import { SymbolCache } from '../../cache';

suite('Recommendation Engine Test Suite', () => {
    let engine: RecommendationEngine;
    let mockGraph: WorkspaceGraph;
    let symbolCache: SymbolCache;
    let baseMetrics: ProjectHealthMetrics;

    setup(() => {
        engine = new RecommendationEngine();
        symbolCache = new SymbolCache();
        mockGraph = new WorkspaceGraph(symbolCache);
        baseMetrics = {
            totalFiles: 1,
            totalFeatures: 1,
            totalScenarios: 1,
            totalBackgrounds: 0,
            totalSteps: 1,
            totalTags: 0,
            averageScenarioLength: 1,
            averageBackgroundLength: 0,
            undefinedSteps: [],
            tagFrequencies: [],
            stepAnalysis: {
                totalStepDefs: 1,
                unusedSteps: [],
                duplicatedSteps: [],
                ambiguousSteps: [],
                suspiciousSimilarities: []
            },
            scores: { complexity: 0, maintainability: 100, health: 100 },
            largestFeatures: [],
            largestScenarios: []
        };
    });

    test('Returns no recommendations for perfect health', () => {
        const recs = engine.generateRecommendations(mockGraph, baseMetrics);
        assert.strictEqual(recs.length, 0);
    });

    test('UndefinedStepsRule triggers on undefined steps', () => {
        const metrics = { ...baseMetrics, undefinedSteps: [
            { keyword: 'Given', text: 'I am undefined', uri: 'file:///test.feature', line: 1 } as any
        ]};
        const recs = engine.generateRecommendations(mockGraph, metrics);
        assert.strictEqual(recs.length, 1);
        assert.strictEqual(recs[0].title, 'Undefined Steps');
        assert.strictEqual(recs[0].severity, 'high');
        assert.strictEqual(recs[0].affectedItems?.length, 1);
        assert.strictEqual(recs[0].affectedItems![0].label, 'Step: Given I am undefined');
    });

    test('OversizedScenarioRule does not crash if graph is empty', () => {
        const recs = engine.generateRecommendations(mockGraph, baseMetrics);
        // It relies on graph.getNodesByType('example')
        assert.strictEqual(recs.length, 0);
    });

    // We can add mock nodes to mockGraph to test other rules if needed, 
    // but the engine logic mostly uses the metrics object now for step analysis.
    
    test('AmbiguousStepsRule triggers on ambiguous steps', () => {
        const metrics = { ...baseMetrics, stepAnalysis: {
            ...baseMetrics.stepAnalysis,
            ambiguousSteps: [
                {
                    step: { keyword: 'Given', text: 'conflict', uri: 'file.feature', line: 1 },
                    matchingDefs: [
                        { uri: 'def1.py', line: 1, text: '.*' },
                        { uri: 'def2.py', line: 1, text: 'conflict.*' }
                    ]
                }
            ]
        } as any};
        
        const recs = engine.generateRecommendations(mockGraph, metrics);
        assert.strictEqual(recs.length, 1);
        assert.strictEqual(recs[0].title, 'Ambiguous Steps in Feature Files');
        assert.strictEqual(recs[0].severity, 'high');
        assert.ok(recs[0].affectedItems![0].label.includes('Matches 2 defs'));
    });

    test('OversizedFeatureRule triggers when feature size > 20', () => {
        const metrics = { ...baseMetrics, largestFeatures: [
            { uri: 'file:///huge.feature', name: 'Huge Feature', size: 25 }
        ]};
        const recs = engine.generateRecommendations(mockGraph, metrics);
        const oversizedFeat = recs.find(r => r.title.startsWith('Oversized Feature'));
        assert.ok(oversizedFeat);
        assert.strictEqual(oversizedFeat.severity, 'medium');
        assert.ok(oversizedFeat.affectedFiles.includes('file:///huge.feature'));
    });

    test('OversizedScenarioRule triggers when scenario size > 10', () => {
        const metrics = { ...baseMetrics, largestScenarios: [
            { uri: 'file:///huge.feature', name: 'Huge Scenario', size: 15 }
        ]};
        const recs = engine.generateRecommendations(mockGraph, metrics);
        const oversizedScen = recs.find(r => r.title.startsWith('Oversized Scenario'));
        assert.ok(oversizedScen);
        assert.strictEqual(oversizedScen.severity, 'high');
        assert.ok(oversizedScen.affectedFiles.includes('file:///huge.feature'));
    });

    test('DuplicatedStepsRule triggers when there are duplicated steps', () => {
        const metrics = { ...baseMetrics, stepAnalysis: {
            ...baseMetrics.stepAnalysis,
            duplicatedSteps: [
                {
                    pattern: 'duplicated',
                    stepDefs: [
                        { uri: 'file:///def1.py', line: 1 },
                        { uri: 'file:///def2.py', line: 5 }
                    ]
                }
            ]
        } as any};
        const recs = engine.generateRecommendations(mockGraph, metrics);
        const dupRec = recs.find(r => r.title === 'Duplicated Step Definitions');
        assert.ok(dupRec);
        assert.strictEqual(dupRec.severity, 'high');
        assert.strictEqual(dupRec.affectedItems?.length, 2);
    });

    test('UnusedStepsRule triggers when there are unused steps', () => {
        const metrics = { ...baseMetrics, stepAnalysis: {
            ...baseMetrics.stepAnalysis,
            unusedSteps: [
                { uri: 'file:///unused.py', line: 1, rawPattern: 'unused pattern' }
            ]
        } as any};
        const recs = engine.generateRecommendations(mockGraph, metrics);
        const unusedRec = recs.find(r => r.title === 'Unused Step Definitions');
        assert.ok(unusedRec);
        assert.strictEqual(unusedRec.severity, 'low');
        assert.strictEqual(unusedRec.affectedItems?.length, 1);
    });

    test('ExcessiveTagsRule triggers for scenario with > 5 tags', () => {
        // mockGraph needs a scenario node with 6 tags
        (mockGraph as any).nodes.set('scen1', {
            id: 'scen1', type: 'Scenario', uri: 'file:///tags.feature', tags: ['@t1', '@t2', '@t3', '@t4', '@t5', '@t6'], name: 'Tagged Scenario'
        });
        const recs = engine.generateRecommendations(mockGraph, baseMetrics);
        const tagRec = recs.find(r => r.title.startsWith('Excessive Tags on Scenario'));
        assert.ok(tagRec);
        assert.strictEqual(tagRec.severity, 'low');
        
        // Clean up
        (mockGraph as any).nodes.delete('scen1');
    });

    test('PoorMaintainabilityRule triggers when maintainability < 60', () => {
        const metrics = { ...baseMetrics, scores: { complexity: 0, maintainability: 50, health: 50 }};
        const recs = engine.generateRecommendations(mockGraph, metrics);
        const maintRec = recs.find(r => r.title === 'Poor Project Maintainability');
        assert.ok(maintRec);
        assert.strictEqual(maintRec.severity, 'medium');
    });

    test('InconsistentFormattingRule triggers for steps with trailing spaces', () => {
        (mockGraph as any).nodes.set('step1', {
            id: 'step1', type: 'Step', uri: 'file:///format.feature', text: 'Step with space '
        });
        const recs = engine.generateRecommendations(mockGraph, baseMetrics);
        const formatRec = recs.find(r => r.title === 'Inconsistent Formatting: Trailing Spaces');
        assert.ok(formatRec);
        assert.strictEqual(formatRec.severity, 'low');
        
        // Clean up
        (mockGraph as any).nodes.delete('step1');
    });
});
