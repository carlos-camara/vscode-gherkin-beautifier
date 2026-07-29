import * as assert from 'assert';
import * as vscode from 'vscode';
import { GherkinFormattingEditProvider, FormatterOptions } from '../../formatter';
import { ConfigurationService } from '../../configuration';

const defaultOptions: FormatterOptions = {
    stepIndentation: 2,
    alignTableToKeyword: true,
    tagsFormat: 'wrap',
    tagsSort: 'preserve',
    emptyLinesBetweenScenarios: 1
};

async function runFormat(formatter: GherkinFormattingEditProvider, unformatted: string): Promise<string> {
    const formattedLines = await formatter.formatGherkin({ uri: vscode.Uri.file('test.feature'), version: 1, getText: () => unformatted }, defaultOptions, { isCancellationRequested: false } as vscode.CancellationToken);
    return formattedLines ? formattedLines.map(l => l.text).join('\n') : '';
}

async function runRangeFormat(formatter: GherkinFormattingEditProvider, unformatted: string, startLine: number, endLine: number): Promise<string> {
    const lines = unformatted.split('\n');
    const doc = {
        getText: (range?: vscode.Range) => {
            if (!range) return unformatted;
            return lines.slice(range.start.line, range.end.line + 1).join('\n');
        },
        eol: vscode.EndOfLine.LF,
        lineAt: (line: number) => ({ text: lines[line] || '' }),
        lineCount: lines.length
    } as any as vscode.TextDocument;
    
    const range = new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length);
    const edits = await formatter.provideDocumentRangeFormattingEdits(doc, range, {} as vscode.FormattingOptions, { isCancellationRequested: false } as vscode.CancellationToken);
    
    if (edits && edits.length > 0) {
        return edits[0].newText;
    }
    return doc.getText(range); // Idempotent or no-op
}


const mockConfigService = new ConfigurationService({
    name: 'mock',
    set: () => {},
    delete: () => {},
    clear: () => {},
    forEach: () => {},
    get: () => [],
    has: () => false,
    dispose: () => {}
} as any);

suite('Formatter Test Suite', () => {
    test('Format simple feature and scenario with proper spacing', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: Login',
            'Scenario: Success',
            'Given I am on the login page',
            'Then I should see the dashboard',
            '@smoke',
            'Scenario: Failure',
            'Given I enter wrong credentials'
        ].join('\n');

        const result = await runFormat(formatter, unformatted);
        const formatted = result.split('\n');

        assert.strictEqual(formatted[0], 'Feature: Login');
        assert.strictEqual(formatted[1], '');
        assert.strictEqual(formatted[2], '  Scenario: Success');
        assert.strictEqual(formatted[3], '    Given I am on the login page');
        assert.strictEqual(formatted[4], '    Then I should see the dashboard');
        assert.strictEqual(formatted[5], '');
        assert.strictEqual(formatted[6], '  @smoke');
        assert.strictEqual(formatted[7], '  Scenario: Failure');
        assert.strictEqual(formatted[8], '    Given I enter wrong credentials');
    });

    test('Align tables dynamically to preceding step indentation and handle escaped pipes', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: Tables',
            'Scenario: Align',
            'Given users:',
            '|username|password|',
            '|user1|pass\\|123|',
            '|admin_user|extremely_long_password|'
        ].join('\n');

        const result = await runFormat(formatter, unformatted);
        const formatted = result.split('\n');

        assert.strictEqual(formatted[3], '    Given users:');
        assert.strictEqual(formatted[4], '          | username   | password                |');
        assert.strictEqual(formatted[5], '          | user1      | pass\\|123               |');
        assert.strictEqual(formatted[6], '          | admin_user | extremely_long_password |');
    });



    test('Wraps long tag lists', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const tags = Array.from({ length: 10 }, (_, i) => `@tag${i}`).join(' ');
        const unformatted = [
            tags,
            'Feature: Tag wrap'
        ].join('\n');

        const result = await runFormat(formatter, unformatted);
        // The first tag line will contain tags up to 80 chars
        const formatted = result.split('\n');
        assert.ok(formatted[0].length <= 80);
        assert.ok(formatted[1].length <= 80);
        assert.strictEqual(formatted[formatted.length - 1], 'Feature: Tag wrap');
    });

    test('Preserves source order and duplicate tags by default', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            '@zebra @apple @zebra @banana',
            'Feature: Tag sorting'
        ].join('\n');

        const result = await runFormat(formatter, unformatted);
        const formatted = result.split('\n');
        assert.strictEqual(formatted[0], '@zebra @apple @zebra @banana');
    });

    test('Sorts tags alphabetically when configured', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            '@zebra @apple @zebra @banana',
            'Feature: Tag sorting'
        ].join('\n');

        const customOptions: FormatterOptions = {
            ...defaultOptions,
            tagsSort: 'alphabetical'
        };

        const resultLines = await formatter.formatGherkin({ uri: vscode.Uri.file('test.feature'), version: 1, getText: () => unformatted }, customOptions, { isCancellationRequested: false } as vscode.CancellationToken);
        const result = resultLines ? resultLines.map(l => l.text).join('\n') : '';
        const formatted = result.split('\n');
        assert.strictEqual(formatted[0], '@apple @banana @zebra @zebra');
    });

    test('Formats docstrings and standalone comments correctly', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: Docs',
            'Scenario: Docstrings',
            'Given a docstring:',
            '"""',
            'some content',
            '',
            '  more content',
            '"""',
            '# standalone comment',
            'Then success'
        ].join('\n');

        const result = await runFormat(formatter, unformatted);
        const formatted = result.split('\n');
        
        assert.strictEqual(formatted[2], '  Scenario: Docstrings');
        assert.strictEqual(formatted[3], '    Given a docstring:');
        assert.strictEqual(formatted[4], '      """');
        assert.strictEqual(formatted[5], '      some content');
        assert.strictEqual(formatted[6], '');
        assert.strictEqual(formatted[7], '        more content'); // preserve inner whitespace relative to docstring
        assert.strictEqual(formatted[8], '      """');
        assert.strictEqual(formatted[9], '    # standalone comment');
        assert.strictEqual(formatted[10], '    Then success');
    });

    test('Formats Rules, Backgrounds, and Examples', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: complex',
            'Rule: This is a rule',
            'Background: setup',
            'Given rule setup',
            'Scenario Outline: complex scenario',
            'Given <param>',
            '@tag',
            'Examples:',
            '|param|',
            '|val|'
        ].join('\n');

        const result = await runFormat(formatter, unformatted);
        const formatted = result.split('\n');

        assert.strictEqual(formatted[0], 'Feature: complex');
        assert.strictEqual(formatted[2], '  Rule: This is a rule');
        assert.strictEqual(formatted[4], '    Background: setup');
        assert.strictEqual(formatted[5], '      Given rule setup');
        assert.strictEqual(formatted[7], '    Scenario Outline: complex scenario');
        assert.strictEqual(formatted[8], '      Given <param>');
        assert.strictEqual(formatted[10], '      @tag');
        assert.strictEqual(formatted[11], '      Examples:');
        assert.strictEqual(formatted[12], '        | param |');
        assert.strictEqual(formatted[13], '        | val   |');
    });

    test('Preserves parent-relative descriptions and removes trailing empty lines', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: desc',
            'this is a feature description line',
            'Scenario: scenario',
            'this is a scenario description',
            'Given step',
            '',
            ''
        ].join('\n');

        const result = await runFormat(formatter, unformatted);
        const formatted = result.split('\n');
        
        assert.strictEqual(formatted[0], 'Feature: desc');
        assert.strictEqual(formatted[1], '  this is a feature description line');
        assert.strictEqual(formatted[3], '  Scenario: scenario');
        assert.strictEqual(formatted[4], '    this is a scenario description');
        assert.strictEqual(formatted[5], '    Given step');
        assert.strictEqual(formatted.length, 6); // no trailing empty lines outputted by formatGherkin directly
    });

    test('Refuses to format on invalid syntax', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'BlahBlahBlah: test',
            'This is not valid Gherkin at all'
        ].join('\n');

        const result = await runFormat(formatter, unformatted);
        assert.strictEqual(result, '');
    });

    test('Preserves CRLF', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = 'Feature: CRLF\r\nScenario: test\r\nGiven a step';
        const mockDocument = {
            getText: () => unformatted,
            lineCount: 3,
            eol: vscode.EndOfLine.CRLF,
            lineAt: (line: number) => ({ text: unformatted.split('\r\n')[line] || '' })
        } as any;
        const edits = await formatter.provideDocumentFormattingEdits(mockDocument, {} as any, { isCancellationRequested: false } as any);
        if (edits.length > 0) {
            assert.ok(edits[0].newText.includes('\r\n'));
            assert.ok(!edits[0].newText.includes('\nScenario')); 
        }
    });

    test('Idempotency - formatting twice yields the same output', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: Idempotency',
            '  Description',
            '',
            '  Scenario: First',
            '    Given setup'
        ].join('\n');

        const result1 = await runFormat(formatter, unformatted);
        const result2 = await runFormat(formatter, result1);
        
        assert.strictEqual(result1, result2);
    });

    test('Format feature with language header (i18n)', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            '# language: es',
            'Característica: Inicio de sesión',
            'Escenario: Éxito',
            'Dado que estoy en la página de inicio'
        ].join('\n');

        const result = await runFormat(formatter, unformatted);
        const formatted = result.split('\n');

        assert.strictEqual(formatted[0].trim(), '# language: es'); // Comments might inherit indent from next node, which might be 0, but trim to be safe
        assert.strictEqual(formatted[1], 'Característica: Inicio de sesión');
        assert.strictEqual(formatted[2], '');
        assert.strictEqual(formatted[3], '  Escenario: Éxito');
        assert.strictEqual(formatted[4], '    Dado que estoy en la página de inicio');
    });

    test('Format with custom options (no table alignment, custom step indentation)', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: F',
            'Scenario: S',
            'Given data:',
            '|col1|col2|',
            '|val1|extremely_long_val2|'
        ].join('\n');

        const customOptions: FormatterOptions = {
            stepIndentation: 4, // 2 spaces for scenario + 4 for step = 6 spaces
            alignTableToKeyword: false, // Do not align table to "Given"
            tagsFormat: 'wrap',
            tagsSort: 'preserve',
            emptyLinesBetweenScenarios: 1
        };

        const resultLines = await formatter.formatGherkin({ uri: vscode.Uri.file('test.feature'), version: 1, getText: () => unformatted }, customOptions, { isCancellationRequested: false } as vscode.CancellationToken);
        const result = resultLines ? resultLines.map(l => l.text).join('\n') : '';
        const formatted = result.split('\n');

        assert.strictEqual(formatted[0], 'Feature: F');
        assert.strictEqual(formatted[1], ''); // emptyLineBetweenScenarios
        assert.strictEqual(formatted[2], '  Scenario: S');
        assert.strictEqual(formatted[3], '      Given data:');
        
        // Table should have its own 6 spaces instead of keyword alignment
        assert.strictEqual(formatted[4], '        | col1 | col2                |');
        assert.strictEqual(formatted[5], '        | val1 | extremely_long_val2 |');
    });
});

suite('Formatter VS Code API Wrapper Tests', () => {
    test('provideDocumentFormattingEdits checks idempotency and final newline', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        
        const textWithNewline = 'Feature: Final Newline\n';
        const mockDocument = {
            getText: () => textWithNewline,
            lineCount: 2,
            eol: vscode.EndOfLine.LF
        } as any;
        
        const edits = await formatter.provideDocumentFormattingEdits(mockDocument, {} as any, { isCancellationRequested: false } as any);
        
        // Should return [] because it's already correctly formatted and idempotent
        assert.strictEqual(edits.length, 0);

        const textWithoutNewline = 'Feature: Final Newline';
        const mockDocument2 = {
            getText: () => textWithoutNewline,
            lineCount: 1,
            eol: vscode.EndOfLine.LF
        } as any;
        
        const edits2 = await formatter.provideDocumentFormattingEdits(mockDocument2, {} as any, { isCancellationRequested: false } as any);
        
        // Output will be the same as input, but without final newline
        assert.strictEqual(edits2.length, 0);
    });

    test('Range formatting: selection inside a step', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: F',
            'Scenario: S',
            'Given     unformatted step',
            'Then end'
        ].join('\n');
        
        // line 2: 'Given     unformatted step'
        const result = await runRangeFormat(formatter, unformatted, 2, 2);
        // VS Code defaults stepIndentation to 4. Scenario is 2, Step is 6.
        assert.strictEqual(result, '      Given     unformatted step');
    });

    test('Range formatting: selection across multiple steps expands to Scenario', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: F',
            'Scenario: S',
            'Given     1',
            'Then     2',
            'And   3'
        ].join('\n');
        
        // line 2 to 3 expands to the smallest node encompassing both (Scenario)
        const result = await runRangeFormat(formatter, unformatted, 2, 3);
        assert.strictEqual(result, '\n  Scenario: S\n      Given     1\n      Then     2\n      And   3');
    });

    test('Range formatting: table selection expands to full table', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: F',
            'Scenario: S',
            'Given users:',
            '|username|pass|',
            '|u1|p1|'
        ].join('\n');
        
        // line 4 (the second row) -> expands to the entire DataTable node
        const result = await runRangeFormat(formatter, unformatted, 4, 4);
        assert.strictEqual(result, '            | username | pass |\n            | u1       | p1   |');
    });

    test('Range formatting: DocString selection', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: F',
            'Scenario: S',
            'Given doc:',
            '"""',
            '  hello',
            '"""'
        ].join('\n');
        
        // line 4 ('  hello')
        const result = await runRangeFormat(formatter, unformatted, 4, 4);
        assert.strictEqual(result, '        """\n          hello\n        """');
    });

    test('Range formatting: tags', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            '@t1 @t2 @t3',
            'Feature: F'
        ].join('\n');
        
        // line 0
        const result = await runRangeFormat(formatter, unformatted, 0, 0);
        assert.strictEqual(result, '@t1 @t2 @t3');
    });

    test('Range formatting: Rule and formatting that inserts blank lines', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: F',
            'Rule: R',
            'Scenario: S1',
            'Given 1',
            'Scenario: S2',
            'Given 2'
        ].join('\n');
        
        // Formatter should insert a blank line before Scenario: S2
        // If we select just Scenario: S2 (line 4)
        const result = await runRangeFormat(formatter, unformatted, 4, 4);
        // It expands to Scenario 2 and its steps
        assert.strictEqual(result, '\n    Scenario: S2\n        Given 2');
    });

    test('Range formatting: syntax errors fallback gracefully', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Scenario: S', // Missing Feature keyword causes fatal AST parser error
            'Given 1'
        ].join('\n');
        
        // Since formatting fails on invalid syntax, it should return original unformatted slice
        const result = await runRangeFormat(formatter, unformatted, 1, 1);
        assert.strictEqual(result, 'Given 1');
    });

    test('Range formatting: selection partially inside a Table', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: F',
            'Scenario: S',
            'Given users:',
            '|u1|p1|',
            '|u2|p2|'
        ].join('\n');
        
        // select lines 3 and 4 (header and first row only)
        const result = await runRangeFormat(formatter, unformatted, 3, 4);
        assert.strictEqual(result, '            | u1 | p1 |\n            | u2 | p2 |');
    });

    test('Range formatting: selection inside Examples block expands to full Examples', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: F',
            'Scenario Outline: S',
            'Given <user>',
            'Examples:',
            '|user|',
            '|u1|',
            '|u2|'
        ].join('\n');
        
        // select line 5 ('|u1|')
        const result = await runRangeFormat(formatter, unformatted, 5, 5);
        // Should expand to encompass Examples block: lines 3, 4, 5, 6
        assert.strictEqual(result, '\n      Examples:\n        | user |\n        | u1   |\n        | u2   |');
    });

    test('Range formatting: Background selection', async () => {
        const formatter = new GherkinFormattingEditProvider(mockConfigService);
        const unformatted = [
            'Feature: F',
            'Background:',
            'Given bg',
            'Scenario: S',
            'Given s'
        ].join('\n');
        
        // select line 1 ('Background:')
        const result = await runRangeFormat(formatter, unformatted, 1, 1);
        // Expands to Background and its steps (lines 1 to 2)
        assert.strictEqual(result, '\n  Background:\n      Given bg');
    });
});
