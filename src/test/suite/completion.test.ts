import * as assert from 'assert';
import * as vscode from 'vscode';
import { GherkinCompletionProvider } from '../../completion';

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

    // Position at the end of the specified line
    const pos = new vscode.Position(lineIndex, lines[lineIndex].length);
    return [doc, pos];
}

suite('Completion Test Suite', () => {
    let provider: GherkinCompletionProvider;
    let mockCache: SymbolCache;


    setup(() => {
        mockCache = new SymbolCache();

        // Mock the cache with some step definitions
        const steps: StepDefinition[] = [
            {
                id: 'mock:given:I have {count:d} apples:mock.py:step1',
                type: 'given',
                rawPattern: 'I have {count:d} apples',
                matcherType: 'parse',
                regex: /I have {count:d} apples/,
                decoratorRange: new vscode.Range(0, 0, 0, 0),
                uri: vscode.Uri.parse('file:///mock.py')
            } as any,
            {
                id: 'mock:when:I eat (?P<fruit>\\w+) apples:mock.py:step2',
                type: 'when',
                rawPattern: 'I eat (?P<fruit>\\w+) apples',
                matcherType: 're',
                regex: /^I eat (\w+) apples$/i,
                decoratorRange: new vscode.Range(1, 0, 1, 0),
                uri: vscode.Uri.parse('file:///mock.py')
            } as any,
            {
                id: 'mock:then:I should have {count} apples:mock.py:step3',
                type: 'then',
                rawPattern: 'I should have {count} apples',
                matcherType: 'parse',
                regex: /dummy/,
                decoratorRange: new vscode.Range(2, 0, 2, 0),
                uri: vscode.Uri.parse('file:///mock.py')
            } as any,
            {
                id: 'mock:step:generic step:mock.py:step4',
                type: 'step', // generic step
                rawPattern: 'generic step',
                regex: /dummy/,
                decoratorRange: new vscode.Range(3, 0, 3, 0),
                uri: vscode.Uri.parse('file:///mock.py')
            } as any,
            {
                id: 'mock:given:duplicate pattern:mock.py:step5',
                type: 'given',
                rawPattern: 'duplicate pattern',
                regex: /dummy/,
                decoratorRange: new vscode.Range(4, 0, 4, 0),
                uri: vscode.Uri.parse('file:///mock.py')
            } as any,
            {
                id: 'mock:given:duplicate pattern:mock.py:step6',
                type: 'given', // deliberate duplicate to test ambiguity visibility
                rawPattern: 'duplicate pattern',
                regex: /dummy/,
                decoratorRange: new vscode.Range(5, 0, 5, 0),
                uri: vscode.Uri.parse('file:///mock.py')
            } as any
        ];

        // Override the cache method for testing
        mockCache.getAllStepDefinitions = (semanticType?: 'given' | 'when' | 'then' | 'step') => {
            if (!semanticType || semanticType === 'step') return Promise.resolve(steps);
            return Promise.resolve(steps.filter(s => s.type === semanticType || s.type === 'step'));
        };
        // mockGraph removed

        const mockRanking = { 
            scoreItem: (def: any) => ({ tieBreaker: def.rawPattern }), 
            getSortText: (score: any) => score.tieBreaker 
        };
        
        const mockContextCache = {
            getSnapshot: () => Promise.resolve({ tags: [], featureStepTexts: [] }),
            invalidate: () => {}
        };
        provider = new GherkinCompletionProvider(mockCache, mockRanking as any, mockContextCache as any);
    });

    test('Provides Given completions and generic steps, but not When/Then', async () => {
        const text = `
Feature: Test
  Scenario: Test
    Given I ha
        `.trim();
        const [doc, pos] = createMockDocument(text, 2);

        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];

        assert.ok(completions);
        // Should return "I have {count:d} apples", "generic step", and ONE grouped instance of "duplicate pattern"
        // because ambiguity is now visually grouped.
        assert.strictEqual(completions.length, 3);

        const labels = completions.map(c => c.filterText);
        assert.ok(labels.includes('generic step'));
        assert.ok(labels.includes('I have <count> apples'));
        assert.ok(labels.filter(l => l === 'duplicate pattern').length === 1);

        const item1 = completions.find(c => c.filterText === 'I have <count> apples');
        assert.ok(item1?.insertText instanceof vscode.SnippetString);
        assert.strictEqual(item1.insertText.value, 'I have ${1:count} apples');
    });

    test('Provides When completions and resolves regex placeholders', async () => {
        const text = `
Feature: Test
  Scenario: Test
    When I ea
        `.trim();
        const [doc, pos] = createMockDocument(text, 2);

        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        assert.ok(completions);
        assert.strictEqual(completions.length, 2); // When + step

        const labels = completions.map(c => typeof c.label === 'string' ? c.label : c.label.label);
        assert.ok(labels.includes('I eat <fruit> apples'));

        const item = completions.find(c => (typeof c.label === 'string' ? c.label : c.label.label) === 'I eat <fruit> apples');
        assert.ok(item, 'Completion item not found');
        assert.strictEqual((item.insertText as vscode.SnippetString).value, 'I eat ${1:fruit} apples');
    });

    test('Resolves And context from previous step', async () => {
        const text = `
Feature: Test
  Scenario: Test
    When I eat (?P<fruit>\\w+)
    And I s
        `.trim();
        const [doc, pos] = createMockDocument(text, 3);

        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        assert.ok(completions);
        // And follows a When, so it should suggest When steps + generic steps
        assert.strictEqual(completions.length, 2);

        const labels = completions.map(c => typeof c.label === 'string' ? c.label : c.label.label);
        assert.ok(labels.includes('I eat <fruit> apples'));
    });

    test('Supports localized keywords (Spanish) via Dialect Service', async () => {
        const text = `
# language: es
Característica: Prueba
  Escenario: Prueba
    Cuando I ea
        `.trim();
        const [doc, pos] = createMockDocument(text, 3);

        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        assert.ok(completions);

        // "Cuando" is "When"
        assert.strictEqual(completions.length, 2);
        const labels = completions.map(c => typeof c.label === 'string' ? c.label : c.label.label);
        assert.ok(labels.includes('I eat <fruit> apples'));
    });

    test('Ranks exact textual prefixes higher', async () => {
        const text = `
Feature: Test
  Scenario: Test
    Given duplicate p
        `.trim();
        const [doc, pos] = createMockDocument(text, 2);

        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        assert.ok(completions);

        const getLabel = (c: vscode.CompletionItem) => typeof c.label === 'string' ? c.label : c.label.label;
        const dupItem = completions.find(c => getLabel(c) === 'duplicate pattern');
        assert.ok(dupItem);

        const genItem = completions.find(c => getLabel(c) === 'generic step');
        assert.ok(genItem);

        // Lexicographically smaller means higher rank in VS Code
        assert.ok(dupItem.sortText! < genItem.sortText!, 'Exact prefix should rank higher than fuzzy prefix');
    });

    test('Provides parameter completions for Scenario Outline Examples', async () => {
        const text = `
Feature: Test
  Scenario Outline: Test Outline
    Given I type <us

    Examples:
      | username | password |
      | admin    | 12345    |
        `.trim();
        // Line index 2 is "    Given I type <us"
        const [doc, pos] = createMockDocument(text, 2);

        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];

        assert.ok(completions);
        assert.strictEqual(completions.length, 2);

        const labels = completions.map(c => typeof c.label === 'string' ? c.label : c.label.label);
        assert.ok(labels.includes('username'));
        assert.ok(labels.includes('password'));

        // Ensure insert text has closing bracket
        const userItem = completions.find(c => (typeof c.label === 'string' ? c.label : c.label.label) === 'username');
        assert.ok(userItem?.insertText instanceof vscode.SnippetString);
        assert.strictEqual(userItem?.insertText.value, 'username>$0');
    });

    test('AST Completion: Escaped pipes and empty cells in Examples', async () => {
        const text = `
Feature: Test
  Scenario Outline: Test Outline
    Given I type <

    Examples:
      | | name \\| ID |  | status |
      | | admin \\| 1 |  | active |
        `.trim();
        const [doc, pos] = createMockDocument(text, 2);
        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        assert.ok(completions);

        const labels = completions.map(c => typeof c.label === 'string' ? c.label : c.label.label);
        // AST handles escaping naturally and unescapes the value, and we skip empty cells
        assert.strictEqual(labels.includes('name | ID'), true);
        assert.strictEqual(labels.includes('status'), true);
        assert.strictEqual(labels.length, 2);
    });

    test('AST Completion: Multiple Examples blocks merge and deduplicate', async () => {
        const text = `
Feature: Test
  Scenario Outline: Test Outline
    Given I type <

    Examples:
      | username | password |
      | admin    | 12345    |

    Examples:
      | status | username |
      | active | guest    |
        `.trim();
        const [doc, pos] = createMockDocument(text, 2);
        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];

        const labels = completions.map(c => typeof c.label === 'string' ? c.label : c.label.label);
        // Merged from both blocks, username deduplicated
        assert.deepStrictEqual(labels, ['username', 'password', 'status']);
    });

    test('AST Completion: Adjacent outlines isolate headers', async () => {
        const text = `
Feature: Test
  Scenario Outline: First
    Given I type <
    Examples:
      | first_param |

  Scenario Outline: Second
    Given I type <
    Examples:
      | second_param |
        `.trim();

        // Cursor in First Outline
        const [doc1, pos1] = createMockDocument(text, 2);
        const comp1 = await provider.provideCompletionItems(doc1, pos1, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        const l1 = comp1.map(c => typeof c.label === 'string' ? c.label : c.label.label);
        assert.deepStrictEqual(l1, ['first_param']);

        // Cursor in Second Outline
        const [doc2, pos2] = createMockDocument(text, 7);
        const comp2 = await provider.provideCompletionItems(doc2, pos2, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        const l2 = comp2.map(c => typeof c.label === 'string' ? c.label : c.label.label);
        assert.deepStrictEqual(l2, ['second_param']);
    });

    test('Fallback Regex Completion: Works with localized dialects and malformed syntax', async () => {
        const text = `
# language: es
Característica: Prueba
  Esquema del escenario: Prueba
    Dado que escribo <

    Ejemplos:
      | usuario | clave |
        `.trim();
        // The table is missing its body rows, AST might fail to attach 'Ejemplos'
        // to the scenario if typing is mid-flight. But it should resolve via AST or Fallback regex.
        const [doc, pos] = createMockDocument(text, 3);
        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];

        assert.ok(completions);
        const labels = completions.map(c => typeof c.label === 'string' ? c.label : c.label.label);
        assert.deepStrictEqual(labels, ['usuario', 'clave']);
    });
});
