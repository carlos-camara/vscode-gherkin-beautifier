import * as assert from 'assert';
import * as vscode from 'vscode';
import { showCommandCenter } from '../../commandCenter';

suite('Command Center Test Suite', () => {
    let originalShowQuickPick: any;
    let originalExecuteCommand: any;

    let showQuickPickCallCount = 0;
    let showQuickPickLastArgs: any[] = [];
    let showQuickPickMockResult: any = undefined;

    let executeCommandCallCount = 0;
    let executeCommandLastArgs: any[] = [];

    setup(() => {
        showQuickPickCallCount = 0;
        showQuickPickLastArgs = [];
        showQuickPickMockResult = undefined;

        executeCommandCallCount = 0;
        executeCommandLastArgs = [];

        originalShowQuickPick = vscode.window.showQuickPick;
        originalExecuteCommand = vscode.commands.executeCommand;

        (vscode.window as any).showQuickPick = async (...args: any[]) => {
            showQuickPickCallCount++;
            showQuickPickLastArgs = args;
            return showQuickPickMockResult;
        };

        (vscode.commands as any).executeCommand = async (...args: any[]) => {
            executeCommandCallCount++;
            executeCommandLastArgs = args;
        };
    });

    teardown(() => {
        (vscode.window as any).showQuickPick = originalShowQuickPick;
        (vscode.commands as any).executeCommand = originalExecuteCommand;
    });

    test('should show QuickPick with correct items', async () => {
        showQuickPickMockResult = undefined; // Simulate cancellation
        
        await showCommandCenter();

        assert.strictEqual(showQuickPickCallCount, 1);
        const items = showQuickPickLastArgs[0] as vscode.QuickPickItem[];
        const options = showQuickPickLastArgs[1] as vscode.QuickPickOptions;

        // Verify options
        assert.strictEqual(options.placeHolder, 'Select a Gherkin PowerTools command to execute...');
        assert.strictEqual(options.matchOnDescription, true);

        // Verify some expected items exist
        assert.ok(items.length > 10, 'Should have multiple commands and separators');
        
        const formatItem = items.find(i => i.label.includes('Format Gherkin Document'));
        assert.ok(formatItem, 'Format command should be present');
        assert.strictEqual((formatItem as any).commandId, 'gherkinPowerTools.format');

        const runFeatureItem = items.find(i => i.label.includes('Run Feature'));
        assert.ok(runFeatureItem, 'Run Feature command should be present');
        assert.strictEqual((runFeatureItem as any).commandId, 'gherkinPowerTools.runFeature');
    });

    test('should execute command if an item is selected', async () => {
        showQuickPickMockResult = {
            label: 'Test Command',
            commandId: 'test.command.id'
        };

        await showCommandCenter();

        assert.strictEqual(executeCommandCallCount, 1);
        assert.strictEqual(executeCommandLastArgs[0], 'test.command.id');
    });

    test('should not execute command if selection is cancelled', async () => {
        showQuickPickMockResult = undefined;

        await showCommandCenter();

        assert.strictEqual(executeCommandCallCount, 0);
    });

    test('should not execute command if item has no commandId (e.g. separator)', async () => {
        showQuickPickMockResult = {
            label: 'Separator',
            kind: vscode.QuickPickItemKind.Separator
        };

        await showCommandCenter();

        assert.strictEqual(executeCommandCallCount, 0);
    });
});
