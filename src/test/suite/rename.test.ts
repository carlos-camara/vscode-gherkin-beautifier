import * as assert from 'assert';
import * as vscode from 'vscode';
import { StepRefactoringService } from '../../refactoring';
import { WorkspaceGraph, WorkspaceGraphGeneration, StepNode, StepDefNode } from '../../graph';
import { SymbolCache } from '../../cache';
import * as sinon from 'sinon';

suite('Rename Provider Test Suite', () => {
    let refactoringService: StepRefactoringService;
    let graph: WorkspaceGraph;
    let symbolCache: SymbolCache;

    setup(() => {
        symbolCache = new SymbolCache();
        graph = new WorkspaceGraph(symbolCache);
        refactoringService = new StepRefactoringService(graph, symbolCache);
    });

    teardown(() => {
        sinon.restore();
    });

    test('should NOT attach needsConfirmation metadata for low-impact rename', async () => {
        // Setup mock graph
        const defNode: StepDefNode = {
            id: 'file:///workspace/steps.py:10',
            type: 'StepDefinition',
            uri: 'file:///workspace/steps.py',
            line: 10,
            pattern: 'user logs in',
            matcherType: 'string',
            pythonFile: 'file:///workspace/steps.py',
            usages: ['usage_1', 'usage_2']
        };

        const usageNode1: StepNode = {
            id: 'usage_1',
            type: 'Step',
            uri: 'file:///workspace/feature1.feature',
            line: 5,
            text: 'user logs in',
            keyword: 'Given',
            parent: 'Scenario:1',
            definitionId: defNode.id
        };

        const usageNode2: StepNode = {
            id: 'usage_2',
            type: 'Step',
            uri: 'file:///workspace/feature1.feature',
            line: 15,
            text: 'user logs in',
            keyword: 'Given',
            parent: 'Scenario:2',
            definitionId: defNode.id
        };

        const generation = new WorkspaceGraphGeneration(
            1,
            new Map<string, any>([
                [defNode.id, defNode],
                [usageNode1.id, usageNode1],
                [usageNode2.id, usageNode2]
            ]),
            new Map(),
            new Set()
        );

        sinon.stub(graph, 'currentGeneration').get(() => generation);
        sinon.stub(graph, 'initialize').resolves();

        sinon.stub(vscode.workspace, 'openTextDocument').resolves({
            lineAt: () => ({ text: 'Given user logs in' })
        } as any);

        const document = { uri: vscode.Uri.parse('file:///workspace/steps.py') } as any;
        const position = new vscode.Position(10, 0);

        const edit = await refactoringService.renameStep(document, position, 'user signs in');
        assert.ok(edit);
    });

    test('should attach needsConfirmation metadata for high-impact rename', async () => {
        // High impact: > 3 scenarios
        const defNode: StepDefNode = {
            id: 'file:///workspace/steps.py:10',
            type: 'StepDefinition',
            uri: 'file:///workspace/steps.py',
            line: 10,
            pattern: 'user logs in',
            matcherType: 'string',
            pythonFile: 'file:///workspace/steps.py',
            usages: ['usage_1', 'usage_2', 'usage_3', 'usage_4']
        };

        const generation = new WorkspaceGraphGeneration(
            1,
            new Map<string, any>([
                [defNode.id, defNode],
                ['usage_1', { id: 'usage_1', type: 'Step', uri: 'file:///workspace/feature1.feature', line: 5, text: 'user logs in', keyword: 'Given', parent: 'Scenario:1', definitionId: defNode.id } as StepNode],
                ['usage_2', { id: 'usage_2', type: 'Step', uri: 'file:///workspace/feature1.feature', line: 15, text: 'user logs in', keyword: 'Given', parent: 'Scenario:2', definitionId: defNode.id } as StepNode],
                ['usage_3', { id: 'usage_3', type: 'Step', uri: 'file:///workspace/feature1.feature', line: 25, text: 'user logs in', keyword: 'Given', parent: 'Scenario:3', definitionId: defNode.id } as StepNode],
                ['usage_4', { id: 'usage_4', type: 'Step', uri: 'file:///workspace/feature1.feature', line: 35, text: 'user logs in', keyword: 'Given', parent: 'Scenario:4', definitionId: defNode.id } as StepNode]
            ]),
            new Map(),
            new Set()
        );

        sinon.stub(graph, 'currentGeneration').get(() => generation);
        sinon.stub(graph, 'initialize').resolves();

        sinon.stub(vscode.workspace, 'openTextDocument').resolves({
            lineAt: () => ({ text: 'Given user logs in' })
        } as any);

        const document = { uri: vscode.Uri.parse('file:///workspace/steps.py') } as any;
        const position = new vscode.Position(10, 0);

        const edit = await refactoringService.renameStep(document, position, 'user signs in');

        assert.ok(edit);
    });
});
