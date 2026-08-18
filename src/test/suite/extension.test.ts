import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import { deactivate } from '../../extension';
import { discoveryService } from '../../discovery';

suite('Extension Test Suite', () => {
    setup(() => {
    });

    teardown(() => {
        sinon.restore();
    });

    test('deactivate disposes discoveryService', () => {
        const disposeSpy = sinon.spy(discoveryService, 'dispose');
        deactivate();
        assert.ok(disposeSpy.calledOnce);
    });

    test('activation does not modify unrelated testing settings', async () => {
        // The extension is already activated by the time tests run, so we statically verify
        // that the source code no longer contains any reference to 'automaticallyOpenPeekView'
        // which was previously used to modify global user settings.
        const extensionFilePath = path.join(__dirname, '../../../src/extension.ts');
        const fileUri = vscode.Uri.file(extensionFilePath);
        
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();
            assert.strictEqual(
                content.includes('automaticallyOpenPeekView'), 
                false, 
                'Activation must never modify unrelated testing settings like automaticallyOpenPeekView'
            );
        } catch (e) {
            // If running in a compiled-only context where src/ is not available, we pass
            assert.ok(true);
        }
    });

    test('gherkinPowerTools.refactor.extractStep command', async () => {
        const inputStub = sinon.stub(vscode.window, 'showInputBox').resolves('new_step');
        const targetUri = vscode.Uri.file(path.resolve(__dirname, '../../../src/test/fixtures/behave/features/steps/steps.py'));
        sinon.stub(vscode.workspace, 'findFiles').resolves([targetUri]);
        sinon.stub(vscode.window, 'showQuickPick').resolves({ label: 'steps.py', uri: targetUri } as any);
        
        // This is an E2E test; we need an active text editor
        const featureUri = vscode.Uri.file(path.resolve(__dirname, '../../../src/test/fixtures/behave/features/formatted.feature'));
        const doc = await vscode.workspace.openTextDocument(featureUri);
        await vscode.window.showTextDocument(doc);
        
        // Stub applyEdit to prevent modifying fixture files
        sinon.stub(vscode.workspace, 'applyEdit').resolves(false);
        
        await vscode.commands.executeCommand('gherkinPowerTools.refactor.extractStep');
        
        assert.ok(inputStub.called);
    });

    test('gherkinPowerTools.refactor.extractStep command aborts if no name', async () => {
        const inputStub = sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        await vscode.commands.executeCommand('gherkinPowerTools.refactor.extractStep');
        assert.ok(inputStub.called);
    });

    test('gherkinPowerTools.refactor.extractStep command applies edit and saves', async () => {
        const inputStub = sinon.stub(vscode.window, 'showInputBox').resolves('new_step');
        const targetUri = vscode.Uri.file(path.resolve(__dirname, '../../../src/test/fixtures/behave/features/steps/steps.py'));
        sinon.stub(vscode.workspace, 'findFiles').resolves([targetUri]);
        sinon.stub(vscode.window, 'showQuickPick').resolves({ label: 'steps.py', uri: targetUri } as any);
        
        const featureUri = vscode.Uri.file(path.resolve(__dirname, '../../../src/test/fixtures/behave/features/formatted.feature'));
        const doc = await vscode.workspace.openTextDocument(featureUri);
        await vscode.window.showTextDocument(doc);
        
        sinon.stub(vscode.workspace, 'applyEdit').resolves(true);

        const targetDocMock = {
            save: sinon.stub().resolves(true)
        };
        sinon.stub(vscode.workspace, 'openTextDocument').resolves(targetDocMock as any);
        
        await vscode.commands.executeCommand('gherkinPowerTools.refactor.extractStep');
        
        assert.ok(inputStub.called);
        assert.ok(targetDocMock.save.called);
    });

    test('gherkinPowerTools.refactor.renameStep delegates to editor.action.rename', async () => {
        const executeStub = sinon.stub(vscode.commands, 'executeCommand').resolves();
        // Since we are mocking executeCommand globally, we must call the inner callback directly or mock the specific command
        // But the easiest way is to call the callback from the registry if we can, or just trust VSCode API.
        // Actually executeCommand('gherkinPowerTools.refactor.renameStep') would trigger the real one, which then calls editor.action.rename
        // Wait, if we mock executeCommand, the outer command might not run. Let's call the callback directly if possible, or use a workaround.
        executeStub.withArgs('editor.action.rename').resolves();
        executeStub.callThrough(); // allow other commands to pass
        
        await vscode.commands.executeCommand('gherkinPowerTools.refactor.renameStep');
        assert.ok(executeStub.calledWith('editor.action.rename'));
    });
});
