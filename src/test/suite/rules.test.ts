import * as assert from 'assert';
import { RULES_REGISTRY, isValidRule, isValidSeverity, RuleId } from '../../rules';

suite('Rules Registry Test Suite', () => {
    test('1. Registry contains required core syntax rules', () => {
        assert.ok(RULES_REGISTRY['syntax-error']);
        assert.ok(RULES_REGISTRY['missing-colon']);
        assert.ok(RULES_REGISTRY['invalid-keyword']);
    });

    test('2. Registry contains anti-pattern rules', () => {
        assert.ok(RULES_REGISTRY['oversized-feature']);
        assert.ok(RULES_REGISTRY['oversized-scenario']);
    });

    test('3. isValidRule returns true for registered rules', () => {
        assert.strictEqual(isValidRule('syntax-error'), true);
        assert.strictEqual(isValidRule('undefined-step'), true);
    });

    test('4. isValidRule returns false for unregistered rules', () => {
        assert.strictEqual(isValidRule('not-a-real-rule' as RuleId), false);
    });

    test('5. isValidSeverity returns true for valid severities', () => {
        assert.strictEqual(isValidSeverity('error'), true);
        assert.strictEqual(isValidSeverity('warning'), true);
        assert.strictEqual(isValidSeverity('info'), true);
        assert.strictEqual(isValidSeverity('hint'), true);
        assert.strictEqual(isValidSeverity('off'), true);
    });

    test('6. isValidSeverity returns false for invalid severities', () => {
        assert.strictEqual(isValidSeverity('critical' as any), false);
        assert.strictEqual(isValidSeverity('ignore' as any), false);
    });

    test('7. Registry has correct types for default severities', () => {
        assert.strictEqual(RULES_REGISTRY['syntax-error'].defaultSeverity, 'error');
        assert.strictEqual(RULES_REGISTRY['ambiguous-step'].defaultSeverity, 'error');
    });
});
