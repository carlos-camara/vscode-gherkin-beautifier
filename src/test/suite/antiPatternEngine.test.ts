import * as assert from 'assert';
import { AntiPatternEngine } from '../../antiPatternEngine';
import { WorkspaceGraph } from '../../graph';
import { ProjectHealthMetrics } from '../../statistics';
import { SymbolCache } from '../../cache';

suite('Anti-Pattern Engine Test Suite', () => {
    let engine: AntiPatternEngine;
    let mockGraph: WorkspaceGraph;
    let symbolCache: SymbolCache;
    let baseMetrics: ProjectHealthMetrics;
    const ruleConfig = {
        "oversized-scenario": "warning",
        "oversized-feature": "info",
        "duplicated-steps": "error",
        "unused-steps": "info",
        "ambiguous-steps": "error",
        "undefined-steps": "error",
        "excessive-tags": "info",
        "inconsistent-formatting": "info",
        "poor-maintainability": "warning"
    };

    setup(() => {
        engine = new AntiPatternEngine();
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

    test('Returns no anti-patterns for perfect health', () => {
        const ap = engine.generateAntiPatterns(mockGraph, baseMetrics, ruleConfig);
        assert.strictEqual(ap.length, 0);
    });

    test('UndefinedStepsRule triggers on undefined steps', () => {
        const metrics = { ...baseMetrics, undefinedSteps: [
            { keyword: 'Given', text: 'I am undefined', uri: 'file:///test.feature', line: 1 } as any
        ]};
        const ap = engine.generateAntiPatterns(mockGraph, metrics, ruleConfig);
        assert.strictEqual(ap.length, 1);
        assert.strictEqual(ap[0].title, 'Undefined Steps');
        assert.strictEqual(ap[0].severity, 'error');
        assert.strictEqual(ap[0].affectedItems?.length, 1);
        assert.strictEqual(ap[0].affectedItems![0].label, 'Step: Given I am undefined');
    });

    test('OversizedScenarioRule does not crash if graph is empty', () => {
        const ap = engine.generateAntiPatterns(mockGraph, baseMetrics, ruleConfig);
        assert.strictEqual(ap.length, 0);
    });
    
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
        
        const ap = engine.generateAntiPatterns(mockGraph, metrics, ruleConfig);
        assert.strictEqual(ap.length, 1);
        assert.strictEqual(ap[0].title, 'Ambiguous Steps in Feature Files');
        assert.strictEqual(ap[0].severity, 'error');
        assert.ok(ap[0].affectedItems![0].label.includes('Matches 2 defs'));
    });

    test('OversizedFeatureRule triggers when feature size > 20', () => {
        const metrics = { ...baseMetrics, largestFeatures: [
            { uri: 'file:///huge.feature', name: 'Huge Feature', size: 25 }
        ]};
        const ap = engine.generateAntiPatterns(mockGraph, metrics, ruleConfig);
        const oversizedFeat = ap.find(r => r.title.startsWith('Oversized Feature'));
        assert.ok(oversizedFeat);
        assert.strictEqual(oversizedFeat.severity, 'info');
        assert.ok(oversizedFeat.affectedFiles.includes('file:///huge.feature'));
    });

    test('OversizedScenarioRule triggers when scenario size > 10', () => {
        const metrics = { ...baseMetrics, largestScenarios: [
            { uri: 'file:///huge.feature', line: 1, name: 'Huge Scenario', size: 15 }
        ]};
        const ap = engine.generateAntiPatterns(mockGraph, metrics, ruleConfig);
        const oversizedScen = ap.find(r => r.title.startsWith('Oversized Scenario'));
        assert.ok(oversizedScen);
        assert.strictEqual(oversizedScen.severity, 'warning');
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
        const ap = engine.generateAntiPatterns(mockGraph, metrics, ruleConfig);
        const dupRec = ap.find(r => r.title === 'Duplicated Step Definitions');
        assert.ok(dupRec);
        assert.strictEqual(dupRec.severity, 'error');
        assert.strictEqual(dupRec.affectedItems?.length, 2);
    });

    test('UnusedStepsRule triggers when there are unused steps', () => {
        const metrics = { ...baseMetrics, stepAnalysis: {
            ...baseMetrics.stepAnalysis,
            unusedSteps: [
                { stepDef: { uri: 'file:///unused.py', line: 1, pattern: 'unused pattern' } }
            ]
        } as any};
        const ap = engine.generateAntiPatterns(mockGraph, metrics, ruleConfig);
        const unusedRec = ap.find(r => r.title === 'Unused Step Definitions');
        assert.ok(unusedRec);
        assert.strictEqual(unusedRec.severity, 'info');
        assert.strictEqual(unusedRec.affectedItems?.length, 1);
    });

    test('ExcessiveTagsRule triggers for scenario with > 5 tags', () => {
        (mockGraph as any).nodes.set('scen1', {
            id: 'scen1', type: 'Scenario', uri: 'file:///tags.feature', tags: ['@t1', '@t2', '@t3', '@t4', '@t5', '@t6'], name: 'Tagged Scenario'
        });
        const ap = engine.generateAntiPatterns(mockGraph, baseMetrics, ruleConfig);
        const tagRec = ap.find(r => r.title.startsWith('Excessive Tags on Scenario'));
        assert.ok(tagRec);
        assert.strictEqual(tagRec.severity, 'info');
        
        (mockGraph as any).nodes.delete('scen1');
    });

    test('PoorMaintainabilityRule triggers when maintainability < 60', () => {
        const metrics = { ...baseMetrics, scores: { complexity: 0, maintainability: 50, health: 50 }};
        const ap = engine.generateAntiPatterns(mockGraph, metrics, ruleConfig);
        const maintRec = ap.find(r => r.title === 'Poor Project Maintainability');
        assert.ok(maintRec);
        assert.strictEqual(maintRec.severity, 'warning');
    });

    test('InconsistentFormattingRule triggers for steps with trailing spaces', () => {
        (mockGraph as any).nodes.set('step1', {
            id: 'step1', type: 'Step', uri: 'file:///format.feature', text: 'Step with space '
        });
        const ap = engine.generateAntiPatterns(mockGraph, baseMetrics, ruleConfig);
        const formatRec = ap.find(r => r.title === 'Inconsistent Formatting: Trailing Spaces');
        assert.ok(formatRec);
        assert.strictEqual(formatRec.severity, 'info');
        
        (mockGraph as any).nodes.delete('step1');
    });
    
    test('Severity Configuration Overrides work', () => {
        const metrics = { ...baseMetrics, largestScenarios: [
            { uri: 'file:///huge.feature', line: 1, name: 'Huge Scenario', size: 15 }
        ]};
        const customConfig = { ...ruleConfig, "oversized-scenario": "off" };
        const apOff = engine.generateAntiPatterns(mockGraph, metrics, customConfig);
        assert.strictEqual(apOff.length, 0, 'Should be 0 because rule is turned off');
        
        const customConfigError = { ...ruleConfig, "oversized-scenario": "error" };
        const apError = engine.generateAntiPatterns(mockGraph, metrics, customConfigError);
        assert.strictEqual(apError.length, 1);
        assert.strictEqual(apError[0].severity, 'error');
    });
});
