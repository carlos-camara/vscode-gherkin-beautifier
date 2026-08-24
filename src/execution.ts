import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigurationService } from './configuration';

let memoryAdditionalArgs: string | undefined = undefined;

export function clearMemoryArgs() {
    memoryAdditionalArgs = undefined;
}

export const activeExecutions = new Map<string, vscode.TaskExecution | vscode.DebugSession>();

export function registerExecutionListeners(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.tasks.onDidEndTask(e => {
            for (const [key, execution] of activeExecutions.entries()) {
                if (execution === e.execution) {
                    activeExecutions.delete(key);
                    break;
                }
            }
        })
    );
    context.subscriptions.push(
        vscode.debug.onDidTerminateDebugSession(session => {
            for (const [key, execution] of activeExecutions.entries()) {
                if (execution === session) {
                    activeExecutions.delete(key);
                    break;
                }
            }
        })
    );
}

function getExecutionSignature(uri: vscode.Uri, line: number | undefined): string {
    return `${uri.toString()}#${line ?? 'all'}`;
}

interface ExecutionDetails {
    executable: string;
    args: string[];
}

export async function resolveBehaveExecutionDetails(
    uri: vscode.Uri,
    line: number | undefined,
    configService: ConfigurationService
): Promise<ExecutionDetails | undefined> {
    const config = configService.getConfiguration(uri);
    
    let executable: string;
    let baseArgs: string[] = [];
    
    const configuredExecution = config.behave.execution;
    
    if (configuredExecution.executable !== 'behave' || configuredExecution.arguments.length > 0) {
        // Use the new structured config
        executable = configuredExecution.executable;
        baseArgs = [...configuredExecution.arguments];
    } else {
        const pythonExt = vscode.extensions.getExtension('ms-python.python');
        let pythonExecParts: string[] | undefined;
        
        if (pythonExt) {
            if (!pythonExt.isActive) {
                await pythonExt.activate();
            }
            try {
                const api = pythonExt.exports;
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
                if (api.settings && api.settings.getExecutionDetails) {
                    const details = api.settings.getExecutionDetails(workspaceFolder?.uri);
                    if (details && details.execCommand && details.execCommand.length > 0) {
                        pythonExecParts = details.execCommand;
                    }
                }
            } catch (e) {
                // Ignore python ext API errors
            }
        }
        
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
            const execPath = pythonExecParts && pythonExecParts.length > 0 ? pythonExecParts[0] : '';
            if (!execPath || !path.isAbsolute(execPath) || !execPath.startsWith(workspaceFolder.uri.fsPath)) {
                const commonVenvs = ['.venv', 'venv', 'env'];
                for (const venv of commonVenvs) {
                    const binPath = path.join(workspaceFolder.uri.fsPath, venv, 'bin', 'python');
                    const scriptsPath = path.join(workspaceFolder.uri.fsPath, venv, 'Scripts', 'python.exe');
                    if (fs.existsSync(binPath)) {
                        pythonExecParts = [binPath];
                        break;
                    } else if (fs.existsSync(scriptsPath)) {
                        pythonExecParts = [scriptsPath];
                        break;
                    }
                }
            }
        }
        
        if (pythonExecParts && pythonExecParts.length > 0) {
            executable = pythonExecParts[0];
            baseArgs = [...pythonExecParts.slice(1), '-m', 'behave'];
        } else {
            executable = 'behave';
            baseArgs = [];
        }
    }

    if (config.behave.localExecutable && config.behave.localExecutable.trim().length > 0) {
        executable = config.behave.localExecutable.trim();
    }

    let additionalArgs: string[];
    if (memoryAdditionalArgs !== undefined) {
        additionalArgs = parseArgsStringToVector(memoryAdditionalArgs);
    } else {
        additionalArgs = [...config.behave.additionalArguments];
    }
    
    additionalArgs = additionalArgs.filter(a => a.trim().length > 0);
    
    let pathArg = uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
        pathArg = './' + vscode.workspace.asRelativePath(uri, false);
    }
    
    if (line !== undefined) {
        pathArg = `${pathArg}:${line}`;
    }
    
    const args = [...baseArgs, ...additionalArgs, pathArg];
    
    return { executable, args };
}

export async function runBehave(uri: vscode.Uri, line: number | undefined, configService: ConfigurationService) {
    const signature = getExecutionSignature(uri, line);
    if (activeExecutions.has(signature)) {
        vscode.window.showWarningMessage('This test is already running.');
        return;
    }

    const details = await resolveBehaveExecutionDetails(uri, line, configService);
    if (!details) { return; }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace to execute tests.');
        return;
    }

    const taskName = line !== undefined ? `Behave Scenario (Line ${line})` : `Behave Feature`;
    
    const execution = new vscode.ProcessExecution(details.executable, details.args, {
        env: { ...process.env, FORCE_COLOR: '1', BEHAVE_COLOR: 'always' }
    });
    
    const task = new vscode.Task(
        { type: 'gherkinPowerTools', command: 'run' },
        workspaceFolder,
        taskName,
        'Gherkin PowerTools',
        execution
    );
    
    task.presentationOptions = {
        echo: true,
        focus: true,
        panel: vscode.TaskPanelKind.Dedicated,
        showReuseMessage: false,
        clear: true
    };

    const taskExecution = await vscode.tasks.executeTask(task);
    activeExecutions.set(signature, taskExecution);
}

export async function runBehaveWithPrompt(uri: vscode.Uri, _line: number | undefined, configService: ConfigurationService) {
    const config = configService.getConfiguration(uri);
    
    let defaultArgsStr = config.behave.additionalArguments.join(' ');
    if (memoryAdditionalArgs !== undefined) {
        defaultArgsStr = memoryAdditionalArgs;
    }
    
    const newArgsStr = await vscode.window.showInputBox({
        prompt: "Edit Behave additional arguments (e.g., --tags=@wip --no-capture)",
        value: defaultArgsStr,
        placeHolder: "Enter additional arguments..."
    });
    
    if (newArgsStr !== undefined) {
        const action = await vscode.window.showInformationMessage(
            'Execution arguments updated. Do you want to save them permanently to your Workspace Settings?',
            'Save to Workspace',
            'Just for this session'
        );

        if (action === 'Save to Workspace') {
            const argsArray = parseArgsStringToVector(newArgsStr);
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            const target = workspaceFolder ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
            await vscode.workspace.getConfiguration('gherkinPowerTools.behave', uri).update('additionalArguments', argsArray, target);
            memoryAdditionalArgs = undefined;
            vscode.window.showInformationMessage('Execution arguments saved.');
        } else if (action === 'Just for this session') {
            memoryAdditionalArgs = newArgsStr;
            vscode.window.showInformationMessage('Execution arguments updated for this session.');
        }
    }
}

export function parseArgsStringToVector(argsString: string): string[] {
    const args: string[] = [];
    let currentArg = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < argsString.length; i++) {
        const char = argsString[i];
        if (char === ' ' && !inQuotes) {
            if (currentArg.length > 0) {
                args.push(currentArg);
                currentArg = '';
            }
        } else if ((char === '"' || char === "'") && !inQuotes) {
            inQuotes = true;
            quoteChar = char;
        } else if (char === quoteChar && inQuotes) {
            inQuotes = false;
            quoteChar = '';
        } else {
            currentArg += char;
        }
    }
    if (currentArg.length > 0) {
        args.push(currentArg);
    }
    return args;
}

export async function debugBehave(uri: vscode.Uri, line: number | undefined, configService: ConfigurationService) {
    const signature = getExecutionSignature(uri, line);
    if (activeExecutions.has(signature)) {
        vscode.window.showWarningMessage('This test is already running.');
        return;
    }

    const pythonExtension = vscode.extensions.getExtension('ms-python.python');
    const debugpyExtension = vscode.extensions.getExtension('ms-python.debugpy');
    
    if (!pythonExtension && !debugpyExtension) {
        const action = await vscode.window.showErrorMessage(
            'The Python extension is required to debug Behave scenarios. Please install it to use this feature.',
            'Install Python Extension'
        );
        if (action === 'Install Python Extension') {
            vscode.commands.executeCommand('extension.open', 'ms-python.python');
        }
        return;
    }

    const config = configService.getConfiguration(uri);
    
    let additionalArgs: string[];
    if (memoryAdditionalArgs !== undefined) {
        additionalArgs = parseArgsStringToVector(memoryAdditionalArgs);
    } else {
        additionalArgs = [...config.behave.additionalArguments];
    }
    additionalArgs = additionalArgs.filter(a => a.trim().length > 0);
    
    let pathArg = uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
        pathArg = './' + vscode.workspace.asRelativePath(uri, false);
    }

    if (line !== undefined) {
        pathArg = `${pathArg}:${line}`;
    }
    
    const debugConfig: vscode.DebugConfiguration = {
        name: "Debug Behave (PowerTools)",
        type: "python",
        request: "launch",
        module: "behave",
        args: [...additionalArgs, pathArg],
        console: "internalConsole",
        justMyCode: true,
        env: { FORCE_COLOR: '1', BEHAVE_COLOR: 'always' }
    };
    
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Open a workspace to start debugging.');
        return;
    }
    return new Promise<void>(async (resolve) => {
        let activeSession: vscode.DebugSession | undefined;
        let isResolved = false;

        const safeResolve = () => {
            if (!isResolved) {
                isResolved = true;
                resolve();
            }
        };

        const startDisposable = vscode.debug.onDidStartDebugSession(session => {
            // Match the session by name or if it's a python session running behave with our pathArg
            if (
                session.name === debugConfig.name ||
                (session.configuration.type === 'python' && session.configuration.module === 'behave' && session.configuration.args?.includes(pathArg))
            ) {
                activeSession = session;
                activeExecutions.set(signature, session);
                startDisposable.dispose();
            }
        });
        
        // Safety timeout for the start listener
        setTimeout(() => startDisposable.dispose(), 5000);

        const terminateDisposable = vscode.debug.onDidTerminateDebugSession(session => {
            if (activeSession && session === activeSession) {
                terminateDisposable.dispose();
                safeResolve();
            } else if (
                !activeSession && 
                (session.name === debugConfig.name || (session.configuration.type === 'python' && session.configuration.module === 'behave' && session.configuration.args?.includes(pathArg)))
            ) {
                terminateDisposable.dispose();
                safeResolve();
            }
        });

        const started = await vscode.debug.startDebugging(workspaceFolder, debugConfig);
        if (!started) {
            startDisposable.dispose();
            terminateDisposable.dispose();
            safeResolve();
            return;
        }

        // Force focus to the Debug Console
        vscode.commands.executeCommand('workbench.panel.repl.view.focus');

        // 10 minute absolute fallback timeout to prevent infinite hanging
        setTimeout(() => {
            startDisposable.dispose();
            terminateDisposable.dispose();
            safeResolve();
        }, 10 * 60 * 1000);
    });
}

/**
 * Spawns Behave as a child process for the Test Explorer run handler.
 * Unlike runBehave() (which uses a VS Code Task), this function captures
 * stdout and stderr and delivers them line-by-line via `onOutput`, allowing
 * the TestController to pipe output into `run.appendOutput()` so that the
 * TEST RESULTS panel shows the full Behave output instead of
 * "The test case did not report any output."
 *
 * @returns A promise that resolves with the process exit code (or null on timeout/cancel).
 */
export async function runBehaveForTestRun(
    uri: vscode.Uri,
    line: number | undefined,
    configService: ConfigurationService,
    onOutput: (text: string) => void,
    token: vscode.CancellationToken,
    onEvent?: (event: any) => void
): Promise<number | null> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        onOutput('\r\n\x1b[31mError: Cannot run Behave against a file outside of a workspace folder.\x1b[0m\r\n');
        return null;
    }

    const details = await resolveBehaveExecutionDetails(uri, line, configService);
    if (!details) {
        return null;
    }

    const cwd = workspaceFolder.uri.fsPath;

    // Inject custom formatter for real-time updates
    const assetsPath = path.join(__dirname, '..', 'assets');
    const pathArg = details.args.pop();
    
    // Ensure pretty formatter is still used for stdout if no formatter is specified
    if (!details.args.includes('-f') && !details.args.includes('--format')) {
        details.args.push('-f', 'pretty');
    }
    
    // Disable behave's internal capture so VS Code Test Results panel gets all stdout/stderr natively
    if (!details.args.includes('--no-capture')) {
        details.args.push('--no-capture');
    }
    if (!details.args.includes('--no-capture-stderr')) {
        details.args.push('--no-capture-stderr');
    }

    details.args.push('-f', 'vscode_behave_formatter:VSCodeFormatter');
    if (pathArg) {
        details.args.push(pathArg);
    }

    return new Promise<number | null>((resolve) => {
        const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '1', BEHAVE_COLOR: 'always' };
        if (env.PYTHONPATH) {
            env.PYTHONPATH = `${assetsPath}${path.delimiter}${env.PYTHONPATH}`;
        } else {
            env.PYTHONPATH = assetsPath;
        }

        const child = cp.spawn(details.executable, details.args, {
            cwd,
            shell: false, // Security constraint: Never use shell execution
            env
        });

        let lineBuffer = '';
        const handleData = (data: Buffer) => {
            const text = data.toString('utf8');
            lineBuffer += text;
            let newlineIndex;
            while ((newlineIndex = lineBuffer.indexOf('\n')) !== -1) {
                const line = lineBuffer.substring(0, newlineIndex + 1);
                lineBuffer = lineBuffer.substring(newlineIndex + 1);
                
                if (line.startsWith('##VSCODE_BEHAVE_EVENT:')) {
                    if (onEvent) {
                        try {
                            const eventJson = line.substring('##VSCODE_BEHAVE_EVENT:'.length).trim();
                            const event = JSON.parse(eventJson);
                            onEvent(event);
                        } catch (e) {
                            // ignore parse errors
                        }
                    }
                } else {
                    // Send to VS Code terminal replacing newlines with \r\n
                    onOutput(line.replace(/(?<!\r)\n/g, '\r\n'));
                }
            }
        };

        child.stdout?.on('data', handleData);
        child.stderr?.on('data', handleData);

        // Respect cancellation: kill the child process
        const cancelDisposable = token.onCancellationRequested(() => {
            child.kill('SIGKILL');
            cancelDisposable.dispose();
            resolve(null);
        });

        // Safety timeout: 5 minutes
        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            cancelDisposable.dispose();
            resolve(null);
        }, 5 * 60 * 1000);

        child.on('close', (code) => {
            clearTimeout(timeout);
            cancelDisposable.dispose();
            resolve(code ?? null);
        });

        child.on('error', (err) => {
            clearTimeout(timeout);
            cancelDisposable.dispose();
            onOutput(`[Gherkin PowerTools] Failed to start Behave: ${err.message}\r\n`);
            resolve(null);
        });
    });
}
