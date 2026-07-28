import * as assert from 'assert';
import * as vscode from 'vscode';
import { runBehave, runBehaveWithPrompt, parseArgsStringToVector, debugBehave, clearMemoryArgs, resolveBehaveExecutionDetails, activeExecutions } from '../../execution';
import { ConfigurationService } from '../../configuration';

suite('Execution Test Suite', () => {
    let originalShowInputBox: any;
    let originalExecuteTask: any;
    let executeTaskCalledWith: vscode.Task | undefined;
    let originalGetExtension: any;
    let originalStartDebugging: any;
    let originalAsRelativePath: any;
    let originalWorkspaceFolder: any;
    let getExtensionMock: (name: string) => any;
    let startDebuggingCalledWith: any;

    const mockConfigService = {
        getConfiguration: () => ({
            behave: {
                command: 'behave',
                additionalArguments: ['--no-capture']
            }
        })
    } as unknown as ConfigurationService;

    setup(() => {
        executeTaskCalledWith = undefined;

        originalShowInputBox = vscode.window.showInputBox;
        
        originalExecuteTask = vscode.tasks.executeTask;
        (vscode.tasks as any).executeTask = async (task: vscode.Task) => {
            executeTaskCalledWith = task;
            return { task } as vscode.TaskExecution;
        };

        originalGetExtension = vscode.extensions.getExtension;
        originalStartDebugging = vscode.debug.startDebugging;
        originalWorkspaceFolder = vscode.workspace.getWorkspaceFolder;
        originalAsRelativePath = vscode.workspace.asRelativePath;
        
        getExtensionMock = (name: string) => {
            if (name === 'ms-python.python') { 
                return { 
                    id: name, 
                    isActive: true, 
                    exports: {
                        settings: {
                            getExecutionDetails: () => ({ execCommand: ['/custom/python'] })
                        }
                    }
                }; 
            }
            return undefined;
        };
        (vscode.extensions as any).getExtension = (name: string) => getExtensionMock(name);
        
        startDebuggingCalledWith = undefined;
        (vscode.debug as any).startDebugging = async (folder: any, config: any) => {
            startDebuggingCalledWith = { folder, config };
            // Return false so that the promise in debugBehave resolves immediately 
            // instead of waiting for debug termination events that never fire in tests.
            return false;
        };
        (vscode.workspace as any).getWorkspaceFolder = () => ({ uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 });
        (vscode.workspace as any).asRelativePath = () => 'features/test.feature';
        
        activeExecutions.clear();
    });

    teardown(() => {
        (vscode.window as any).showInputBox = originalShowInputBox;
        (vscode.tasks as any).executeTask = originalExecuteTask;
        (vscode.extensions as any).getExtension = originalGetExtension;
        (vscode.debug as any).startDebugging = originalStartDebugging;
        (vscode.workspace as any).getWorkspaceFolder = originalWorkspaceFolder;
        (vscode.workspace as any).asRelativePath = originalAsRelativePath;
        clearMemoryArgs();
        activeExecutions.clear();
    });

    test('resolveBehaveExecutionDetails uses Python extension active interpreter', async () => {
        const uri = vscode.Uri.file('/workspace/features/test.feature');
        const details = await resolveBehaveExecutionDetails(uri, undefined, mockConfigService);
        assert.ok(details);
        assert.strictEqual(details.executable, '/custom/python');
        assert.deepStrictEqual(details.args, ['-m', 'behave', '--no-capture', './features/test.feature']);
    });

    test('resolveBehaveExecutionDetails uses custom behave command', async () => {
        const customConfigService = {
            getConfiguration: () => ({
                behave: {
                    command: 'poetry run behave',
                    additionalArguments: ['--no-capture']
                }
            })
        } as unknown as ConfigurationService;
        
        const uri = vscode.Uri.file('/workspace/features/test.feature');
        const details = await resolveBehaveExecutionDetails(uri, 42, customConfigService);
        assert.ok(details);
        assert.strictEqual(details.executable, 'poetry');
        assert.deepStrictEqual(details.args, ['run', 'behave', '--no-capture', './features/test.feature:42']);
    });

    test('runBehave creates ProcessExecution task', async () => {
        const uri = vscode.Uri.file('/workspace/features/test.feature');
        await runBehave(uri, undefined, mockConfigService);
        
        assert.ok(executeTaskCalledWith, 'Task should be executed');
        assert.strictEqual(executeTaskCalledWith.name, 'Behave Feature');
        
        const execution = executeTaskCalledWith.execution as vscode.ProcessExecution;
        assert.strictEqual(execution.process, '/custom/python');
        assert.deepStrictEqual(execution.args, ['-m', 'behave', '--no-capture', './features/test.feature']);
    });

    test('runBehave prevents duplicate executions', async () => {
        const uri = vscode.Uri.file('/workspace/features/test.feature');
        await runBehave(uri, undefined, mockConfigService);
        
        let warningShown = false;
        (vscode.window as any).showWarningMessage = async () => { warningShown = true; };
        
        executeTaskCalledWith = undefined;
        await runBehave(uri, undefined, mockConfigService); // Should block
        
        assert.strictEqual(executeTaskCalledWith, undefined, 'Second execution should be blocked');
        assert.strictEqual(warningShown, true);
    });

    test('runBehaveWithPrompt does nothing if user cancels prompt', async () => {
        (vscode.window as any).showInputBox = async () => undefined;
        
        const uri = vscode.Uri.file('/workspace/features/test.feature');
        await runBehaveWithPrompt(uri, undefined, mockConfigService);
        
        const details = await resolveBehaveExecutionDetails(uri, undefined, mockConfigService);
        assert.ok(details?.args.includes('--no-capture'));
    });

    test('runBehaveWithPrompt saves modified args in memory', async () => {
        const uri = vscode.Uri.file('/workspace/features/test.feature');
        
        (vscode.window as any).showInformationMessage = async () => 'Just for this session';
        (vscode.window as any).showInputBox = async (options: any) => {
            return options.value.replace('--no-capture', '--no-capture --tags=@wip');
        };
        
        await runBehaveWithPrompt(uri, undefined, mockConfigService);

        const details = await resolveBehaveExecutionDetails(uri, undefined, mockConfigService);
        assert.ok(details?.args.includes('--tags=@wip'));
    });

    test('clearMemoryArgs correctly resets additional arguments', async () => {
        const uri = vscode.Uri.file('/workspace/features/test.feature');
        
        (vscode.window as any).showInputBox = async (options: any) => {
            return options.value.replace('--no-capture', '--tags=@fast');
        };
        (vscode.window as any).showInformationMessage = async () => 'Just for this session';
        
        await runBehaveWithPrompt(uri, undefined, mockConfigService);
        
        let details = await resolveBehaveExecutionDetails(uri, undefined, mockConfigService);
        assert.ok(details?.args.includes('--tags=@fast'));
        
        clearMemoryArgs();
        
        details = await resolveBehaveExecutionDetails(uri, undefined, mockConfigService);
        assert.ok(details?.args.includes('--no-capture'));
    });

    test('parseArgsStringToVector correctly splits arguments and unquotes strings', () => {
        const args = parseArgsStringToVector('--no-capture --tags "@wip or @dev" -D env="test env"');
        assert.deepStrictEqual(args, ['--no-capture', '--tags', '@wip or @dev', '-D', 'env=test env']);
    });

    test('debugBehave creates valid debug configuration bypassing shell injection', async () => {
        const uri = vscode.Uri.file('/workspace/features/test.feature');
        // Simulate a malicious path from workspace name
        (vscode.workspace as any).asRelativePath = () => 'features/malicious $(rm -rf /) path.feature';
        
        await debugBehave(uri, 42, mockConfigService);
        
        assert.ok(startDebuggingCalledWith, 'startDebugging should have been called');
        const config = startDebuggingCalledWith.config;
        assert.strictEqual(config.name, 'Debug Behave (PowerTools)');
        assert.strictEqual(config.type, 'python');
        assert.strictEqual(config.request, 'launch');
        assert.strictEqual(config.module, 'behave');
        // Arguments are passed as an array to Python extension, which spawns the process safely
        assert.deepStrictEqual(config.args, ['--no-capture', './features/malicious $(rm -rf /) path.feature:42']);
        assert.strictEqual(config.console, 'internalConsole');
    });

    test('debugBehave prompts for missing Python extension and handles install action', async () => {
        getExtensionMock = () => undefined; 
        
        let errorMessageShown = false;
        let commandExecuted = '';
        (vscode.window as any).showErrorMessage = async (_msg: string, _action: string) => {
            errorMessageShown = true;
            return 'Install Python Extension';
        };
        (vscode.commands as any).executeCommand = async (cmd: string, arg: string) => {
            commandExecuted = `${cmd}:${arg}`;
        };
        
        const uri = vscode.Uri.file('/workspace/features/test.feature');
        await debugBehave(uri, undefined, mockConfigService);
        
        assert.strictEqual(startDebuggingCalledWith, undefined, 'startDebugging should NOT have been called');
        assert.strictEqual(errorMessageShown, true, 'Error message should be shown prompting installation');
        assert.strictEqual(commandExecuted, 'extension.open:ms-python.python');
    });
});
