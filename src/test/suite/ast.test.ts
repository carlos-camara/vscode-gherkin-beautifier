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

        const result1 = await astRepository.getAST(doc as any);
        astRepository.invalidate(doc.uri);

        const result2 = await astRepository.getAST(doc as any);
        assert.notStrictEqual(result1, result2, 'Should return new result after invalidate()');
    });

    test('should evict oldest cached items when maxCacheBytes is exceeded', async () => {
        // Force maxCacheBytes to 800 for easier testing.
        // Each mock doc below is 16 chars * 20 bytes/char = 320 bytes estimated size.
        // 3 docs = 960 bytes. Target eviction is 75% of 800 = 600 bytes.
        (astRepository as any).maxCacheBytes = 800;

        const doc1 = { uri: vscode.Uri.file('/fake/path1.feature'), version: 1, getText: () => 'Feature: Fake 1\n' };
        const doc2 = { uri: vscode.Uri.file('/fake/path2.feature'), version: 1, getText: () => 'Feature: Fake 2\n' };
        const doc3 = { uri: vscode.Uri.file('/fake/path3.feature'), version: 1, getText: () => 'Feature: Fake 3\n' };

        await astRepository.getAST(doc1 as any);
        // Add small delay to ensure lastAccessed diff
        await new Promise(r => setTimeout(r, 2));
        await astRepository.getAST(doc2 as any);
        await new Promise(r => setTimeout(r, 2));
        
        // At this point cache has 2 items (640 bytes). 
        // Accessing a third pushes to 960 bytes > 800 budget.
        // It evicts until <= 600 bytes, which requires removing both doc1 and doc2.
        await astRepository.getAST(doc3 as any);

        assert.strictEqual((astRepository as any).cache.size, 1);
        assert.ok(!(astRepository as any).cache.has(doc1.uri.toString()), 'Oldest item should be evicted');
        assert.ok(!(astRepository as any).cache.has(doc2.uri.toString()), 'Second oldest should be evicted');
        assert.ok((astRepository as any).cache.has(doc3.uri.toString()));
    });

    test('should handle eventBus events correctly', () => {
        let callback: any;
        const mockEventBus = {
            onEvent: (cb: any) => {
                callback = cb;
                return { dispose: () => {} };
            }
        };

        astRepository.setEventBus(mockEventBus as any);
        assert.ok(callback);

        // Populate cache
        const uri = vscode.Uri.file('/fake/path.feature');
        (astRepository as any).cache.set(uri.toString(), { promise: Promise.resolve() });
        assert.strictEqual((astRepository as any).cache.size, 1);

        // Simulate featureFileChanged
        callback({ type: 'featureFileChanged', uri });
        assert.strictEqual((astRepository as any).cache.size, 0);

        // Repopulate and test featureFileDeleted
        (astRepository as any).cache.set(uri.toString(), { promise: Promise.resolve() });
        callback({ type: 'featureFileDeleted', uri });
        assert.strictEqual((astRepository as any).cache.size, 0);

        // Repopulate and test textDocumentClosed
        (astRepository as any).cache.set(uri.toString(), { promise: Promise.resolve() });
        callback({ type: 'textDocumentClosed', document: { uri } });
        assert.strictEqual((astRepository as any).cache.size, 0);
    });

});
