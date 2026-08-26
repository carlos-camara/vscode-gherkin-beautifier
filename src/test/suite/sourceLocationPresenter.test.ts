import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { SourceLocationPresenter } from '../../utils/sourceLocationPresenter';

suite('SourceLocationPresenter Test Suite', () => {
    let getWorkspaceFolderStub: sinon.SinonStub;
    let asRelativePathStub: sinon.SinonStub;

    let mockWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;

    setup(() => {
        getWorkspaceFolderStub = sinon.stub(vscode.workspace, 'getWorkspaceFolder');
        asRelativePathStub = sinon.stub(vscode.workspace, 'asRelativePath');
        mockWorkspaceFolders = undefined;
        sinon.stub(vscode.workspace, 'workspaceFolders').get(() => mockWorkspaceFolders);
    });

    teardown(() => {
        sinon.restore();
    });

    test('formatPath: out of workspace fallback', () => {
        getWorkspaceFolderStub.returns(undefined);
        const uri = vscode.Uri.file('/tmp/external/project/features/steps.py');
        const formatted = SourceLocationPresenter.formatPath(uri);
        assert.strictEqual(formatted, '.../features/steps.py');
    });

    test('formatPath: remote URI fallback', () => {
        getWorkspaceFolderStub.returns(undefined);
        const uri = vscode.Uri.parse('vscode-vfs://github/user/repo/shared/auth.py');
        const formatted = SourceLocationPresenter.formatPath(uri);
        assert.strictEqual(formatted, '.../shared/auth.py');
    });

    test('formatShort: single root workspace concise format', () => {
        getWorkspaceFolderStub.returns({ name: 'my-project', uri: vscode.Uri.file('/my-project'), index: 0 });
        mockWorkspaceFolders = [{ name: 'my-project', uri: vscode.Uri.file('/my-project'), index: 0 }];
        const uri = vscode.Uri.file('/my-project/features/steps/login.py');
        
        const short = SourceLocationPresenter.formatShort(uri);
        assert.strictEqual(short, 'steps/login.py');
    });

    test('formatShort: multi-root workspace concise format', () => {
        const wf1 = { name: 'project-a', uri: vscode.Uri.file('/project-a'), index: 0 };
        const wf2 = { name: 'project-b', uri: vscode.Uri.file('/project-b'), index: 1 };
        getWorkspaceFolderStub.returns(wf1);
        mockWorkspaceFolders = [wf1, wf2];
        
        const uri = vscode.Uri.file('/project-a/features/steps/login.py');
        
        const short = SourceLocationPresenter.formatShort(uri);
        assert.strictEqual(short, 'project-a/.../steps/login.py');
    });

    test('formatShort: duplicate basenames ambiguity (differentiates by parent folder)', () => {
        getWorkspaceFolderStub.returns({ name: 'my-project', uri: vscode.Uri.file('/my-project'), index: 0 });
        mockWorkspaceFolders = [{ name: 'my-project', uri: vscode.Uri.file('/my-project'), index: 0 }];
        
        const uri1 = vscode.Uri.file('/my-project/features/login/steps.py');
        const uri2 = vscode.Uri.file('/my-project/features/logout/steps.py');
        
        const short1 = SourceLocationPresenter.formatShort(uri1);
        const short2 = SourceLocationPresenter.formatShort(uri2);
        
        assert.strictEqual(short1, 'login/steps.py');
        assert.strictEqual(short2, 'logout/steps.py');
        assert.notStrictEqual(short1, short2);
    });

    test('formatMarkdownLink: handles line numbers and labels', () => {
        getWorkspaceFolderStub.returns({ name: 'my-project', uri: vscode.Uri.file('/my-project'), index: 0 });
        mockWorkspaceFolders = [{ name: 'my-project', uri: vscode.Uri.file('/my-project'), index: 0 }];
        const uri = vscode.Uri.file('/my-project/features/steps/auth.py');
        
        const link = SourceLocationPresenter.formatMarkdownLink(uri, 42);
        assert.strictEqual(link, '[steps/auth.py](file:///my-project/features/steps/auth.py#42)');

        const labeledLink = SourceLocationPresenter.formatMarkdownLink(uri, 42, 'Custom Label');
        assert.strictEqual(labeledLink, '[Custom Label](file:///my-project/features/steps/auth.py#42)');
    });

    test('formatPath: in workspace uses asRelativePath', () => {
        const wf1 = { name: 'project-a', uri: vscode.Uri.file('/project-a'), index: 0 };
        getWorkspaceFolderStub.returns(wf1);
        asRelativePathStub.returns('features/steps.py');

        const uri = vscode.Uri.file('/project-a/features/steps.py');
        const formatted = SourceLocationPresenter.formatPath(uri);
        
        assert.strictEqual(formatted, 'features/steps.py');
        assert.ok(asRelativePathStub.calledOnce);
    });
});
