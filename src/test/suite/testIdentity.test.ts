import * as assert from 'assert';
import * as vscode from 'vscode';
import { TestIdentity } from '../../testIdentity';

suite('TestIdentity', () => {
    test('creates and parses feature identity', () => {
        const uri = vscode.Uri.file('/path/to/feature.feature');
        const id = TestIdentity.createId(uri, 'feature');
        const identity = TestIdentity.parse(id);
        
        assert.strictEqual(identity.type, 'feature');
        assert.strictEqual(identity.uri.toString(), uri.toString());
        assert.strictEqual(identity.line, undefined);
    });

    test('creates and parses rule identity', () => {
        const uri = vscode.Uri.file('/path/to/feature.feature');
        const id = TestIdentity.createId(uri, 'rule', 10);
        const identity = TestIdentity.parse(id);
        
        assert.strictEqual(identity.type, 'rule');
        assert.strictEqual(identity.uri.toString(), uri.toString());
        assert.strictEqual(identity.line, 10);
    });
});
