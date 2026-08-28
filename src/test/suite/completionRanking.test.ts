import * as assert from 'assert';
import { CompletionRankingService, RankingContext, TextMatchQuality, SemanticMatchQuality } from '../../completionRanking';
import { StepDefinition } from '../../cache';
import * as vscode from 'vscode';
import { StepDefNode } from '../../graph';

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
            id: `test:${type}:${pattern}`,
            type,
            rawPattern: pattern,
            matcherType: 'parse',
            evaluable: true,
            decoratorRange: new vscode.Range(0, 0, 0, 0),
            uri: vscode.Uri.file('/test.py')
        };
    }

    test('Semantic category match gives EXACT', () => {
        const def = createDef('I login', 'given');
        const context: RankingContext = {
            semanticType: 'given',
            typedText: 'I log',
            currentTags: [],
            currentFeatureStepTexts: []
        };
        
        const scoreMatch = service.scoreItem(def, context);
        assert.strictEqual(scoreMatch.semanticMatch, SemanticMatchQuality.EXACT);
        
        context.semanticType = 'when';
        const scoreNoMatch = service.scoreItem(def, context);
        assert.strictEqual(scoreNoMatch.semanticMatch, SemanticMatchQuality.INCOMPATIBLE);
    });

    test('Textual prefix match identifies EXACT_PREFIX', () => {
        const def = createDef('I type my password', 'when');
        const context: RankingContext = {
            semanticType: 'when',
            typedText: 'I type', // exact prefix
            currentTags: [],
            currentFeatureStepTexts: []
        };
        
        const scoreExact = service.scoreItem(def, context);
        assert.strictEqual(scoreExact.textMatch, TextMatchQuality.EXACT_PREFIX);
        
        context.typedText = 'type'; // not a prefix
        const scoreFuzzy = service.scoreItem(def, context);
        assert.strictEqual(scoreFuzzy.textMatch, TextMatchQuality.PARTIAL);
    });

    test('Adversarial Ranking: Textual relevance outranks popularity', () => {
        const defPopular = createDef('I have some completely unrelated stuff', 'given');
        const defExact = createDef('I have 5 apples', 'given');

        const context: RankingContext = {
            semanticType: 'given',
            typedText: 'I have 5',
            currentTags: [],
            currentFeatureStepTexts: []
        };

        // Make the popular item extremely popular (recent + global usage)
        for (let i = 0; i < 20; i++) {
            service.recordCompletion(defPopular.id);
        }
        mockGraph.currentGeneration.getNode = (id: string) => {
            if (id.includes('test.py') && id.includes(defPopular.rawPattern)) {
                return {
                    type: 'StepDefinition',
                    usages: Array(100).fill('usage') // Massively used
                } as StepDefNode;
            }
            return undefined;
        };

        const scorePopular = service.scoreItem(defPopular, context);
        const scoreExact = service.scoreItem(defExact, context);

        const sortTextPopular = service.getSortText(scorePopular);
        const sortTextExact = service.getSortText(scoreExact);

        assert.strictEqual(scoreExact.textMatch, TextMatchQuality.EXACT_PREFIX);
        assert.strictEqual(scorePopular.textMatch, TextMatchQuality.UNRELATED);

        // Lexicographical comparison (ascending order in VS Code, so smaller string is better)
        assert.ok(sortTextExact < sortTextPopular, 'Exact text match must win against massive popularity');
    });

    test('getSortText translates higher tier into lower string values', () => {
        const score1 = { textMatch: 5, semanticMatch: 3, matcherQuality: 2, localContext: 2, historicalUsage: 25, tagAffinity: 25, tieBreaker: 'A' };
        const score2 = { textMatch: 4, semanticMatch: 3, matcherQuality: 2, localContext: 2, historicalUsage: 50, tagAffinity: 49, tieBreaker: 'A' };

        const str1 = service.getSortText(score1);
        const str2 = service.getSortText(score2);

        // score1 has better textMatch (5 vs 4), so it must sort before score2 despite score2 having max learned signals
        assert.ok(str1 < str2, 'Tier 1 must dominate Tier 5');
    });

    test('Score item provides deterministic explanation vectors', () => {
        const def = createDef('I login', 'given');
        const context: RankingContext = {
            semanticType: 'given',
            typedText: 'I login',
            currentTags: ['@auth'],
            currentFeatureStepTexts: ['I login']
        };

        const score = service.scoreItem(def, context);
        
        // This acts as a contract snapshot for the diagnostic command
        assert.deepStrictEqual(score, {
            textMatch: TextMatchQuality.EXACT,
            semanticMatch: SemanticMatchQuality.EXACT,
            matcherQuality: 2,
            localContext: 0, // Regex wasn't set, so this skips
            historicalUsage: 0,
            tagAffinity: 0,
            tieBreaker: 'I login'
        });
    });

    test('Identity Generation resolves collisions robustly', () => {
        const { generateStepDefId } = require('../../utils/stepIdentity');
        
        // Exact same pattern, different semantic types
        const id1 = generateStepDefId('given', 'parse', 'I log in', vscode.Uri.file('/foo.py'), 'login_step');
        const id2 = generateStepDefId('when', 'parse', 'I log in', vscode.Uri.file('/foo.py'), 'login_step');
        assert.notStrictEqual(id1, id2, 'IDs should differ by semantic type');
        
        // Exact same pattern, different files
        const id3 = generateStepDefId('given', 'parse', 'I log in', vscode.Uri.file('/bar.py'), 'login_step');
        assert.notStrictEqual(id1, id3, 'IDs should differ by file');
        
        // Ensure colons inside the pattern don't break string splitting parsing
        const id4 = generateStepDefId('given', 'parse', 'I log in: {count:d}', vscode.Uri.file('/foo.py'), 'login_step');
        const { parseStepDefId } = require('../../utils/stepIdentity');
        const parsed = parseStepDefId(id4);
        assert.strictEqual(parsed.rawPattern, 'I log in: {count:d}', 'Parsed pattern should match exactly including colons');
    });

    test('Migration gracefully handles old rawPattern histories', () => {
        let storedData: string[] = ['I log in', 'I log out', 'test:given:I am an already migrated ID:foo.py:step'];
        
        const mockMemento: any = {
            get: () => storedData,
            update: (_key: string, data: any) => { storedData = data; }
        };
        
        mockGraph.currentGeneration.getAllStepDefNodes = () => [
            { id: 'new:given:I log in:foo.py:step', pattern: 'I log in' },
            // I log out is ambiguous (two definitions)
            { id: 'new:given:I log out:bar.py:step1', pattern: 'I log out' },
            { id: 'new:when:I log out:bar.py:step2', pattern: 'I log out' },
        ];
        
        // Re-initialize service with memento
        service = new CompletionRankingService(mockGraph, mockMemento);
        
        // I log in -> unambiguous, migrated.
        // I log out -> ambiguous, dropped.
        // test:given... -> already migrated, preserved.
        assert.strictEqual(storedData.length, 2, 'Ambiguous items should be dropped');
        assert.strictEqual(storedData[1], 'test:given:I am an already migrated ID:foo.py:step');
        assert.strictEqual(storedData[0], 'new:given:I log in:foo.py:step');
    });
});
