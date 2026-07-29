import * as assert from 'assert';
import * as vscode from 'vscode';
import { GherkinDocumentSymbolProvider } from '../../outline';
import { astRepository } from '../../ast';

let docVersion = 1;

function createMockDocument(text: string): vscode.TextDocument {
    const lines = text.split('\n');
    return {
        languageId: 'feature',
        getText: () => text,
        lineAt: (line: number) => ({ text: lines[line] }),
        lineCount: lines.length,
        uri: vscode.Uri.parse('file:///mock.feature'),
        version: docVersion++
    } as any as vscode.TextDocument;
}

suite('Outline Test Suite', () => {
    let provider: GherkinDocumentSymbolProvider;

    setup(() => {
        astRepository.clear();
        provider = new GherkinDocumentSymbolProvider();
    });

    test('Generates symbols for Feature, Scenario, and Steps', async () => {
        const text = `
Feature: Test Feature
  Scenario: Test Scenario
    Given I have a step
    When I take action
    Then I see results
        `.trim();
        const doc = createMockDocument(text);
        const symbols = await provider.provideDocumentSymbols(doc, {} as vscode.CancellationToken);
        
        assert.ok(symbols);
        assert.strictEqual(symbols.length, 1);
        
        const featureSymbol = symbols[0];
        assert.strictEqual(featureSymbol.name, 'Feature: Test Feature');
        assert.strictEqual(featureSymbol.kind, vscode.SymbolKind.Class);
        assert.strictEqual(featureSymbol.children.length, 1);

        const scenarioSymbol = featureSymbol.children[0];
        assert.strictEqual(scenarioSymbol.name, 'Scenario: Test Scenario');
        assert.strictEqual(scenarioSymbol.kind, vscode.SymbolKind.Method);
        assert.strictEqual(scenarioSymbol.children.length, 3);

        const stepSymbol = scenarioSymbol.children[0];
        assert.strictEqual(stepSymbol.name, 'Given I have a step');
        assert.strictEqual(stepSymbol.kind, vscode.SymbolKind.String);
    });

    test('Handles Rule and Background', async () => {
        const text = `
Feature: Test
  Background: Global Setup
    Given a global step
  Rule: Business Rule
    Background: Rule Setup
      Given a rule step
    Scenario: Under rule
      Then do something
        `.trim();
        const doc = createMockDocument(text);
        const symbols = await provider.provideDocumentSymbols(doc, null as any);

        assert.ok(symbols);
        assert.strictEqual(symbols.length, 1);
        
        const featureSymbol = symbols[0];
        // Global background + Rule
        assert.strictEqual(featureSymbol.children.length, 2);
        
        const globalBackground = featureSymbol.children[0];
        assert.strictEqual(globalBackground.name, 'Background: Global Setup');
        assert.strictEqual(globalBackground.kind, vscode.SymbolKind.Method);

        const ruleSymbol = featureSymbol.children[1];
        assert.strictEqual(ruleSymbol.name, 'Rule: Business Rule');
        assert.strictEqual(ruleSymbol.kind, vscode.SymbolKind.Namespace);
        
        // Rule Background + Scenario
        assert.strictEqual(ruleSymbol.children.length, 2);
        assert.strictEqual(ruleSymbol.children[0].name, 'Background: Rule Setup');
        assert.strictEqual(ruleSymbol.children[1].name, 'Scenario: Under rule');
    });

    test('Returns empty array on parsing failure', async () => {
        const doc = createMockDocument('Invalid');
        const symbols = await provider.provideDocumentSymbols(doc, null as any);
        assert.deepStrictEqual(symbols, []);
    });

    test('Returns empty array if no feature is found', async () => {
        const doc = createMockDocument('# Just a comment');
        const symbols = await provider.provideDocumentSymbols(doc, null as any);
        assert.deepStrictEqual(symbols, []);
    });

    test('Handles Scenario Outline with missing Examples gracefully', async () => {
        const text = `
Feature: Test
  Scenario Outline: Missing examples
    Given I have <thing>
        `.trim();
        const doc = createMockDocument(text);
        const symbols = await provider.provideDocumentSymbols(doc, null as any);
        
        assert.ok(symbols);
        assert.strictEqual(symbols.length, 1);
        const featureSymbol = symbols[0];
        assert.strictEqual(featureSymbol.children.length, 1);
        assert.strictEqual(featureSymbol.children[0].name, 'Scenario Outline: Missing examples');
        // Steps are nested inside the Scenario Outline even without Examples
        assert.strictEqual(featureSymbol.children[0].children.length, 1);
    });

    test('Handles multiple Feature blocks gracefully', async () => {
        // Technically invalid Gherkin, but the parser returns a partial document usually 
        // with the first Feature.
        const text = `
Feature: First Feature
  Scenario: S1
    Given step 1
Feature: Second Feature
  Scenario: S2
    Given step 2
        `.trim();
        const doc = createMockDocument(text);
        const symbols = await provider.provideDocumentSymbols(doc, null as any);
        
        // DocumentSymbolProvider should return whatever the AST yields
        assert.ok(symbols);
        assert.strictEqual(symbols.length, 1);
        assert.strictEqual(symbols[0].name, 'Feature: First Feature');
    });

    test('Handles Background placed incorrectly gracefully', async () => {
        // Background placed after a Scenario
        const text = `
Feature: Test
  Scenario: S1
    Given step
  Background: Misplaced
    Given background step
        `.trim();
        const doc = createMockDocument(text);
        const symbols = await provider.provideDocumentSymbols(doc, null as any);
        
        assert.ok(symbols);
        assert.strictEqual(symbols.length, 1);
        const featureSymbol = symbols[0];
        // The Gherkin AST parser usually drops elements that are placed illegally, 
        // such as a Background after a Scenario, so it only has 1 child.
        assert.strictEqual(featureSymbol.children.length, 1);
        assert.strictEqual(featureSymbol.children[0].name, 'Scenario: S1');
    });
});
