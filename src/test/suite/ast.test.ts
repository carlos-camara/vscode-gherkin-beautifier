import * as assert from 'assert';
import * as vscode from 'vscode';
import { astRepository } from '../../ast';

suite('AST Repository Test Suite', () => {

    setup(() => {
        astRepository.clear();
    });

    test('should parse and cache a document', async () => {
        const doc = {
            uri: vscode.Uri.file('/fake/path.feature'),
            version: 1,
            getText: () => 'Feature: Fake Feature\n'
        };

        const result1 = await astRepository.getAST(doc);
        assert.ok(result1.document);
        assert.ok(result1.document.feature);
        assert.strictEqual(result1.document.feature.name, 'Fake Feature');

        // Calling it again with same version should yield exact same promise
        const result2 = await astRepository.getAST(doc);
        assert.strictEqual(result1, result2, 'Should return cached result');
    });

    test('should invalidate cache when version changes', async () => {
        const doc = {
            uri: vscode.Uri.file('/fake/path.feature'),
            version: 1,
            getText: () => 'Feature: Version 1\n'
        };

        const result1 = await astRepository.getAST(doc);
        assert.strictEqual(result1.document?.feature?.name, 'Version 1');

        doc.version = 2;
        doc.getText = () => 'Feature: Version 2\n';

        const result2 = await astRepository.getAST(doc);
        assert.notStrictEqual(result1, result2, 'Should return new result for new version');
        assert.strictEqual(result2.document?.feature?.name, 'Version 2');
    });

    test('should invalidate cache when invalidate() is called', async () => {
        const doc = {
            uri: vscode.Uri.file('/fake/path.feature'),
            version: 1,
            getText: () => 'Feature: Fake Feature\n'
        };

        const result1 = await astRepository.getAST(doc);
        astRepository.invalidate(doc.uri);

        const result2 = await astRepository.getAST(doc);
        assert.notStrictEqual(result1, result2, 'Should return new result after invalidate()');
    });

});
