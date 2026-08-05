import * as assert from 'assert';
import * as vscode from 'vscode';
import { discoveryService } from '../../discovery';

suite('BehaveFileDiscoveryService Test Suite', () => {
    let service: typeof discoveryService;

    let originalConfigService: any;
    let originalEventBus: any;

    setup(() => {
        service = discoveryService;
        originalConfigService = service.configService;
        originalEventBus = service.eventBus;
    });

    teardown(() => {
        service.disposeWatchers();
        service.configService = originalConfigService;
        service.eventBus = originalEventBus;
    });

    test('normalizeGlobs returns defaults when provided invalid or empty inputs', () => {
        const defaults = ['**/steps/**/*.py', '**/features/steps/**/*.py'];
        assert.deepStrictEqual(service.normalizeGlobs(undefined, defaults), defaults);
        assert.deepStrictEqual(service.normalizeGlobs([], defaults), defaults);
        assert.deepStrictEqual(service.normalizeGlobs(['   '], defaults), defaults);

        const ignoreDefaults = ['**/node_modules/**', '**/.venv/**', '**/venv/**', '**/env/**'];
        assert.deepStrictEqual(service.normalizeGlobs(undefined, ignoreDefaults), ignoreDefaults);
        assert.deepStrictEqual(service.normalizeGlobs([], ignoreDefaults), ignoreDefaults);
    });

    test('normalizeGlobs filters invalid elements but keeps valid ones', () => {
        assert.deepStrictEqual(
            service.normalizeGlobs(['valid/*.py', '', 123 as any, 'another/*.py'], []),
            ['valid/*.py', 'another/*.py']
        );
    });

    test('isIgnored correctly identifies virtual environments and node_modules', () => {
        const uriVenv = vscode.Uri.file('/my/project/.venv/lib/python3.10/site-packages/steps.py');
        const uriNode = vscode.Uri.file('/my/project/node_modules/package/steps.py');
        const uriValid = vscode.Uri.file('/my/project/features/steps/login_steps.py');

        assert.strictEqual(service.isIgnored(uriVenv), true);
        assert.strictEqual(service.isIgnored(uriNode), true);
        assert.strictEqual(service.isIgnored(uriValid), false);
    });

    test('isIgnored supports custom ignore glob patterns', () => {
        const customIgnore = ['**/custom_ignore/**'];
        const uriCustom = vscode.Uri.file('/my/project/custom_ignore/steps.py');
        const uriValid = vscode.Uri.file('/my/project/features/steps/login_steps.py');

        assert.strictEqual(service.isIgnored(uriCustom, customIgnore), true);
        assert.strictEqual(service.isIgnored(uriValid, customIgnore), false);
    });

    test('getStepFiles filters out ignored files automatically', async () => {
        const originalFindFiles = vscode.workspace.findFiles;

        (vscode.workspace as any).findFiles = async () => {
            return [
                vscode.Uri.file('/my/project/features/steps/login.py'),
                vscode.Uri.file('/my/project/.venv/lib/steps.py')
            ];
        };

        const result = await service.getStepFiles();
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].fsPath.includes('.venv'), false);

        (vscode.workspace as any).findFiles = originalFindFiles;
    });

    test('getBestWorkspaceFolder returns given folder', () => {
        const dummyUri = vscode.Uri.file('/my/workspace/folder/file.py');
        const dummyFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file('/my/workspace/folder'),
            name: 'folder',
            index: 0
        };

        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        const originalGetWorkspaceFolder = vscode.workspace.getWorkspaceFolder;

        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => [dummyFolder] });
        (vscode.workspace as any).getWorkspaceFolder = () => dummyFolder;

        const result = service.getBestWorkspaceFolder(dummyUri);
        assert.deepStrictEqual(result, dummyFolder);

        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => originalWorkspaceFolders });
        (vscode.workspace as any).getWorkspaceFolder = originalGetWorkspaceFolder;
    });

    test('getBestWorkspaceFolder falls back to first workspace folder if getWorkspaceFolder returns undefined', () => {
        const dummyUri = vscode.Uri.file('/outside/workspace/file.py');
        const dummyFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file('/my/workspace/folder'),
            name: 'folder',
            index: 0
        };

        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        const originalGetWorkspaceFolder = vscode.workspace.getWorkspaceFolder;

        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => [dummyFolder] });
        (vscode.workspace as any).getWorkspaceFolder = () => undefined;

        const result = service.getBestWorkspaceFolder(dummyUri);
        assert.deepStrictEqual(result, dummyFolder);

        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => originalWorkspaceFolders });
        (vscode.workspace as any).getWorkspaceFolder = originalGetWorkspaceFolder;
    });

    test('setupWatchers deduplicates globs and registers listeners', () => {
        const originalCreateFileSystemWatcher = vscode.workspace.createFileSystemWatcher;

        let createdWatchers = 0;

        service.configService = {
            getConfiguration: () => ({
                behave: {
                    stepGlobs: ['**/steps/**/*.py', '**/steps/**/*.py'],
                    ignoreGlobs: ['**/venv/**']
                }
            })
        } as any;

        (vscode.workspace as any).createFileSystemWatcher = () => {
            createdWatchers++;
            return {
                onDidCreate: () => {},
                onDidChange: () => {},
                onDidDelete: () => {},
                dispose: () => {}
            };
        };

        const watchers = service.setupWatchers();
        assert.strictEqual(watchers.length, 1);
        assert.strictEqual(createdWatchers, 1);

        service.disposeWatchers();

        (vscode.workspace as any).createFileSystemWatcher = originalCreateFileSystemWatcher;
    });

    test('setupWatchers triggers onDidChange and onDidDelete on valid files', (done) => {
        const originalCreateFileSystemWatcher = vscode.workspace.createFileSystemWatcher;

        let onChangedListener: ((uri: vscode.Uri) => void) | undefined;
        let onDeletedListener: ((uri: vscode.Uri) => void) | undefined;
        let changedFired = false;
        let deletedFired = false;

        service.configService = {
            getConfiguration: () => ({
                behave: {
                    stepGlobs: ['**/steps/**/*.py'],
                    ignoreGlobs: ['**/venv/**']
                }
            })
        } as any;

        (vscode.workspace as any).createFileSystemWatcher = () => {
            return {
                onDidCreate: () => {},
                onDidChange: (cb: any) => { onChangedListener = cb; },
                onDidDelete: (cb: any) => { onDeletedListener = cb; },
                dispose: () => {}
            };
        };

        const eventBus = new (require('../../eventBus').WorkspaceEventBus)();
        service.eventBus = eventBus;
        eventBus.onEvent((e: any) => {
            if (e.type === 'stepFileChanged') changedFired = true;
            if (e.type === 'stepFileDeleted') deletedFired = true;
        });
        service.setupWatchers();

        if (onChangedListener) {
            onChangedListener(vscode.Uri.file('/workspace/features/steps/login.py'));
        }
        if (onDeletedListener) {
            onDeletedListener(vscode.Uri.file('/workspace/features/steps/login.py'));
        }

        setTimeout(() => {
            assert.strictEqual(changedFired, true, 'onDidChange event should trigger callback');
            assert.strictEqual(deletedFired, true, 'onDidDelete event should trigger callback');
            service.disposeWatchers();
            (vscode.workspace as any).createFileSystemWatcher = originalCreateFileSystemWatcher;
            done();
        }, 150);
    });

    test('setupWatchers filters events on ignored files', (done) => {
        const originalCreateFileSystemWatcher = vscode.workspace.createFileSystemWatcher;

        let onCreatedListener: ((uri: vscode.Uri) => void) | undefined;
        let eventFired = false;

        service.configService = {
            getConfiguration: () => ({
                behave: {
                    stepGlobs: ['**/steps/**/*.py'],
                    ignoreGlobs: ['**/venv/**']
                }
            })
        } as any;

        (vscode.workspace as any).createFileSystemWatcher = () => {
            return {
                onDidCreate: (cb: any) => { onCreatedListener = cb; },
                onDidChange: () => {},
                onDidDelete: () => {},
                dispose: () => {}
            };
        };

        const eventBus = new (require('../../eventBus').WorkspaceEventBus)();
        service.eventBus = eventBus;
        eventBus.onEvent((e: any) => {
            if (e.type === 'stepFileCreated') eventFired = true;
        });
        service.setupWatchers();

        if (onCreatedListener) {
            onCreatedListener(vscode.Uri.file('/workspace/venv/lib/steps.py'));
        }

        setTimeout(() => {
            assert.strictEqual(eventFired, false, 'Ignored file event should not trigger callback');
            service.disposeWatchers();
            (vscode.workspace as any).createFileSystemWatcher = originalCreateFileSystemWatcher;
            done();
        }, 150);
    });

    test('globPattern and excludePattern return correctly formatted strings', () => {
        service.configService = {
            getConfiguration: () => ({
                behave: {
                    stepGlobs: ['glob1', 'glob2'],
                    ignoreGlobs: ['ignore1', 'ignore2']
                }
            })
        } as any;

        assert.strictEqual(service.getGlobPattern(), '{glob1,glob2}');
        assert.strictEqual(service.getExcludePattern(), '{ignore1,ignore2}');

        service.configService = {
            getConfiguration: () => ({
                behave: {
                    stepGlobs: ['glob1'],
                    ignoreGlobs: ['ignore1']
                }
            })
        } as any;

        assert.strictEqual(service.getGlobPattern(), 'glob1');
        assert.strictEqual(service.getExcludePattern(), 'ignore1');
    });

    test('getBestWorkspaceFolder returns undefined if no workspace folders exist', () => {
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;

        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => undefined });

        const result = service.getBestWorkspaceFolder(vscode.Uri.file('/tmp/file.py'));
        assert.strictEqual(result, undefined);

        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => [] });
        const result2 = service.getBestWorkspaceFolder(vscode.Uri.file('/tmp/file.py'));
        assert.strictEqual(result2, undefined);

        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => originalWorkspaceFolders });
    });
});