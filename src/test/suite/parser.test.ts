import * as assert from 'assert';
import { parseGherkin } from '../../parser';

suite('Parser Architecture Test Suite', () => {

    test('should successfully parse a valid Gherkin document and return no errors', async () => {
        const text = `Feature: Valid feature
  Scenario: Valid scenario
    Given a step
`;
        const result = await parseGherkin(text);
        assert.ok(result.document);
        assert.ok(result.document.feature);
        assert.strictEqual(result.errors.length, 0);
    });

    test('should return partial document and errors when given invalid Gherkin syntax', async () => {
        const text = `Feature: Valid feature
  Scenario: Valid scenario
    Given a step
    Garbage line that is not a step!
`;
        const result = await parseGherkin(text);
        assert.ok(result.document, 'Document should still be returned (partial AST)');
        assert.ok(result.document.feature, 'Feature should be parsed');
        assert.ok(result.errors.length > 0, 'Should contain syntax errors');
        assert.match(result.errors[0].message, /got 'Garbage line/);
    });

    test('should not share parser state across concurrent operations', async () => {
        const validText = `Feature: Valid
  Scenario: S1
    Given valid
`;
        const invalidText = `Feature Invalid
  Scenario Missing Colon
    Given valid
`;

        const [validResult, invalidResult] = await Promise.all([
            parseGherkin(validText),
            parseGherkin(invalidText)
        ]);

        assert.strictEqual(validResult.errors.length, 0);
        assert.ok(invalidResult.errors.length > 0, 'Invalid text should have errors');
    });

    test('should handle extremely malformed documents gracefully', async () => {
        const text = `Feature:
  | table | without | closing
  | just | some | | | pipes
  @tag
  Garbage
  Garbage
  Scenario:
    Given something
  @tag2
  `;
        const result = await parseGherkin(text);
        // The AST might be null entirely if it can't parse anything meaningful
        assert.ok(result.errors.length > 0, 'Should contain syntax errors');
    });

    test('should parse documents with mixed line endings identically', async () => {
        const textLF = 'Feature: F\n  Scenario: S\n    Given step\n';
        const textCRLF = 'Feature: F\r\n  Scenario: S\r\n    Given step\r\n';
        
        const [resultLF, resultCRLF] = await Promise.all([
            parseGherkin(textLF),
            parseGherkin(textCRLF)
        ]);

        assert.strictEqual(resultLF.errors.length, 0);
        assert.strictEqual(resultCRLF.errors.length, 0);
        // The AST should be equivalent in terms of feature name and scenario name
        assert.strictEqual(resultLF.document?.feature?.name, resultCRLF.document?.feature?.name);
        assert.strictEqual(
            resultLF.document?.feature?.children[0]?.scenario?.name,
            resultCRLF.document?.feature?.children[0]?.scenario?.name
        );
    });

    test('stress test: should parse large documents without crashing', async () => {
        // Build a 5000 line feature file
        let text = 'Feature: Large feature\n';
        for (let i = 0; i < 1000; i++) {
            text += `  Scenario: Scenario ${i}\n    Given step ${i}\n    When action ${i}\n    Then result ${i}\n`;
        }

        const startTime = Date.now();
        const result = await parseGherkin(text);
        const duration = Date.now() - startTime;

        assert.strictEqual(result.errors.length, 0);
        assert.ok(result.document?.feature?.children.length === 1000, 'Should parse all 1000 scenarios');
        assert.ok(duration < 2000, `Parsing should be relatively fast, took ${duration}ms`);
    });

    test('should handle completely empty documents', async () => {
        const text = '';
        const result = await parseGherkin(text);
        assert.strictEqual(result.errors.length, 0);
        assert.ok(!result.document?.feature, 'Should return empty document without feature');
    });

    test('should handle feature with no scenarios', async () => {
        const text = 'Feature: Empty feature\n';
        const result = await parseGherkin(text);
        assert.strictEqual(result.errors.length, 0);
        assert.ok(result.document?.feature);
        assert.strictEqual(result.document?.feature?.children.length, 0);
    });
});
