import * as assert from 'assert';
import * as vscode from 'vscode';
import { GherkinRenameProvider } from '../../renameProvider';
import { StepRefactoringService } from '../../refactoring';
import { WorkspaceGraph } from '../../graph';
import { SymbolCache } from '../../cache';
import * as sinon from 'sinon';

suite('GherkinRenameProvider Test Suite', () => {
    let symbolCache: SymbolCache;
    let graph: WorkspaceGraph;
    let refactoringService: StepRefactoringService;
    let renameProvider: GherkinRenameProvider;

    setup(() => {
        symbolCache = new SymbolCache();
        graph = new WorkspaceGraph(symbolCache);
        refactoringService = new StepRefactoringService(graph, symbolCache);
        renameProvider = new GherkinRenameProvider(refactoringService, graph);
        
        sinon.stub(graph, 'initialize').resolves();
    });

    teardown(() => {
        sinon.restore();
    });

    test('prepareRename throws error for invalid element', async () => {
        const featureUri = vscode.Uri.file('/fake/test.feature');
        const mockDoc = {
            uri: featureUri,
            lineAt: (line: number) => ({
                range: new vscode.Range(line, 0, line, 20),
                text: 'Not a step'
            })
        } as vscode.TextDocument;

        sinon.stub(graph, 'getAllStepNodes').returns([]);

        try {
            await renameProvider.prepareRename(mockDoc, new vscode.Position(0, 0), {} as any);
            assert.fail('Should have thrown an error');
        } catch (err: any) {
            assert.strictEqual(err.message, 'You cannot rename this element. Only steps and step definitions can be renamed.');
        }
    });

    test('prepareRename returns valid range and placeholder for a feature step', async () => {
        const featureUri = vscode.Uri.file('/fake/test.feature');
        const mockDoc = {
            uri: featureUri,
            lineAt: (line: number) => ({
                range: new vscode.Range(line, 0, line, 20),
                text: 'Given existing step name'
            })
        } as vscode.TextDocument;

        sinon.stub(graph, 'getAllStepNodes').returns([{
            id: `${featureUri.toString()}:1`, // Line 0 -> position.line + 1 = 1
            uri: featureUri.toString(),
            line: 1,
            text: 'Given existing step name',
            keyword: 'Given',
            definitionId: 'fake-def-id'
        } as any]);

        const result = await renameProvider.prepareRename(mockDoc, new vscode.Position(0, 5), {} as any) as any;
        assert.ok(result);
        assert.strictEqual(result.placeholder, 'existing step name');
        assert.strictEqual(result.range.start.character, 6); // 'Given ' is 6 chars
    });

    test('prepareRename returns valid range and placeholder for a python step definition', async () => {
        const pythonUri = vscode.Uri.file('/fake/steps.py');
        const mockDoc = {
            uri: pythonUri,
            lineAt: (line: number) => ({
                range: new vscode.Range(line, 0, line, 30),
                text: '@given("existing step name")'
            })
        } as vscode.TextDocument;

        sinon.stub(graph, 'getAllStepDefNodes').returns([{
            id: 'fake-def-id',
            uri: pythonUri.toString(),
            line: 0, // matching position.line
            pattern: 'existing step name',
            regex: /existing step name/
        } as any]);

        const result = await renameProvider.prepareRename(mockDoc, new vscode.Position(0, 5), {} as any) as any;
        assert.ok(result);
        assert.strictEqual(result.placeholder, 'existing step name');
        assert.strictEqual(result.range.start.character, 0); 
    });

    test('provideRenameEdits delegates to refactoringService', async () => {
        const mockDoc = {} as vscode.TextDocument;
        const mockPos = new vscode.Position(0, 0);
        const expectedEdit = new vscode.WorkspaceEdit();
        
        sinon.stub(refactoringService, 'renameStep').resolves(expectedEdit);

        const result = await renameProvider.provideRenameEdits(mockDoc, mockPos, 'new name', {} as any);
        assert.strictEqual(result, expectedEdit);
    });
});
