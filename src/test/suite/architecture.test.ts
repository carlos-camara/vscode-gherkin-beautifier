import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { activate } from '../../extension';

suite('Architecture Validation Test Suite', () => {
    let mockContext: vscode.ExtensionContext;
    let disposables: { dispose: () => any }[] = [];
    let registeredCommands: string[] = [];
    let originalCreateTestController: any;
    let originalCreateDiagnosticCollection: any;
    let originalCreateFileSystemWatcher: any;
    let originalRegisterCommand: any;
    let packageJson: any;

    setup(() => {
        disposables = [];
        registeredCommands = [];
        
        // Read package.json to get declared commands
        const packageJsonPath = path.resolve(__dirname, '../../../package.json');
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        mockContext = {
            subscriptions: disposables,
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => [],
                setKeysForSync: () => {}
            },
            extensionPath: path.resolve(__dirname, '../../..'),
            globalStorageUri: vscode.Uri.file(path.resolve(__dirname, '../../../globalStorage')),
            logUri: vscode.Uri.file(path.resolve(__dirname, '../../../log')),
            extensionUri: vscode.Uri.file(path.resolve(__dirname, '../../..')),
            environmentVariableCollection: {} as any,
            extension: {
                id: 'carloscamara.vscode-gherkin-powertools',
                extensionUri: vscode.Uri.file(path.resolve(__dirname, '../../..')),
                extensionPath: path.resolve(__dirname, '../../..'),
                isActive: true,
                packageJSON: packageJson,
                extensionKind: vscode.ExtensionKind.Workspace,
                exports: undefined,
                activate: () => Promise.resolve()
            },
            asAbsolutePath: (relativePath: string) => path.join(path.resolve(__dirname, '../../..'), relativePath),
            storageUri: vscode.Uri.file(path.resolve(__dirname, '../../../storage')),
            globalStoragePath: path.resolve(__dirname, '../../../globalStorage'),
            logPath: path.resolve(__dirname, '../../../log'),
            storagePath: path.resolve(__dirname, '../../../storage'),
            secrets: {} as any,
            extensionMode: vscode.ExtensionMode.Test
        } as unknown as vscode.ExtensionContext;

        originalRegisterCommand = vscode.commands.registerCommand;
        (vscode.commands as any).registerCommand = (command: string, _callback: (...args: any[]) => any, _thisArg?: any) => {
            registeredCommands.push(command);
            const disposable = { dispose: () => {} };
            disposables.push(disposable);
            return disposable;
        };

        originalCreateTestController = vscode.tests.createTestController;
        (vscode.tests as any).createTestController = (id: string, label: string) => {
            return {
                id,
                label,
                items: {
                    get: () => undefined,
                    add: () => {},
                    replace: () => {}
                },
                createRunProfile: () => ({ dispose: () => {} }),
                createTestItem: () => ({ children: { replace: () => {} }, canResolveChildren: false }),
                dispose: () => {}
            };
        };

        originalCreateDiagnosticCollection = vscode.languages.createDiagnosticCollection;
        (vscode.languages as any).createDiagnosticCollection = (name?: string) => {
            return {
                name,
                set: () => {},
                delete: () => {},
                clear: () => {},
                dispose: () => {}
            };
        };

        originalCreateFileSystemWatcher = vscode.workspace.createFileSystemWatcher;
        (vscode.workspace as any).createFileSystemWatcher = (_pattern: string) => {
            return {
                ignoreCreateEvents: false,
                ignoreChangeEvents: false,
                ignoreDeleteEvents: false,
                onDidCreate: () => ({ dispose: () => {} }),
                onDidChange: () => ({ dispose: () => {} }),
                onDidDelete: () => ({ dispose: () => {} }),
                dispose: () => {}
            };
        };
    });

    teardown(() => {
        (vscode.commands as any).registerCommand = originalRegisterCommand;
        (vscode.tests as any).createTestController = originalCreateTestController;
        (vscode.languages as any).createDiagnosticCollection = originalCreateDiagnosticCollection;
        (vscode.workspace as any).createFileSystemWatcher = originalCreateFileSystemWatcher;
        
        for (const disposable of disposables) {
            if (disposable && typeof disposable.dispose === 'function') {
                try {
                    disposable.dispose();
                } catch (e) {
                    // Ignore errors during teardown
                }
            }
        }
    });

    test('Bootstrap completes without exceptions', async () => {
        await assert.doesNotReject(async () => {
            await activate(mockContext);
        }, 'activate() should not throw any exceptions');
    });

    test('Every command declared in package.json is registered', async () => {
        await activate(mockContext);

        const declaredCommands = packageJson.contributes.commands.map((c: any) => c.command);
        
        for (const declaredCommand of declaredCommands) {
            assert.ok(
                registeredCommands.includes(declaredCommand), 
                `Command '${declaredCommand}' is declared in package.json but was not registered during activation.`
            );
        }
    });

    test('No duplicate command registrations exist', async () => {
        await activate(mockContext);

        const duplicateCommands = registeredCommands.filter((item, index) => registeredCommands.indexOf(item) !== index);
        assert.strictEqual(
            duplicateCommands.length, 
            0, 
            `Duplicate command registrations found: ${duplicateCommands.join(', ')}`
        );
    });

    test('Every registered provider/watcher is pushed to context.subscriptions and is disposable', async () => {
        await activate(mockContext);

        // Ensure subscriptions is not empty
        assert.ok(mockContext.subscriptions.length > 0, 'No subscriptions were created during activation');

        // Check if everything in subscriptions has a dispose method
        for (let i = 0; i < mockContext.subscriptions.length; i++) {
            const disposable = mockContext.subscriptions[i];
            assert.ok(
                disposable && typeof (disposable as any).dispose === 'function',
                `Item at index ${i} in context.subscriptions is missing a dispose() method or is null.`
            );
        }
    });
});
