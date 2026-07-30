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
});
