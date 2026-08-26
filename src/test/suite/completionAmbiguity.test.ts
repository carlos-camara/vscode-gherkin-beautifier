import * as assert from 'assert';
import * as vscode from 'vscode';
import { GherkinCompletionProvider } from '../../completion';
import { CompletionRankingService } from '../../completionRanking';
import { SymbolCache, StepDefinition } from '../../cache';

let docVersion = 0;
function createMockDocument(text: string, lineIndex: number): [vscode.TextDocument, vscode.Position] {
    const lines = text.split('\n');
    docVersion++;
    const doc = {
        languageId: 'feature',
        version: docVersion,
        getText: () => text,
        lineAt: (lineOrPos: any) => ({ text: lines[typeof lineOrPos === 'number' ? lineOrPos : lineOrPos.line] }),
        lineCount: lines.length,
        uri: vscode.Uri.parse(`file:///mock_${docVersion}.feature`)
    } as any as vscode.TextDocument;

    const pos = new vscode.Position(lineIndex, lines[lineIndex].length);
    return [doc, pos];
}

suite('Ambiguous UX Grouping', () => {
    let provider: GherkinCompletionProvider;
    let mockCache: SymbolCache;

    setup(() => {
        mockCache = new SymbolCache();
        
        const steps: StepDefinition[] = [
            {
                id: 'mock:given:parse:I am ambiguous:folderA/test.py:step1',
                type: 'given',
                rawPattern: 'I am ambiguous',
                matcherType: 'parse',
                regex: /I am ambiguous/,
                decoratorRange: new vscode.Range(0, 0, 0, 0),
                uri: vscode.Uri.parse('file:///folderA/test.py')
            } as any,
            {
                id: 'mock:given:parse:I am ambiguous:folderB/test.py:step1',
                type: 'given',
                rawPattern: 'I am ambiguous',
                matcherType: 'parse',
                regex: /I am ambiguous/,
                decoratorRange: new vscode.Range(0, 0, 0, 0),
                uri: vscode.Uri.parse('file:///folderB/test.py')
            } as any,
            {
                id: 'mock:step:parse:generic overlap:folderC/test.py:step1',
                type: 'step',
                rawPattern: 'generic overlap',
                matcherType: 'parse',
                regex: /generic overlap/,
                decoratorRange: new vscode.Range(0, 0, 0, 0),
                uri: vscode.Uri.parse('file:///folderC/test.py')
            } as any,
            {
                id: 'mock:given:parse:generic overlap:folderC/test.py:step2',
                type: 'given',
                rawPattern: 'generic overlap',
                matcherType: 'parse',
                regex: /generic overlap/,
                decoratorRange: new vscode.Range(0, 0, 0, 0),
                uri: vscode.Uri.parse('file:///folderC/test.py')
            } as any,
            {
                id: 'mock:given:parse:I have {count:d} items:folderD/test.py:step1',
                type: 'given',
                rawPattern: 'I have {count:d} items',
                matcherType: 'parse',
                regex: /I have \d+ items/,
                decoratorRange: new vscode.Range(0, 0, 0, 0),
                uri: vscode.Uri.parse('file:///folderD/test.py')
            } as any,
            {
                id: 'mock:given:re:I have (?P<count>\\d+) items:folderE/test.py:step1',
                type: 'given',
                rawPattern: 'I have (?P<count>\\d+) items',
                matcherType: 're',
                regex: /^I have (?<count>\d+) items$/,
                decoratorRange: new vscode.Range(0, 0, 0, 0),
                uri: vscode.Uri.parse('file:///folderE/test.py')
            } as any
        ];

        mockCache.getAllStepDefinitions = (semanticType?: 'given' | 'when' | 'then' | 'step') => {
            if (!semanticType || semanticType === 'step') return Promise.resolve(steps);
            return Promise.resolve(steps.filter(s => s.type === semanticType || s.type === 'step'));
        };
        const mockGraph = { currentGeneration: { getAllStepDefNodes: () => [], getNode: () => undefined } };
        const mockRanking = new CompletionRankingService(mockGraph as any);
        const mockContextCache = {
            getSnapshot: () => Promise.resolve({ tags: [], featureStepTexts: [] }),
            invalidate: () => {}
        };
        provider = new GherkinCompletionProvider(mockCache, mockRanking, mockContextCache as any);
    });

    test('Identical pattern/same semantic type are grouped into one item', async () => {
        const text = `
Feature: Test
  Scenario: Test
    Given I a
        `.trim();
        const [doc, pos] = createMockDocument(text, 2);
        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        
        const ambiguousItems = completions.filter(c => c.filterText === 'I am ambiguous');
        assert.strictEqual(ambiguousItems.length, 1);
        
        const item = ambiguousItems[0];
        assert.strictEqual(item.detail, '(behave) @given (2 matching definitions)');
        
        const docText = (item.documentation as vscode.MarkdownString).value;
        assert.ok(docText.includes('Ambiguous Definitions (2)'));
        assert.ok(docText.includes('folderA/test.py'));
        assert.ok(docText.includes('folderB/test.py'));

        assert.ok(item.command);
        assert.strictEqual(item.command?.arguments?.[0].length, 2);
        assert.ok(item.command?.arguments?.[0].includes('mock:given:parse:I am ambiguous:folderA/test.py:step1'));
        assert.ok(item.command?.arguments?.[0].includes('mock:given:parse:I am ambiguous:folderB/test.py:step1'));
    });

    test('Generic @step + @given overlap are grouped and elevated to Event', async () => {
        const text = `
Feature: Test
  Scenario: Test
    Given generic ov
        `.trim();
        const [doc, pos] = createMockDocument(text, 2);
        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        
        const overlapItems = completions.filter(c => c.filterText === 'generic overlap');
        assert.strictEqual(overlapItems.length, 1);
        
        const item = overlapItems[0];
        assert.strictEqual(item.kind, vscode.CompletionItemKind.Event);
        assert.ok(item.detail?.includes('@step') && item.detail?.includes('given'));
    });

    test('Same pattern but different matcher type yielding different snippets are NOT grouped', async () => {
        const text = `
Feature: Test
  Scenario: Test
    Given I have 
        `.trim();
        const [doc, pos] = createMockDocument(text, 2);
        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        
        const parseItem = completions.find(c => c.filterText === 'I have <count> items');
        const reItem = completions.find(c => c.filterText === 'I have (?P<count>\\d+) items [Regex]');
        
        assert.ok(parseItem, "Parse snippet should be present");
        assert.ok(reItem, "Regex fallback should be present");
        
        assert.notStrictEqual(parseItem, reItem);
    });
});
