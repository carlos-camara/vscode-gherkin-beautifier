import * as assert from 'assert';
import { generateSafeRegexSnippet, validateSnippetAgainstRegex } from '../../completion';

suite('Regex Snippet Generation & Validation', () => {

    test('Supported subset: Simple text', () => {
        const pattern = 'I have an apple';
        const regex = new RegExp('^I have an apple$', 'i');
        const snippet = generateSafeRegexSnippet(pattern, regex);
        assert.strictEqual(snippet, 'I have an apple');
    });

    test('Supported subset: Alternation (non-capturing)', () => {
        const pattern = 'I (?:choose|select) the option';
        const regex = new RegExp('^I (?:choose|select) the option$', 'i');
        const snippet = generateSafeRegexSnippet(pattern, regex);
        assert.strictEqual(snippet, 'I choose the option');
    });

    test('Supported subset: Alternation (capturing)', () => {
        const pattern = 'I choose the (first|second) option';
        const regex = new RegExp('^I choose the (first|second) option$', 'i');
        const snippet = generateSafeRegexSnippet(pattern, regex);
        assert.strictEqual(snippet, 'I choose the ${1:first} option');
    });

    test('Supported subset: Optional group', () => {
        const pattern = 'optional(?: word)? here';
        const regex = new RegExp('^optional(?: word)? here$', 'i');
        const snippet = generateSafeRegexSnippet(pattern, regex);
        assert.strictEqual(snippet, 'optional word here');
    });

    test('Supported subset: Named capture groups with character classes', () => {
        const pattern = 'I log in as (?P<role>\\w+)';
        const regex = new RegExp('^I log in as (\\w+)$', 'i');
        const snippet = generateSafeRegexSnippet(pattern, regex);
        assert.strictEqual(snippet, 'I log in as ${1:role}');
    });

    test('Supported subset: Escaped punctuation', () => {
        const pattern = 'I have \\$100\\.00';
        const regex = new RegExp('^I have \\$100\\.00$', 'i');
        const snippet = generateSafeRegexSnippet(pattern, regex);
        assert.strictEqual(snippet, 'I have $100.00');
    });

    test('Fallback UX: Complex numeric bounds (failed validation)', () => {
        const pattern = 'price is \\$(?P<price>\\d+\\.\\d{2})';
        const regex = new RegExp('^price is \\$(\\d+\\.\\d{2})$', 'i');
        const snippet = generateSafeRegexSnippet(pattern, regex);
        // Because \\d{2} is not replaced by the generator, the concrete text has "d{2}"
        // which fails validation. This is correct fallback behavior.
        assert.strictEqual(snippet, null);
    });

    test('Fallback UX: Character classes (failed validation)', () => {
        const pattern = 'user [a-zA-Z0-9_-]+ exists';
        const regex = new RegExp('^user [a-zA-Z0-9_-]+ exists$', 'i');
        const snippet = generateSafeRegexSnippet(pattern, regex);
        assert.strictEqual(snippet, null);
    });

    test('Fallback UX: Unsupported Lookarounds', () => {
        const pattern = '(?<=foo)bar';
        let regex: RegExp | undefined;
        try {
            regex = new RegExp('^(?<=foo)bar$', 'i');
        } catch (e) {
            // Environment might not support lookbehinds, ignore
        }
        if (regex) {
            const snippet = generateSafeRegexSnippet(pattern, regex);
            assert.strictEqual(snippet, null);
        }
    });

    suite('Property-style Validation', () => {
        const validPatterns = [
            { raw: 'I have (\\d+) apples', js: 'I have (\\d+) apples' },
            { raw: 'I (?:choose|select) the (first|second) option', js: 'I (?:choose|select) the (first|second) option' },
            { raw: 'I log in as (?P<role>\\w+)', js: 'I log in as (\\w+)' },
            { raw: 'optional(?: word)? here', js: 'optional(?: word)? here' },
            { raw: '^anchored step$', js: '^anchored step$' }
        ];

        validPatterns.forEach(({ raw, js }) => {
            test(`Validates pattern: ${raw}`, () => {
                const regex = new RegExp('^' + js + '$', 'i');
                const snippet = generateSafeRegexSnippet(raw, regex);
                assert.ok(snippet !== null, `Snippet should not be null for ${raw}`);
                
                const isValid = validateSnippetAgainstRegex(snippet!, regex);
                assert.ok(isValid, `Concrete text for ${snippet} should match ${regex}`);
            });
        });
    });
});
