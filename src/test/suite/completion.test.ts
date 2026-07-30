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
    
    // Position at the end of the specified line
    const pos = new vscode.Position(lineIndex, lines[lineIndex].length);
    return [doc, pos];
}

suite('Completion Test Suite', () => {
    let provider: GherkinCompletionProvider;
    let mockCache: SymbolCache;
    let rankingService: CompletionRankingService;

    setup(() => {
        mockCache = new SymbolCache();
        
        // Mock the cache with some step definitions
        const steps: StepDefinition[] = [
            {
                type: 'given',
                rawPattern: 'I have {count:d} apples',
                regex: /I have {count:d} apples/,
                decoratorRange: new vscode.Range(0, 0, 0, 0)
            } as any,
            {
                type: 'when',
                rawPattern: 'I eat (?P<amount>\\d+) apples',
                regex: /dummy/,
                decoratorRange: new vscode.Range(1, 0, 1, 0)
            } as any,
            {
                type: 'then',
                rawPattern: 'I should have {count} apples',
                regex: /dummy/,
                decoratorRange: new vscode.Range(2, 0, 2, 0)
            } as any,
            {
                type: 'step', // generic step
                rawPattern: 'generic step',
                regex: /dummy/,
                decoratorRange: new vscode.Range(3, 0, 3, 0)
            } as any,
            {
                type: 'given',
                rawPattern: 'duplicate pattern',
                regex: /dummy/,
                decoratorRange: new vscode.Range(4, 0, 4, 0)
            } as any,
            {
                type: 'given', // deliberate duplicate to test filtering
                rawPattern: 'duplicate pattern',
                regex: /dummy/,
                decoratorRange: new vscode.Range(5, 0, 5, 0)
            } as any
        ];
        
        // Override the cache method for testing
        mockCache.getAllStepDefinitions = (semanticType?: 'given' | 'when' | 'then' | 'step') => {
            if (!semanticType || semanticType === 'step') return Promise.resolve(steps);
            return Promise.resolve(steps.filter(s => s.type === semanticType || s.type === 'step'));
        };
        
        rankingService = new CompletionRankingService();
        provider = new GherkinCompletionProvider(mockCache, rankingService);
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
        // Should return "I have {count:d} apples", "generic step", "duplicate pattern" (only one)
        assert.strictEqual(completions.length, 3);
        
        const labels = completions.map(c => c.filterText);
        assert.ok(labels.includes('I have {count:d} apples'));
        assert.ok(labels.includes('generic step'));
        assert.ok(labels.includes('duplicate pattern'));
        
        // Ensure snippet formatting
        const item1 = completions.find(c => c.filterText === 'I have {count:d} apples');
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
        
        const labels = completions.map(c => c.filterText);
        assert.ok(labels.includes('I eat (?P<amount>\\d+) apples'));
        assert.ok(labels.includes('generic step'));
        
        const item = completions.find(c => c.filterText === 'I eat (?P<amount>\\d+) apples');
        assert.ok(item?.insertText instanceof vscode.SnippetString);
        assert.strictEqual(item.insertText.value, 'I eat ${1:amount} apples');
    });

    test('Resolves And context from previous step', async () => {
        const text = `
Feature: Test
  Scenario: Test
    When I eat (?P<amount>\\d+) apples
    And I s
        `.trim();
        const [doc, pos] = createMockDocument(text, 3);
        
        const completions = await provider.provideCompletionItems(doc, pos, {} as vscode.CancellationToken, {} as vscode.CompletionContext) as vscode.CompletionItem[];
        assert.ok(completions);
        // And follows a When, so it should suggest When steps + generic steps
        assert.strictEqual(completions.length, 2);
        
        const labels = completions.map(c => c.filterText);
        assert.ok(labels.includes('I eat (?P<amount>\\d+) apples'));
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
        const labels = completions.map(c => c.filterText);
        assert.ok(labels.includes('I eat (?P<amount>\\d+) apples'));
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
        
        const dupItem = completions.find(c => c.filterText === 'duplicate pattern');
        assert.ok(dupItem);
        
        const genItem = completions.find(c => c.filterText === 'generic step');
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
});
