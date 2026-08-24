import * as assert from 'assert';
import { CompletionRankingService, RankingContext } from '../../completionRanking';
import { StepDefinition } from '../../cache';
import * as vscode from 'vscode';
import { StepDefNode, ScenarioNode } from '../../graph';

suite('Completion Ranking Service Test Suite', () => {
    let service: CompletionRankingService;
    let mockGraph: any;

    setup(() => {
        mockGraph = {
            currentGeneration: {
                getNode: (_id: string) => undefined
            }
        };
        service = new CompletionRankingService(mockGraph as any);
    });

    function createDef(pattern: string, type: 'given' | 'when' | 'then' | 'step'): StepDefinition {
        return {
            type,
            rawPattern: pattern,
            matcherType: 'parse',
            evaluable: true,
            decoratorRange: new vscode.Range(0, 0, 0, 0),
            uri: vscode.Uri.file('/test.py')
        };
    }

    test('Semantic category match boosts score', () => {
        const def = createDef('I login', 'given');
        const context: RankingContext = {
            semanticType: 'given',
            typedText: 'I log',
            currentTags: [],
            currentFeatureStepTexts: []
        };
        
        const scoreMatch = service.scoreItem(def, context);
        
        context.semanticType = 'when';
        const scoreNoMatch = service.scoreItem(def, context);

        assert.ok(scoreMatch > scoreNoMatch, 'Matching semantic type should rank higher');
        assert.strictEqual(scoreMatch - scoreNoMatch, 10, 'Semantic match should give 10 points');
    });

    test('Exact typed prefix boosts score', () => {
        const def = createDef('I type my password', 'when');
        const context: RankingContext = {
            semanticType: 'when',
            typedText: 'I type', // exact prefix
            currentTags: [],
            currentFeatureStepTexts: []
        };
        
        const scoreExact = service.scoreItem(def, context);
        
        context.typedText = 'type'; // not a prefix
        const scoreFuzzy = service.scoreItem(def, context);

        assert.ok(scoreExact > scoreFuzzy, 'Exact prefix match should rank higher');
        assert.strictEqual(scoreExact - scoreFuzzy, 15, 'Exact match should give 15 points');
    });

    test('Recently used items rank higher', () => {
        const def1 = createDef('first step', 'given');
        const def2 = createDef('second step', 'given');

        const context: RankingContext = {
            semanticType: 'given',
            typedText: '',
            currentTags: [],
            currentFeatureStepTexts: []
        };

        // Before recording
        const initialScore1 = service.scoreItem(def1, context);
        const initialScore2 = service.scoreItem(def2, context);
        assert.strictEqual(initialScore1, initialScore2);

        // Record usage
        service.recordCompletion('first step');
        service.recordCompletion('second step');

        // After recording, second step was recorded last (most recently)
        const newScore1 = service.scoreItem(def1, context);
        const newScore2 = service.scoreItem(def2, context);

        assert.ok(newScore2 > newScore1, 'Most recently used should rank highest');
        assert.ok(newScore1 > initialScore1, 'Recently used should rank higher than not used');
    });

    test('getSortText assigns lower string for higher score', () => {
        const strHigh = service.getSortText(100, 'pattern A');
        const strLow = service.getSortText(50, 'pattern B');

        // Lexicographical comparison
        assert.ok(strHigh < strLow, 'Higher score should produce lexicographically smaller string');
    });

    test('Feature context match boosts score', () => {
        const def = createDef('I login', 'given');
        def.regex = /I login/;
        const context: RankingContext = {
            semanticType: 'given',
            typedText: '',
            currentTags: [],
            currentFeatureStepTexts: []
        };
        
        const scoreBase = service.scoreItem(def, context);
        
        context.currentFeatureStepTexts = ['Given I login', 'When I do something'];
        const scoreBoosted = service.scoreItem(def, context);

        assert.ok(scoreBoosted > scoreBase, 'Feature context should boost score');
        assert.strictEqual(scoreBoosted - scoreBase, 20, 'Feature context boost should be 20 points');
    });

    test('Global frequency from WorkspaceGraph boosts score', () => {
        const def = createDef('I login', 'given');
        def.regex = /I login/;
        const context: RankingContext = {
            semanticType: 'given',
            typedText: '',
            currentTags: [],
            currentFeatureStepTexts: []
        };
        
        // Mock getFrequency via graph
        mockGraph.currentGeneration.getNode = (_id: string) => {
            return {
                type: 'StepDefinition',
                usages: ['u1', 'u2', 'u3', 'u4', 'u5']
            } as StepDefNode;
        };
        
        const scoreBoosted = service.scoreItem(def, context);
        
        mockGraph.currentGeneration.getNode = () => undefined; // reset
        const scoreBase = service.scoreItem(def, context);

        assert.ok(scoreBoosted > scoreBase, 'Global frequency should boost score');
        assert.strictEqual(scoreBoosted - scoreBase, 10, 'Frequency 5 should give 10 points max boost');
    });

    test('Tag affinity from WorkspaceGraph boosts score', () => {
        const def = createDef('I login', 'given');
        def.regex = /I login/;
        const context: RankingContext = {
            semanticType: 'given',
            typedText: '',
            currentTags: ['@ui'],
            currentFeatureStepTexts: []
        };
        
        // Mock getTagAffinity via graph
        mockGraph.currentGeneration.getNode = (id: string) => {
            if (id.includes('test.py')) {
                return {
                    type: 'StepDefinition',
                    usages: ['u1', 'u2'] // 2 usages
                } as StepDefNode;
            }
            if (id === 'u1') return { type: 'Step', parent: 's1' };
            if (id === 'u2') return { type: 'Step', parent: 's2' };
            if (id === 's1') return { type: 'Scenario', tags: ['@ui'] } as ScenarioNode;
            if (id === 's2') return { type: 'Scenario', tags: ['@ui'] } as ScenarioNode;
            return undefined;
        };
        
        const score = service.scoreItem(def, context);
        
        mockGraph.currentGeneration.getNode = () => undefined; // reset
        const scoreBase = service.scoreItem(def, context);

        assert.ok(score > scoreBase, 'Tag affinity should boost score');
        assert.strictEqual(score, 24, 'Affinity 2 should give 10 points + 4 frequency points + 10 semantic points = 24');
    });


});
