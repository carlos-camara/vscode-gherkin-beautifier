import * as assert from 'assert';
import * as vscode from 'vscode';
import { GherkinDefinitionProvider } from '../../definition';
import { SymbolCache } from '../../cache';

suite('Definition Provider Test Suite', () => {
    let mockCache: SymbolCache;

    setup(() => {
        // We'll mock the cache with a simple stub
        mockCache = {
            getStepDefinitions: (text: string) => {
                if (text === 'I login') {
                    return Promise.resolve([{ uri: vscode.Uri.file('/fake/path.py'), decoratorRange: new vscode.Range(0, 0, 0, 0) }] as any);
                }
                return Promise.resolve([]);
            }
        } as any;
    });

    test('Returns definition for valid step', async () => {
        const provider = new GherkinDefinitionProvider(mockCache);

        const doc = await vscode.workspace.openTextDocument({
            language: 'feature',
            content: 'Given I login'
        });

        const token = new vscode.CancellationTokenSource().token;
        const pos = new vscode.Position(0, 7); // inside 'I login'

        const result = await provider.provideDefinition(doc, pos, token) as vscode.Location[];
        assert.ok(result);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].uri.fsPath.endsWith('path.py'), true);
    });

    test('Returns null for non-step line', async () => {
        const provider = new GherkinDefinitionProvider(mockCache);

        const doc = await vscode.workspace.openTextDocument({
            language: 'feature',
            content: 'Feature: Some feature'
        });

        const token = new vscode.CancellationTokenSource().token;
        const pos = new vscode.Position(0, 0);

        const result = await provider.provideDefinition(doc, pos, token);
        assert.strictEqual(result, null);
    });

    test('Returns null if cancellation requested', async () => {
        const provider = new GherkinDefinitionProvider(mockCache);

        const doc = await vscode.workspace.openTextDocument({
            language: 'feature',
            content: 'Given I login'
        });

        const tokenSource = new vscode.CancellationTokenSource();
        tokenSource.cancel();
        const pos = new vscode.Position(0, 0);

        const result = await provider.provideDefinition(doc, pos, tokenSource.token);
        assert.strictEqual(result, null);
    });

    test('Returns multiple definitions for ambiguous step', async () => {
        // Update mock to return multiple matches for ambiguity
        const oldMock = mockCache.getStepDefinitions;
        mockCache.getStepDefinitions = (text: string) => {
            if (text === 'I am ambiguous') {
                return Promise.resolve([
                    { uri: vscode.Uri.file('/fake/path1.py'), decoratorRange: new vscode.Range(0, 0, 0, 0) },
                    { uri: vscode.Uri.file('/fake/path2.py'), decoratorRange: new vscode.Range(0, 0, 0, 0) }
                ] as any);
            }
            return Promise.resolve([]);
        };

        const provider = new GherkinDefinitionProvider(mockCache);
        const doc = await vscode.workspace.openTextDocument({
            language: 'feature',
            content: 'Given I am ambiguous'
        });

        const token = new vscode.CancellationTokenSource().token;
        const pos = new vscode.Position(0, 7);

        const result = await provider.provideDefinition(doc, pos, token) as vscode.Location[];
        assert.ok(result);
        assert.strictEqual(result.length, 2);

        // Restore mock
        mockCache.getStepDefinitions = oldMock;
    });

    test('Passes contextual semanticType correctly', async () => {
        let passedSemanticType: string | undefined;

        const tempMock = {
            getStepDefinitions: (_text: string, semanticType?: string) => {
                passedSemanticType = semanticType;
                return Promise.resolve([]);
            }
        } as any;

        const provider = new GherkinDefinitionProvider(tempMock);

        // Context: the And should resolve to 'given'
        const doc = await vscode.workspace.openTextDocument({
            language: 'feature',
            content: 'Given I login\nAnd I do something else'
        });

        const token = new vscode.CancellationTokenSource().token;
        const pos = new vscode.Position(1, 7); // inside 'And'

        await provider.provideDefinition(doc, pos, token);
        assert.strictEqual(passedSemanticType, 'given');
    });

    test('Localizes semantic matching properly', async () => {
        let passedSemanticType: string | undefined;

        const tempMock = {
            getStepDefinitions: (_text: string, semanticType?: string) => {
                passedSemanticType = semanticType;
                return Promise.resolve([]);
            }
        } as any;

        const provider = new GherkinDefinitionProvider(tempMock);

        // Context: 'Y' is Spanish for And, should resolve to previous 'Dado' (Given)
        const doc = await vscode.workspace.openTextDocument({
            language: 'feature',
            content: '# language: es\nDado inicio sesión\nY hago otra cosa'
        });

        const token = new vscode.CancellationTokenSource().token;
        const pos = new vscode.Position(2, 5); // inside 'Y'

        await provider.provideDefinition(doc, pos, token);
        assert.strictEqual(passedSemanticType, 'given');
    });

    test('Semantic context boundary: malformed And does not inherit previous block', async () => {
        let passedSemanticType: string | undefined;

        const tempMock = {
            getStepDefinitions: (_text: string, semanticType?: string) => {
                passedSemanticType = semanticType;
                return Promise.resolve([]);
            }
        } as any;

        const provider = new GherkinDefinitionProvider(tempMock);

        const doc = await vscode.workspace.openTextDocument({
            language: 'feature',
            content: 'Feature: F\nBackground:\nThen I fail\nScenario: S\nAnd I fail'
        });

        const token = new vscode.CancellationTokenSource().token;
        const pos = new vscode.Position(4, 5); // inside 'And'

        await provider.provideDefinition(doc, pos, token);
        assert.strictEqual(passedSemanticType, 'step');
    });
});
