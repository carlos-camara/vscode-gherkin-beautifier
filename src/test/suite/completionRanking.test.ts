import * as assert from 'assert';
import { CompletionRankingService, RankingContext } from '../../completionRanking';
import { StepDefinition } from '../../cache';
import * as vscode from 'vscode';

suite('Completion Ranking Service Test Suite', () => {
    let service: CompletionRankingService;

    setup(() => {
        service = new CompletionRankingService();
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

    test('Global frequency from UsageIndexer boosts score', () => {
        const def = createDef('I login', 'given');
        def.regex = /I login/;
        const context: RankingContext = {
            semanticType: 'given',
            typedText: '',
            currentTags: [],
            currentFeatureStepTexts: []
        };
        
        // Mock getFrequency
        service.usageIndexer.getFrequency = () => 5;
        
        const scoreBoosted = service.scoreItem(def, context);
        service.usageIndexer.getFrequency = () => 0; // reset
        const scoreBase = service.scoreItem(def, context);

        assert.ok(scoreBoosted > scoreBase, 'Global frequency should boost score');
        assert.strictEqual(scoreBoosted - scoreBase, 10, 'Frequency 5 should give 10 points max boost');
    });

    test('Tag affinity from UsageIndexer boosts score', () => {
        const def = createDef('I login', 'given');
        def.regex = /I login/;
        const context: RankingContext = {
            semanticType: 'given',
            typedText: '',
            currentTags: ['@ui'],
            currentFeatureStepTexts: []
        };
        
        // Mock getTagAffinity
        service.usageIndexer.getTagAffinity = () => 2;
        
        const scoreBoosted = service.scoreItem(def, context);
        service.usageIndexer.getTagAffinity = () => 0; // reset
        const scoreBase = service.scoreItem(def, context);

        assert.ok(scoreBoosted > scoreBase, 'Tag affinity should boost score');
        assert.strictEqual(scoreBoosted - scoreBase, 10, 'Affinity 2 should give 10 points');
    });

    suite('UsageIndexer incremental snapshot model', () => {
        let indexer: any;
        let baseUri: vscode.Uri;
        
        setup(() => {
            indexer = service.usageIndexer as any;
            baseUri = vscode.workspace.workspaceFolders![0].uri;
        });

        async function writeAndIndex(filename: string, content: string) {
            const uri = vscode.Uri.joinPath(baseUri, filename);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
            await indexer.indexFile(uri);
            return uri;
        }

        async function removeFile(uri: vscode.Uri) {
            const { ResourceIdentity } = require('../../utils/resourceIdentity');
            indexer.removeSnapshot(ResourceIdentity.getCanonicalUriString(uri));
            try {
                await vscode.workspace.fs.delete(uri);
            } catch (e) {}
        }

        test('create, change, no-op change, delete, and invariant', async () => {
            const filename = 'incremental.feature';
            
            // 1. Create
            const contentV1 = `
@ui
Feature: V1
    Scenario: one
        Given I do A
        When I do B
            `;
            const uri = await writeAndIndex(filename, contentV1);
            
            assert.strictEqual(indexer.getFrequency('I do A'), 1);
            assert.strictEqual(indexer.getFrequency('I do B'), 1);
            assert.strictEqual(indexer.getTagAffinity('I do A', ['@ui']), 1);

            // 2. Change (Add step, change tag)
            const contentV2 = `
@api
Feature: V2
    Scenario: one
        Given I do A
        When I do B
        Then I do C
            `;
            await writeAndIndex(filename, contentV2);
            
            // Frequencies updated, B and A stay 1, C becomes 1
            assert.strictEqual(indexer.getFrequency('I do A'), 1);
            assert.strictEqual(indexer.getFrequency('I do C'), 1);
            // Tags updated, no longer @ui
            assert.strictEqual(indexer.getTagAffinity('I do A', ['@ui']), 0);
            assert.strictEqual(indexer.getTagAffinity('I do A', ['@api']), 1);

            // 3. No-op change (Frequencies should not duplicate)
            await writeAndIndex(filename, contentV2);
            assert.strictEqual(indexer.getFrequency('I do A'), 1, 'Frequency should remain 1 after no-op save');

            // 4. Scenario removal & Tag removal
            const contentV3 = `
Feature: V3
    Scenario: one
        Given I do A
            `;
            await writeAndIndex(filename, contentV3);
            
            assert.strictEqual(indexer.getFrequency('I do A'), 1);
            assert.strictEqual(indexer.getFrequency('I do B'), 0, 'B should be gone');
            assert.strictEqual(indexer.getFrequency('I do C'), 0, 'C should be gone');
            assert.strictEqual(indexer.getTagAffinity('I do A', ['@api']), 0, 'Tag affinity removed');

            // 5. Delete
            await removeFile(uri);
            assert.strictEqual(indexer.getFrequency('I do A'), 0, 'All frequencies should be 0 after delete');

            // 6. Invariant test: incremental result == clean full rebuild result
            const contentFinal1 = `Feature: F1\nScenario: S1\nGiven I do A`;
            const contentFinal2 = `Feature: F2\nScenario: S2\nGiven I do A\nWhen I do B`;
            
            // Run messy incremental operations
            const uri1 = await writeAndIndex('f1.feature', contentFinal1);
            const uri2 = await writeAndIndex('f2.feature', contentFinal2);
            await writeAndIndex('f1.feature', contentFinal1 + '\nAnd I do X');
            await writeAndIndex('f1.feature', contentFinal1); // Back to final
            await removeFile(uri2);
            const uri2_new = await writeAndIndex('f2_renamed.feature', contentFinal2); // Rename
            
            const incFreqA = indexer.getFrequency('I do A');
            const incFreqB = indexer.getFrequency('I do B');
            
            // Clean rebuild
            await indexer.reindexAll();
            const cleanFreqA = indexer.getFrequency('I do A');
            const cleanFreqB = indexer.getFrequency('I do B');
            
            assert.strictEqual(incFreqA, cleanFreqA, 'Invariant failed for A');
            assert.strictEqual(incFreqB, cleanFreqB, 'Invariant failed for B');

            await removeFile(uri1);
            await removeFile(uri2_new);
        });

        test('malformed edit followed by repair', async () => {
            const filename = 'malformed.feature';
            const uri = await writeAndIndex(filename, `Feature: OK\nScenario: S\nGiven valid step`);
            
            assert.strictEqual(indexer.getFrequency('valid step'), 1);

            // Malformed edit (Parsing failure must not silently double-count data, and keeps last known-good)
            await writeAndIndex(filename, `Feature OK Scenario S Given valid step`); // invalid Gherkin
            
            assert.strictEqual(indexer.getFrequency('valid step'), 1, 'Should retain last known good snapshot');

            // Repair
            await writeAndIndex(filename, `Feature: OK\nScenario: S\nGiven valid step repaired`);
            assert.strictEqual(indexer.getFrequency('valid step'), 0);
            assert.strictEqual(indexer.getFrequency('valid step repaired'), 1);

            await removeFile(uri);
        });

        test('branch-switch event burst', async () => {
            // Simulates multiple rapid changes to multiple files
            const uri1 = await writeAndIndex('burst1.feature', `Feature: B1\nScenario: S\nGiven step one`);
            const uri2 = await writeAndIndex('burst2.feature', `Feature: B2\nScenario: S\nGiven step two`);
            
            // Burst of events (same files rewritten)
            const p1 = indexer.indexFile(uri1);
            const p2 = indexer.indexFile(uri2);
            const p3 = indexer.indexFile(uri1);
            const p4 = indexer.indexFile(uri2);
            
            await Promise.all([p1, p2, p3, p4]);

            assert.strictEqual(indexer.getFrequency('step one'), 1, 'Burst should not duplicate counts');
            assert.strictEqual(indexer.getFrequency('step two'), 1, 'Burst should not duplicate counts');

            await removeFile(uri1);
            await removeFile(uri2);
        });
    });
});
