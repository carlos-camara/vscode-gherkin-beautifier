import * as assert from 'assert';
import * as vscode from 'vscode';
import { dialectService } from '../../dialect';

suite('DialectService Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('English dialect (default)', async () => {
        const text = `Feature: Hello
  Scenario: World
    Given I do a thing
    When I do another thing
    Then I get a result
    And I get another result
    But I don't get this result`;

        const dialect = dialectService.detectDialect(text);
        assert.strictEqual(dialect.name, 'English');

        const stepKeywords = dialectService.getStepKeywords(dialect);
        assert.ok(stepKeywords.includes('Given '));
        assert.ok(stepKeywords.includes('When '));
        assert.ok(stepKeywords.includes('Then '));
        assert.ok(stepKeywords.includes('And '));
        assert.ok(stepKeywords.includes('But '));

        const blockKeywords = dialectService.getBlockKeywords(dialect);
        assert.ok(blockKeywords.includes('Feature'));
        assert.ok(blockKeywords.includes('Scenario'));
        assert.ok(blockKeywords.includes('Background'));
        assert.ok(blockKeywords.includes('Rule'));
    });

    test('Spanish dialect', async () => {
        const text = `# language: es
Característica: Hola
  Escenario: Mundo
    Dado que hago una cosa
    Cuando hago otra cosa
    Entonces obtengo un resultado
    Y obtengo otro resultado
    Pero no obtengo este resultado`;

        const dialect = dialectService.detectDialect(text);
        assert.strictEqual(dialect.name, 'Spanish');

        const stepKeywords = dialectService.getStepKeywords(dialect);
        assert.ok(stepKeywords.includes('Dado '));
        assert.ok(stepKeywords.includes('Cuando '));
        assert.ok(stepKeywords.includes('Entonces '));
        assert.ok(stepKeywords.includes('Y '));
        assert.ok(stepKeywords.includes('Pero '));

        const blockKeywords = dialectService.getBlockKeywords(dialect);
        assert.ok(blockKeywords.includes('Característica'));
        assert.ok(blockKeywords.includes('Escenario'));
    });

    test('French dialect', async () => {
        const text = `# language: fr
Fonctionnalité: Bonjour
  Scénario: Monde
    Soit je fais une chose
    Quand je fais autre chose
    Alors j'obtiens un résultat
    Et j'obtiens un autre résultat
    Mais je n'obtiens pas ce résultat`;

        const dialect = dialectService.detectDialect(text);
        assert.strictEqual(dialect.name, 'French');

        const stepKeywords = dialectService.getStepKeywords(dialect);
        assert.ok(stepKeywords.includes('Soit '));
        assert.ok(stepKeywords.includes('Quand '));
        assert.ok(stepKeywords.includes('Alors '));
        assert.ok(stepKeywords.includes('Et '));
        assert.ok(stepKeywords.includes('Mais '));

        const blockKeywords = dialectService.getBlockKeywords(dialect);
        assert.ok(blockKeywords.includes('Fonctionnalité'));
        assert.ok(blockKeywords.includes('Scénario'));
    });

    test('German dialect', async () => {
        const text = `# language: de
Funktionalität: Hallo
  Szenario: Welt
    Angenommen ich tue etwas
    Wenn ich noch etwas tue
    Dann erhalte ich ein Ergebnis
    Und ich erhalte noch ein Ergebnis
    Aber ich erhalte dieses Ergebnis nicht`;

        const dialect = dialectService.detectDialect(text);
        assert.strictEqual(dialect.name, 'German');

        const stepKeywords = dialectService.getStepKeywords(dialect);
        assert.ok(stepKeywords.includes('Angenommen '));
        assert.ok(stepKeywords.includes('Wenn '));
        assert.ok(stepKeywords.includes('Dann '));
        assert.ok(stepKeywords.includes('Und '));
        assert.ok(stepKeywords.includes('Aber '));

        const blockKeywords = dialectService.getBlockKeywords(dialect);
        assert.ok(blockKeywords.includes('Funktionalität'));
        assert.ok(blockKeywords.includes('Szenario'));
    });

    test('resolveDocumentLineSemanticType Resolution (Spanish)', async () => {
        const docText = `# language: es
Característica: Prueba
  Escenario: Prueba
    Dado un paso inicial
    Y un paso secundario
    Pero no esto
    Cuando hago algo
    Y hago otra cosa
    Entonces veo resultados
    Y veo mas cosas
    Pero no veo esto`;

        const document = await vscode.workspace.openTextDocument({ content: docText, language: 'feature' });

        // Line 3: "Dado un paso inicial" (given)
        // Line 4: "Y un paso secundario" -> should resolve to given
        assert.strictEqual(dialectService.resolveDocumentLineSemanticType(document, 4), 'given');
        // Line 5: "Pero no esto" -> should resolve to given
        assert.strictEqual(dialectService.resolveDocumentLineSemanticType(document, 5), 'given');

        // Line 6: "Cuando hago algo" (when)
        // Line 7: "Y hago otra cosa" -> should resolve to when
        assert.strictEqual(dialectService.resolveDocumentLineSemanticType(document, 7), 'when');

        // Line 8: "Entonces veo resultados" (then)
        // Line 9: "Y veo mas cosas" -> should resolve to then
        assert.strictEqual(dialectService.resolveDocumentLineSemanticType(document, 9), 'then');
        // Line 10: "Pero no veo esto" -> should resolve to then
        assert.strictEqual(dialectService.resolveDocumentLineSemanticType(document, 10), 'then');
    });

    test('resolveKeywordSemanticType contract', async () => {
        const dialect = dialectService.detectDialect('');
        // Direct exact match
        assert.strictEqual(dialectService.resolveKeywordSemanticType('Given ', dialect, 'step'), 'given');
        assert.strictEqual(dialectService.resolveKeywordSemanticType('When ', dialect, 'step'), 'when');

        // Trimming resilience
        assert.strictEqual(dialectService.resolveKeywordSemanticType('Then', dialect, 'step'), 'then');
        assert.strictEqual(dialectService.resolveKeywordSemanticType(' Then  ', dialect, 'step'), 'then');

        // Continuation inheritance
        assert.strictEqual(dialectService.resolveKeywordSemanticType('And ', dialect, 'given'), 'given');
        assert.strictEqual(dialectService.resolveKeywordSemanticType('But ', dialect, 'when'), 'when');
        assert.strictEqual(dialectService.resolveKeywordSemanticType('* ', dialect, 'then'), 'then');

        // Continuation default (no prior context)
        assert.strictEqual(dialectService.resolveKeywordSemanticType('And ', dialect, 'step'), 'step');

        // Malformed keyword explicitly returns 'step'
        assert.strictEqual(dialectService.resolveKeywordSemanticType('Garbage ', dialect, 'given'), 'step');
    });

    test('Regex generation', async () => {
        const text = `# language: es\n`;
        const dialect = dialectService.detectDialect(text);

        const structureRegex = dialectService.getStructureRegex(dialect);
        assert.ok(structureRegex.test('  Característica: Hola'));
        assert.ok(structureRegex.test('  Escenario: Hola'));

        const stepRegex = dialectService.getStepRegex(dialect);
        assert.ok(stepRegex.test('Dado algo'));
        const match = 'Dado algo'.match(stepRegex);
        assert.strictEqual(match?.[1], 'Dado ');
        assert.strictEqual(match?.[2], 'algo');
    });

    test('Handles string input, unknown language, clearCache, and boundary fallback', async () => {
        // String input to getDialect
        const dialect1 = dialectService.getDialect('# language: fr');
        assert.strictEqual(dialect1.name, 'French');

        // Unknown language falls back to English
        const dialectUnknown = dialectService.detectDialect('# language: non_existent_lang_123');
        assert.strictEqual(dialectUnknown.name, 'English');

        // clearCache
        const uri = vscode.Uri.file('/tmp/dialect_test.feature');
        dialectService.clearCache(uri);

        // resolveDocumentLineSemanticType boundary fallback when hitting Scenario line
        const docText = `Scenario: Test\n  And step without given`;
        const document = await vscode.workspace.openTextDocument({ content: docText, language: 'feature' });
        assert.strictEqual(dialectService.resolveDocumentLineSemanticType(document, 1), 'step');
    });
});
