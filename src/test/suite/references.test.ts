import * as assert from 'assert';
import * as vscode from 'vscode';
import { GherkinReferenceProvider } from '../../references';

suite('Reference Provider Test Suite', () => {
    let mockCache: any;
    let mockGraph: any;

    setup(() => {
        mockCache = {
            getAllStepDefinitions: () => Promise.resolve([
                {
                    id: 'fake_def',
                    uri: vscode.Uri.file('/fake/steps.py'),
                    decoratorRange: new vscode.Range(0, 0, 0, 20),
                    functionRange: new vscode.Range(1, 0, 2, 0)
                }
            ]),
            getStepDefinitions: (text: string) => {
                if (text === 'user exists') {
                    return Promise.resolve([
                        {
                            id: 'fake_def',
                            uri: vscode.Uri.file('/fake/steps.py'),
                            decoratorRange: new vscode.Range(0, 0, 0, 20),
                            functionRange: new vscode.Range(1, 0, 2, 0)
                        }
                    ]);
                }
                return Promise.resolve([]);
            }
        };

        mockGraph = {
            currentGeneration: {
                getUsages: (_defId: string) => {
                    // Match the generated ID: canonicalUri:line
                    // The canonical URI in getCanonicalUriString might be 'file:///fake/steps.py'
                    // For testing, let's just return a mock StepNode
                    return [
                        { uri: 'file:///fake/feature.feature', line: 1 }, // feature file, 1-indexed
                        { uri: 'file:///fake/script.py', line: 5 } // python file, 0-indexed
                    ];
                }
            }
        };
    });

    test('Returns usages for a Python step definition decorator', async () => {
        const provider = new GherkinReferenceProvider(mockGraph as any, mockCache as any);
        
        const doc = {
            languageId: 'python',
            uri: vscode.Uri.file('/fake/steps.py'),
            lineAt: (_line: number) => ({ text: '@given("user exists")' }),
            getText: () => '@given("user exists")\ndef user_exists(): pass',
            lineCount: 2
        } as unknown as vscode.TextDocument;

        const position = new vscode.Position(0, 5);
        const context: vscode.ReferenceContext = { includeDeclaration: false };
        const token = new vscode.CancellationTokenSource().token;

        const references = await provider.provideReferences(doc, position, context, token);
        
        assert.ok(references);
        assert.strictEqual(references.length, 2);
        
        // 1-indexed feature line => 0-indexed position
        assert.strictEqual(references[0].uri.fsPath.endsWith('feature.feature'), true);
        assert.strictEqual(references[0].range.start.line, 0); 
        
        // 0-indexed python line => 0-indexed position
        assert.strictEqual(references[1].uri.fsPath.endsWith('script.py'), true);
        assert.strictEqual(references[1].range.start.line, 5);
    });

    test('Returns usages and declaration when includeDeclaration is true', async () => {
        const provider = new GherkinReferenceProvider(mockGraph as any, mockCache as any);
        
        const doc = {
            languageId: 'python',
            uri: vscode.Uri.file('/fake/steps.py'),
            lineAt: (_line: number) => ({ text: '@given("user exists")' }),
            getText: () => '@given("user exists")\ndef user_exists(): pass',
            lineCount: 2
        } as unknown as vscode.TextDocument;

        const position = new vscode.Position(0, 5);
        const context: vscode.ReferenceContext = { includeDeclaration: true };
        const token = new vscode.CancellationTokenSource().token;

        const references = await provider.provideReferences(doc, position, context, token);
        
        assert.ok(references);
        assert.strictEqual(references.length, 3);
        
        // Includes declaration
        const hasDecl = references.some(r => r.uri.fsPath.endsWith('steps.py') && r.range.start.line === 0);
        assert.ok(hasDecl);
    });

    test('Returns usages for a Gherkin step', async () => {
        const provider = new GherkinReferenceProvider(mockGraph as any, mockCache as any);
        
        const doc = {
            languageId: 'feature',
            uri: vscode.Uri.file('/fake/test.feature'),
            lineAt: (_line: number) => ({ text: 'Given user exists' }),
            getText: () => 'Given user exists',
            lineCount: 1
        } as unknown as vscode.TextDocument;

        const position = new vscode.Position(0, 10);
        const context: vscode.ReferenceContext = { includeDeclaration: false };
        const token = new vscode.CancellationTokenSource().token;

        const references = await provider.provideReferences(doc, position, context, token);
        
        assert.ok(references);
        assert.strictEqual(references.length, 2);
        
        assert.strictEqual(references[0].uri.fsPath.endsWith('feature.feature'), true);
        assert.strictEqual(references[1].uri.fsPath.endsWith('script.py'), true);
    });

    test('Returns null for unregistered step', async () => {
        const provider = new GherkinReferenceProvider(mockGraph as any, mockCache as any);
        
        const doc = {
            languageId: 'feature',
            uri: vscode.Uri.file('/fake/test.feature'),
            lineAt: (_line: number) => ({ text: 'Given unknown step' }),
            getText: () => 'Given unknown step',
            lineCount: 1
        } as unknown as vscode.TextDocument;

        const position = new vscode.Position(0, 10);
        const context: vscode.ReferenceContext = { includeDeclaration: false };
        const token = new vscode.CancellationTokenSource().token;

        const references = await provider.provideReferences(doc, position, context, token);
        
        assert.strictEqual(references, null);
    });

    test('Reference Provider Latency Benchmark', async () => {
        const provider = new GherkinReferenceProvider(mockGraph as any, mockCache as any);
        
        const doc = {
            languageId: 'feature',
            uri: vscode.Uri.file('/fake/test.feature'),
            lineAt: (_line: number) => ({ text: 'Given user exists' }),
            getText: () => 'Given user exists',
            lineCount: 1
        } as unknown as vscode.TextDocument;

        const position = new vscode.Position(0, 10);
        const context: vscode.ReferenceContext = { includeDeclaration: false };
        const token = new vscode.CancellationTokenSource().token;

        const start = performance.now();
        const iterations = 1000;
        
        for (let i = 0; i < iterations; i++) {
            await provider.provideReferences(doc, position, context, token);
        }
        
        const end = performance.now();
        const avgMs = (end - start) / iterations;
        
        console.log(`Reference Provider Benchmark (Mocked): ${avgMs.toFixed(3)}ms per request`);
        assert.ok(avgMs < 5, `Reference lookup took too long: ${avgMs}ms`);
    });
});
