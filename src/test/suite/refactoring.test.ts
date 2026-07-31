import * as assert from 'assert';
import * as vscode from 'vscode';
import { StepRefactoringService } from '../../refactoring';
import { WorkspaceGraph } from '../../graph';
import { SymbolCache } from '../../cache';
import * as sinon from 'sinon';

suite('Step Refactoring Engine Test Suite', () => {
    let symbolCache: SymbolCache;
    let graph: WorkspaceGraph;
    let refactoringService: StepRefactoringService;

    setup(() => {
        symbolCache = new SymbolCache();
        graph = new WorkspaceGraph(symbolCache);
        refactoringService = new StepRefactoringService(graph, symbolCache);
        
        // Stub initialization to prevent actual FS scanning
        sinon.stub(graph, 'initialize').resolves();

        sinon.stub(vscode.workspace, 'openTextDocument').callsFake(async (uri) => {
            if (uri && typeof uri !== 'string' && uri.toString().endsWith('.py')) {
                return {
                    uri,
                    getText: () => 'from behave import *\n',
                    lineCount: 2,
                    lineAt: (line: number) => ({
                        range: new vscode.Range(line, 0, line, 20),
                        text: `@step('old step name')`
                    })
                } as any;
            } else if (uri && typeof uri !== 'string' && uri.toString().endsWith('.feature')) {
                return {
                    uri,
                    lineAt: (line: number) => ({
                        range: new vscode.Range(line, 0, line, 20),
                        text: line === 2 ? 'Given step a' : 'And step b'
                    })
                } as any;
            }
            return {} as any;
        });
    });

    teardown(() => {
        sinon.restore();
    });

    test('extractStep replaces feature text and generates Python stub', async () => {
        const featureUri = vscode.Uri.file('/fake/test.feature');
        const pythonUri = vscode.Uri.file('/fake/steps.py');


        const mockDoc = {
            uri: featureUri,
            getText: () => '    Given step 1\n    And step 2'
        } as vscode.TextDocument;
        
        const range = new vscode.Range(new vscode.Position(1, 0), new vscode.Position(2, 14));
        const edit = await refactoringService.extractStep(mockDoc, range, 'extracted step', pythonUri);

        assert.ok(edit);
        const featureEdits = edit.entries().find(e => e[0] && e[0].toString() === featureUri.toString());
        assert.ok(featureEdits, 'Feature file should be edited');
        assert.strictEqual(featureEdits[1][0].newText, '    Given extracted step');

        const pythonEdits = edit.entries().find(e => e[0] && e[0].toString() === pythonUri.toString());
        assert.ok(pythonEdits, 'Python file should be edited');
        assert.ok(pythonEdits[1][0].newText.includes("@given('extracted step')"));
        assert.ok(pythonEdits[1][0].newText.includes('context.execute_steps'));
        assert.ok(pythonEdits[1][0].newText.includes('Given step 1'));
    });

    test('renameStep updates python definition and feature files', async () => {
        const featureUri = vscode.Uri.file('/fake/test.feature');
        const pythonUri = vscode.Uri.file('/fake/steps.py');

        sinon.stub(graph, 'getAllStepDefNodes').returns([{
            id: `${pythonUri.toString()}:5`,
            uri: pythonUri.toString(),
            line: 5,
            pattern: 'old step name',
            regex: /old step name/
        } as any]);

        sinon.stub(graph, 'getAllStepNodes').returns([{
            id: `${featureUri.toString()}:3`,
            uri: featureUri.toString(),
            line: 3,
            text: 'Given old step name',
            keyword: 'Given',
            definitionId: `${pythonUri.toString()}:5`
        } as any]);

        sinon.stub(graph, 'getUsages').returns([{
            id: `${featureUri.toString()}:3`,
            uri: featureUri.toString(),
            line: 3,
            text: 'Given old step name',
            keyword: 'Given',
            definitionId: `${pythonUri.toString()}:5`
        } as any]);

        const mockDoc = {
            uri: featureUri,
            lineAt: (line: number) => ({
                range: new vscode.Range(line, 0, line, 20),
                text: 'Given old step name'
            })
        } as vscode.TextDocument;

        sinon.stub(symbolCache, 'getAllStepDefinitions').resolves([{
            uri: pythonUri,
            decoratorRange: new vscode.Range(5, 0, 5, 20),
            pattern: 'old step name',
            line: 5,
            range: new vscode.Range(5, 0, 7, 0)
        } as any]);

        const edit = await refactoringService.renameStep(mockDoc, new vscode.Position(2, 6), 'new step name');
        assert.ok(edit);

        const featureEdits = edit.entries().find(e => e[0] && e[0].toString() === featureUri.toString());
        assert.ok(featureEdits);
        assert.strictEqual(featureEdits[1][0].newText, 'Given new step name');

        const pythonEdits = edit.entries().find(e => e[0] && e[0].toString() === pythonUri.toString());
        assert.ok(pythonEdits);
        assert.ok(pythonEdits[1][0].newText.includes('new step name'));
    });

    test('mergeSteps updates usages and consolidates definitions', async () => {
        const featureUri = vscode.Uri.file('/fake/test.feature');
        const pythonUri = vscode.Uri.file('/fake/steps.py');

        sinon.stub(graph, 'getAllStepDefNodes').returns([
            { id: `${pythonUri.toString()}:5`, uri: pythonUri.toString(), line: 5, pattern: 'step a' } as any,
            { id: `${pythonUri.toString()}:10`, uri: pythonUri.toString(), line: 10, pattern: 'step b' } as any
        ]);

        sinon.stub(graph, 'getAllStepNodes').returns([
            { id: `${featureUri.toString()}:3`, uri: featureUri.toString(), line: 3, text: 'Given step a', definitionId: `${pythonUri.toString()}:5` } as any,
            { id: `${featureUri.toString()}:4`, uri: featureUri.toString(), line: 4, text: 'And step b', definitionId: `${pythonUri.toString()}:10` } as any
        ]);

        sinon.stub(graph, 'getUsages').callsFake((defId: string) => {
            if (defId === `${pythonUri.toString()}:5`) {
                return [{ id: `${featureUri.toString()}:3`, uri: featureUri.toString(), line: 3, text: 'Given step a', definitionId: `${pythonUri.toString()}:5` } as any];
            } else if (defId === `${pythonUri.toString()}:10`) {
                return [{ id: `${featureUri.toString()}:4`, uri: featureUri.toString(), line: 4, text: 'And step b', definitionId: `${pythonUri.toString()}:10` } as any];
            }
            return [];
        });

        sinon.stub(symbolCache, 'getAllStepDefinitions').resolves([
            { uri: pythonUri, decoratorRange: new vscode.Range(5, 0, 5, 20), pattern: 'step a', line: 5, functionRange: new vscode.Range(5, 0, 7, 0) } as any,
            { uri: pythonUri, decoratorRange: new vscode.Range(10, 0, 10, 20), pattern: 'step b', line: 10, functionRange: new vscode.Range(10, 0, 12, 0) } as any
        ]);



        const edit = await refactoringService.mergeSteps([`${pythonUri.toString()}:5`, `${pythonUri.toString()}:10`], 'merged step');
        assert.ok(edit);

        const featureEdits = edit.entries().find(e => e[0] && e[0].toString() === featureUri.toString());
        assert.ok(featureEdits);
        // It updates step a to merged step, and step b to merged step
        assert.strictEqual(featureEdits[1].length, 2);

        const pythonEdits = edit.entries().find(e => e[0] && e[0].toString() === pythonUri.toString());
        assert.ok(pythonEdits);
        // It renames def-1 and deletes def-2
        assert.strictEqual(pythonEdits[1].length, 2);
    });
});
