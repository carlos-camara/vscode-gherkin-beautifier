import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { runBehaveForTestRun } from '../../execution';
import { ConfigurationService } from '../../configuration';

suite('Timeout and Execution Termination', () => {
    let sandbox: sinon.SinonSandbox;
    let clock: sinon.SinonFakeTimers;
    let configService: ConfigurationService;
    let mockConfig: any;

    setup(() => {
        sandbox = sinon.createSandbox();
        clock = sandbox.useFakeTimers();

        mockConfig = {
            behave: {
                executionTimeout: 5,
                localExecution: {
                    executable: 'node',
                    arguments: ['-e', 'setTimeout(() => {}, 100000)'] // Long running script
                },
                additionalArguments: []
            }
        };

        configService = {
            getConfiguration: () => mockConfig
        } as unknown as ConfigurationService;
    });

    teardown(() => {
        clock.restore();
        sandbox.restore();
    });

    test('runBehaveForTestRun should return timeout outcome when execution exceeds configured time', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            assert.fail('No workspace folder available for testing');
        }
        const uri = workspaceFolders[0].uri;
        const tokenSource = new vscode.CancellationTokenSource();

        const executionPromise = runBehaveForTestRun(
            uri,
            undefined,
            configService,
            () => {},
            tokenSource.token
        );

        // Advance clock past the 5-second timeout
        await clock.tickAsync(5001);

        const outcome = await executionPromise;

        assert.strictEqual(outcome.type, 'timeout');
        if (outcome.type === 'timeout') {
            assert.strictEqual(outcome.durationSeconds, 5);
        }
    });

    test('runBehaveForTestRun should return cancelled outcome when cancelled by user', async () => {
        mockConfig.behave.executionTimeout = 0; // Disabled
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            assert.fail('No workspace folder available for testing');
        }
        const uri = workspaceFolders[0].uri;
        const tokenSource = new vscode.CancellationTokenSource();

        const executionPromise = runBehaveForTestRun(
            uri,
            undefined,
            configService,
            () => {},
            tokenSource.token
        );

        // Cancel execution
        tokenSource.cancel();

        const outcome = await executionPromise;

        assert.strictEqual(outcome.type, 'cancelled');
    });

    test('runBehaveForTestRun should return success outcome for normal exit', async () => {
        mockConfig.behave.localExecution = {
            executable: 'node',
            arguments: ['-e', 'console.log("done")']
        };
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            assert.fail('No workspace folder available for testing');
        }
        const uri = workspaceFolders[0].uri;
        const tokenSource = new vscode.CancellationTokenSource();

        const executionPromise = runBehaveForTestRun(
            uri,
            undefined,
            configService,
            () => {},
            tokenSource.token
        );

        // Actually let the real process run, we might need to restore clock for this if it hangs,
        // but since we are using spawn, it uses real OS time. Wait, spawn with fake timers might be tricky if we don't tick.
        // Node spawn doesn't use setTimeout for process exit, but we should tick to ensure internal setTimeouts run if any.
        // Actually it's better to restore the clock for actual process execution tests.
        clock.restore();
        
        const outcome = await executionPromise;
        assert.strictEqual(outcome.type, 'success');
    });
});
