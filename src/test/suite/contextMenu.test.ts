import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as sinon from 'sinon';

suite('Context Menu Behavior Test Suite', () => {
    let document: vscode.TextDocument;
    let editor: vscode.TextEditor;

    setup(async () => {
        const featureUri = vscode.Uri.file(path.join(__dirname, '../../../src/test/fixtures/behave/features/hello.feature'));
        document = await vscode.workspace.openTextDocument(featureUri);
        editor = await vscode.window.showTextDocument(document);
        // Wait for activation
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        sinon.restore();
    });

    test('Moving cursor to a step sets gherkinPowerTools.isCursorOnStep to true', async () => {
        const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves();

        // Line 2 in hello.feature is usually a step (e.g. "Given we have behave installed")
        const position = new vscode.Position(2, 6);
        editor.selection = new vscode.Selection(position, position);

        // Wait for selection event to fire and be processed
        await new Promise(resolve => setTimeout(resolve, 200));

        // Check if setContext was called with true
        const setContextCall = executeCommandStub.getCalls().find(call => 
            call.args[0] === 'setContext' && 
            call.args[1] === 'gherkinPowerTools.isCursorOnStep'
        );

        assert.ok(setContextCall, 'setContext should have been called');
        assert.strictEqual(setContextCall.args[2], true, 'isCursorOnStep should be true when on a step');
    });

    test('Moving cursor to an empty line sets gherkinPowerTools.isCursorOnStep to false', async () => {
        const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves();

        // Line 0 is usually "Feature: ..." or an empty line, not a step
        const position = new vscode.Position(0, 0);
        editor.selection = new vscode.Selection(position, position);

        // Wait for selection event to fire and be processed
        await new Promise(resolve => setTimeout(resolve, 200));

        // Check if setContext was called with false
        const setContextCall = executeCommandStub.getCalls().find(call => 
            call.args[0] === 'setContext' && 
            call.args[1] === 'gherkinPowerTools.isCursorOnStep'
        );

        assert.ok(setContextCall, 'setContext should have been called');
        assert.strictEqual(setContextCall.args[2], false, 'isCursorOnStep should be false when not on a step');
    });
});
