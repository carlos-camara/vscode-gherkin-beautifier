import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import { deactivate, checkPeekViewRecommendation } from '../../extension';
import { discoveryService } from '../../discovery';

suite('Extension Test Suite', () => {
    let globalState: Map<string, any>;
    let contextMock: any;

    setup(() => {
        globalState = new Map<string, any>();
        contextMock = {
            globalState: {
                get: (key: string, defaultValue: any) => globalState.has(key) ? globalState.get(key) : defaultValue,
                update: (key: string, value: any) => {
                    globalState.set(key, value);
                    return Promise.resolve();
                }
            }
        };
    });

    teardown(() => {
        sinon.restore();
    });

    test('deactivate disposes discoveryService', () => {
        const disposeSpy = sinon.spy(discoveryService, 'dispose');
        deactivate();
        assert.ok(disposeSpy.calledOnce);
    });

    test('checkPeekViewRecommendation returns early if already prompted', async () => {
        globalState.set('gherkinPowerTools.promptedPeekView', true);
        const configStub = sinon.stub(vscode.workspace, 'getConfiguration');
        
        await checkPeekViewRecommendation(contextMock);
        
        assert.strictEqual(configStub.called, false);
    });

    test('checkPeekViewRecommendation updates config if user chooses Disable Peek View', async () => {
        const testingConfig = {
            get: sinon.stub().returns('always'),
            update: sinon.stub().resolves()
        };
        sinon.stub(vscode.workspace, 'getConfiguration').withArgs('testing').returns(testingConfig as any);
        
        const showInfoStub = sinon.stub(vscode.window, 'showInformationMessage').resolves('Disable Peek View' as any);
        
        await checkPeekViewRecommendation(contextMock);
        
        assert.ok(showInfoStub.calledOnce);
        assert.ok(testingConfig.update.calledWith('automaticallyOpenPeekView', 'never', vscode.ConfigurationTarget.Global));
        assert.strictEqual(globalState.get('gherkinPowerTools.promptedPeekView'), true);
    });
    
    test('checkPeekViewRecommendation does not update config if user chooses Keep Current', async () => {
        const testingConfig = {
            get: sinon.stub().returns('always'),
            update: sinon.stub().resolves()
        };
        sinon.stub(vscode.workspace, 'getConfiguration').withArgs('testing').returns(testingConfig as any);
        
        const showInfoStub = sinon.stub(vscode.window, 'showInformationMessage').resolves('Keep Current' as any);
        
        await checkPeekViewRecommendation(contextMock);
        
        assert.ok(showInfoStub.calledOnce);
        assert.strictEqual(testingConfig.update.called, false);
        assert.strictEqual(globalState.get('gherkinPowerTools.promptedPeekView'), true);
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
});
