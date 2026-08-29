import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { GherkinTestController } from '../../testController';
import { ConfigurationService } from '../../configuration';

suite('GherkinTestController Test Suite', () => {
    let originalGetWorkspaceFolder: any;
    let tempDir: string;
    let configService: ConfigurationService;
    let controller: GherkinTestController;

    setup(() => {
        originalGetWorkspaceFolder = vscode.workspace.getWorkspaceFolder;
        (vscode.workspace as any).getWorkspaceFolder = (_uri: vscode.Uri) => { return { uri: vscode.Uri.file(tempDir), name: 'temp', index: 0 }; };
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gherkin-test-controller-'));
        const configDiagnostics = vscode.languages.createDiagnosticCollection('gherkin-configuration-test');
        const dummyLoader = { async load() { return null; } };
        configService = new ConfigurationService(configDiagnostics, dummyLoader);
        const uniqueId = `gherkin-tests-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const mockContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        controller = new GherkinTestController(mockContext, configService, uniqueId);
    });


    teardown(() => {
        (vscode.workspace as any).getWorkspaceFolder = originalGetWorkspaceFolder;

        controller.dispose();
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore
        }
    });

    test('Initializes correctly and creates TestController', () => {
        assert.ok(controller);
        // We can't easily access the private controller property to check items,
        // but we can verify it doesn't throw on initialization.
    });

    test('Parses Gherkin features into TestItems', async () => {
        const featureUri = vscode.Uri.file(path.join(tempDir, 'sample.feature'));
        fs.writeFileSync(featureUri.fsPath, `
Feature: Sample Feature
  Scenario: First scenario
    Given a step
`);

        // We simulate the file watcher event by calling the private method through cast
        const testControllerPrivate = controller as any;
        const fileItem = testControllerPrivate.getOrCreateFile(featureUri);

        await testControllerPrivate.parseTestsInFileContents(fileItem);

        // Assertions on the generated TestItems
        assert.strictEqual(fileItem.children.size, 1);

        let featureItem: vscode.TestItem | undefined;
        fileItem.children.forEach((item: vscode.TestItem) => {
            featureItem = item;
        });

        assert.ok(featureItem);
        assert.strictEqual(featureItem!.label, 'Sample Feature');
        assert.strictEqual(featureItem!.children.size, 1);

        let scenarioItem: vscode.TestItem | undefined;
        featureItem!.children.forEach((item: vscode.TestItem) => {
            scenarioItem = item;
        });

        assert.ok(scenarioItem);
        assert.strictEqual(scenarioItem!.label, 'First scenario');
    });

    test('Parses Rules and nested Scenarios correctly', async () => {
        const featureUri = vscode.Uri.file(path.join(tempDir, 'rules.feature'));
        fs.writeFileSync(featureUri.fsPath, `
Feature: Rules Feature
  Rule: A business rule
    Scenario: Rule scenario
      Given a step
`);

        const testControllerPrivate = controller as any;
        const fileItem = testControllerPrivate.getOrCreateFile(featureUri);

        await testControllerPrivate.parseTestsInFileContents(fileItem);

        let featureItem: vscode.TestItem | undefined;
        fileItem.children.forEach((item: vscode.TestItem) => { featureItem = item; });

        assert.strictEqual(featureItem!.id, `${featureUri.toString()}?type=feature`);

        let ruleItem: vscode.TestItem | undefined;
        featureItem!.children.forEach((item: vscode.TestItem) => { ruleItem = item; });

        assert.ok(ruleItem);
        assert.strictEqual(ruleItem!.label, 'A business rule');
        assert.strictEqual(ruleItem!.id, `${featureUri.toString()}?type=rule&line=3`);
        
        let scenarioItem: vscode.TestItem | undefined;
        ruleItem!.children.forEach((item: vscode.TestItem) => { scenarioItem = item; });
        assert.strictEqual(scenarioItem!.label, 'Rule scenario');
        assert.strictEqual(scenarioItem!.id, `${featureUri.toString()}?type=scenario&line=4`);
    });

    test('Parses Scenario Outline and Examples rows into TestItems', async () => {
        const featureUri = vscode.Uri.file(path.join(tempDir, 'outline.feature'));
        fs.writeFileSync(featureUri.fsPath, `
Feature: Outline Feature
  Scenario Outline: Outline scenario
    Given a step with <arg>
    Examples:
      | arg |
      | 1   |
      | 2   |
`);

        const testControllerPrivate = controller as any;
        const fileItem = testControllerPrivate.getOrCreateFile(featureUri);

        await testControllerPrivate.parseTestsInFileContents(fileItem);

        let featureItem: vscode.TestItem | undefined;
        fileItem.children.forEach((item: vscode.TestItem) => { featureItem = item; });

        assert.ok(featureItem);
        assert.strictEqual(featureItem!.children.size, 1);

        let scenarioOutlineItem: vscode.TestItem | undefined;
        featureItem!.children.forEach((item: vscode.TestItem) => { scenarioOutlineItem = item; });

        assert.ok(scenarioOutlineItem);
        assert.strictEqual(scenarioOutlineItem!.label, 'Outline scenario');

        // Check that the two Example rows are parsed as children
        assert.strictEqual(scenarioOutlineItem!.children.size, 2);

        const exampleItems: vscode.TestItem[] = [];
        scenarioOutlineItem!.children.forEach((item: vscode.TestItem) => { exampleItems.push(item); });

        assert.strictEqual(exampleItems[0].label, 'arg=1');
        assert.strictEqual(exampleItems[0].id, `${featureUri.toString()}?type=row&line=7`);

        assert.strictEqual(exampleItems[1].label, 'arg=2');
        assert.strictEqual(exampleItems[1].id, `${featureUri.toString()}?type=row&line=8`);
    });
    test('Binds to WorkspaceEventBus correctly', () => {
        const { WorkspaceEventBus } = require('../../eventBus');
        const eventBus = new WorkspaceEventBus();
        controller.setEventBus(eventBus);

        const testControllerPrivate = controller as any;
        const testUri = vscode.Uri.file(path.join(tempDir, 'event.feature'));
        eventBus.publish({ type: 'featureFileCreated', uri: testUri });

        const fileItem = testControllerPrivate.controller.items.get(testUri.toString());
        assert.ok(fileItem, 'Item should be created on featureFileCreated event');

        eventBus.dispose();
    });

    test('Live Step Tracking and Context Snapshot processing', async () => {
        const featureUri = vscode.Uri.file(path.join(tempDir, 'run.feature'));
        fs.writeFileSync(featureUri.fsPath, `
Feature: Run Feature
  Scenario: Run scenario
    Given a step
`);

        const testControllerPrivate = controller as any;
        const fileItem = testControllerPrivate.getOrCreateFile(featureUri);
        await testControllerPrivate.parseTestsInFileContents(fileItem);

        // Mock vscode.window.visibleTextEditors
        const originalVisibleEditors = vscode.window.visibleTextEditors;
        let decorationsSet: vscode.Range[][] = [];
        Object.defineProperty(vscode.window, 'visibleTextEditors', {
            get: () => [{
                document: { uri: featureUri },
                setDecorations: (_decorationType: any, ranges: vscode.Range[]) => {
                    decorationsSet.push(ranges);
                }
            }]
        });

        // Mock child_process.spawn to simulate Behave events
        const cp = require('child_process');
        const originalSpawn = cp.spawn;
        cp.spawn = () => {
            const EventEmitter = require('events');
            const child: any = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            child.kill = () => {};

            // Simulate Behave NDJSON stream
            setTimeout(() => {
                child.stdout.emit('data', Buffer.from('##VSCODE_BEHAVE_EVENT: {"event": "scenario", "data": {"line": 3, "name": "Run scenario"}}\n'));
                child.stdout.emit('data', Buffer.from('##VSCODE_BEHAVE_EVENT: {"event": "step_start", "data": {"line": 4}}\n'));
                child.stdout.emit('data', Buffer.from('##VSCODE_BEHAVE_EVENT: {"event": "step", "data": {"status": "passed", "duration": 0.1}}\n'));
                child.stdout.emit('data', Buffer.from('##VSCODE_BEHAVE_EVENT: {"event": "scenario_result", "data": {"status": "passed", "line": 3, "context_snapshot": {"foo": "bar"}}}\n'));
                child.emit('close', 0);
            }, 10);

            return child;
        };

        try {
            // Trigger test run
            const request = new vscode.TestRunRequest([fileItem]);
            const tokenSource = new vscode.CancellationTokenSource();

            await testControllerPrivate.runHandler(request, tokenSource.token, 'run');

            // Verify Live Step Tracking called setDecorations with the correct line (line 4 is 0-indexed as 3)
            assert.ok(decorationsSet.length > 0, 'setDecorations should have been called');
            assert.strictEqual(decorationsSet[0].length, 1);
            assert.strictEqual(decorationsSet[0][0].start.line, 3);
        } finally {
            Object.defineProperty(vscode.window, 'visibleTextEditors', {
                get: () => originalVisibleEditors
            });
            cp.spawn = originalSpawn;
        }
    });

    test('Handles Step Failure and Error Location processing', async () => {
        const featureUri = vscode.Uri.file(path.join(tempDir, 'fail.feature'));
        fs.writeFileSync(featureUri.fsPath, `
Feature: Fail Feature
  Scenario: Fail scenario
    Given a failing step
`);

        const testControllerPrivate = controller as any;
        const fileItem = testControllerPrivate.getOrCreateFile(featureUri);
        await testControllerPrivate.parseTestsInFileContents(fileItem);

        // Mock child_process.spawn to simulate Behave events
        const cp = require('child_process');
        const originalSpawn = cp.spawn;
        cp.spawn = () => {
            const EventEmitter = require('events');
            const child: any = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            child.kill = () => {};

            setTimeout(() => {
                child.stdout.emit('data', Buffer.from('##VSCODE_BEHAVE_EVENT: {"event": "scenario", "data": {"line": 3, "name": "Fail scenario"}}\n'));
                child.stdout.emit('data', Buffer.from('##VSCODE_BEHAVE_EVENT: {"event": "step", "data": {"status": "failed", "error_message": "AssertionError", "error_file": "steps.py", "error_line": 10}}\n'));
                child.stdout.emit('data', Buffer.from('##VSCODE_BEHAVE_EVENT: {"event": "scenario_result", "data": {"status": "failed", "line": 3}}\n'));
                child.emit('close', 1);
            }, 10);

            return child;
        };

        try {
            const request = new vscode.TestRunRequest([fileItem]);
            const tokenSource = new vscode.CancellationTokenSource();

            await testControllerPrivate.runHandler(request, tokenSource.token, 'run');

            let scenarioItem: vscode.TestItem | undefined;
            const findScenario = (node: vscode.TestItem) => {
                if (node.label.includes('Fail scenario')) {
                    scenarioItem = node;
                }
                node.children.forEach(findScenario);
            };
            findScenario(fileItem);
            assert.ok(scenarioItem, 'Should find Fail scenario');

            // Should have created an error child item
            let foundErrorChild = false;
            scenarioItem.children.forEach((child: vscode.TestItem) => {
                if (child.id.includes('#error:')) {
                    foundErrorChild = true;
                }
            });
            assert.ok(foundErrorChild, 'Should have created an error child item');
        } finally {
            cp.spawn = originalSpawn;
        }
    });

    test('Handles Behave error exit with no processed items', async () => {
        const featureUri = vscode.Uri.file(path.join(tempDir, 'error.feature'));
        fs.writeFileSync(featureUri.fsPath, `
Feature: Error Feature
  Scenario: Error scenario
    Given a step
`);

        const testControllerPrivate = controller as any;
        const fileItem = testControllerPrivate.getOrCreateFile(featureUri);
        await testControllerPrivate.parseTestsInFileContents(fileItem);

        const cp = require('child_process');
        const originalSpawn = cp.spawn;
        cp.spawn = () => {
            const EventEmitter = require('events');
            const child: any = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            child.kill = () => {};

            setTimeout(() => {
                child.stdout.emit('data', Buffer.from('Some catastrophic failure\n'));
                child.emit('close', 1);
            }, 10);

            return child;
        };

        try {
            const request = new vscode.TestRunRequest([fileItem]);
            const tokenSource = new vscode.CancellationTokenSource();

            // Mock test run to capture failed() calls
            let failedCalled = false;
            let failedMessage = '';
            const originalCreateTestRun = testControllerPrivate.controller.createTestRun;
            testControllerPrivate.controller.createTestRun = (req: any) => {
                const run = originalCreateTestRun.call(testControllerPrivate.controller, req);
                run.failed = (_item: any, msg: any) => {
                    failedCalled = true;
                    if (msg instanceof vscode.TestMessage) {
                        failedMessage = (msg.message as vscode.MarkdownString).value;
                    }
                };
                return run;
            };

            await testControllerPrivate.runHandler(request, tokenSource.token, 'run');

            assert.strictEqual(failedCalled, true, 'run.failed should have been called');
            assert.ok(failedMessage.includes('Behave exited with code 1'), 'Message should indicate exit code');
            assert.ok(failedMessage.includes('Some catastrophic failure'), 'Message should include output');

            testControllerPrivate.controller.createTestRun = originalCreateTestRun;
        } finally {
            cp.spawn = originalSpawn;
        }
    });

    test('Marks unprocessed items as skipped', async () => {
        const featureUri = vscode.Uri.file(path.join(tempDir, 'skip.feature'));
        fs.writeFileSync(featureUri.fsPath, `
Feature: Skip Feature
  Scenario: Scenario 1
    Given step 1
  Scenario: Scenario 2
    Given step 2
`);

        const testControllerPrivate = controller as any;
        const fileItem = testControllerPrivate.getOrCreateFile(featureUri);
        await testControllerPrivate.parseTestsInFileContents(fileItem);

        const cp = require('child_process');
        const originalSpawn = cp.spawn;
        cp.spawn = () => {
            const EventEmitter = require('events');
            const child: any = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            child.kill = () => {};

            setTimeout(() => {
                // Only process Scenario 1
                child.stdout.emit('data', Buffer.from('##VSCODE_BEHAVE_EVENT: {"event": "scenario", "data": {"line": 2, "name": "Scenario 1"}}\n'));
                child.stdout.emit('data', Buffer.from('##VSCODE_BEHAVE_EVENT: {"event": "scenario_result", "data": {"status": "passed", "line": 2}}\n'));
                child.emit('close', 0);
            }, 10);

            return child;
        };

        try {
            const request = new vscode.TestRunRequest([fileItem]);
            const tokenSource = new vscode.CancellationTokenSource();

            let skippedCalled = false;
            let skippedItemLabel = '';
            const originalCreateTestRun = testControllerPrivate.controller.createTestRun;
            testControllerPrivate.controller.createTestRun = (req: any) => {
                const run = originalCreateTestRun.call(testControllerPrivate.controller, req);
                run.skipped = (item: any) => {
                    skippedCalled = true;
                    skippedItemLabel = item.label;
                };
                return run;
            };

            await testControllerPrivate.runHandler(request, tokenSource.token, 'run');

            assert.strictEqual(skippedCalled, true, 'run.skipped should have been called');
            assert.ok(skippedItemLabel.includes('Scenario 2'), 'Scenario 2 should be skipped because it was unprocessed');

            testControllerPrivate.controller.createTestRun = originalCreateTestRun;
        } finally {
            cp.spawn = originalSpawn;
        }
    });

    test('resolveHandler without item discovers workspace files', async () => {
        // Mock workspace findFiles
        const originalFindFiles = vscode.workspace.findFiles;
        const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(vscode.workspace, 'workspaceFolders');
        let findFilesCalled = false;

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            get: () => [{ uri: vscode.Uri.file('/tmp'), name: 'tmp', index: 0 }]
        });

        vscode.workspace.findFiles = async (pattern: any) => {
            const p = typeof pattern === 'string' ? pattern : pattern.pattern;
            if (p === '**/*.feature') {
                findFilesCalled = true;
                return [vscode.Uri.file(path.join(tempDir, 'resolve.feature'))];
            }
            return [];
        };

        const testControllerPrivate = controller as any;
        // Mock parseTestsInFileContents so it doesn't fail trying to read a non-existent file
        testControllerPrivate.parseTestsInFileContents = async () => {};

        try {
            await testControllerPrivate.controller.resolveHandler();
            assert.strictEqual(findFilesCalled, true, 'Should have searched for .feature files');

            // It should have created the file item
            const fileItem = testControllerPrivate.controller.items.get(vscode.Uri.file(path.join(tempDir, 'resolve.feature')).toString());
            assert.ok(fileItem, 'File item should have been created');
        } finally {
            vscode.workspace.findFiles = originalFindFiles;
            if (originalWorkspaceFolders) {
                Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
            }
        }
    });

    test('resolveHandler with item parses the file', async () => {
        const testControllerPrivate = controller as any;
        let parseCalled = false;
        testControllerPrivate.parseTestsInFileContents = async (_item: vscode.TestItem) => {
            parseCalled = true;
        };

        const mockItem = { uri: vscode.Uri.file('mock.feature') } as vscode.TestItem;
        await testControllerPrivate.controller.resolveHandler(mockItem);

        assert.strictEqual(parseCalled, true, 'Should have called parseTestsInFileContents');
    });

    test('runHandler in debug mode starts debugger', async () => {
        const featureUri = vscode.Uri.file(path.join(tempDir, 'debug.feature'));
        fs.writeFileSync(featureUri.fsPath, `
Feature: Debug Feature
  Scenario: Debug scenario
    Given a step
`);

        const testControllerPrivate = controller as any;
        const fileItem = testControllerPrivate.getOrCreateFile(featureUri);
        await testControllerPrivate.parseTestsInFileContents(fileItem);

        // Mock vscode.commands.executeCommand to intercept debug commands
        const originalExecuteCommand = vscode.commands.executeCommand;
        let executeCommandCalled = false;
        let executeCommandArgs: any[] = [];
        vscode.commands.executeCommand = async <T = unknown>(command: string, ...args: any[]): Promise<T> => {
            if (command === 'gherkinPowerTools.debugFeature' || command === 'gherkinPowerTools.debugScenario') {
                executeCommandCalled = true;
                executeCommandArgs = args;
                return undefined as unknown as T;
            }
            return originalExecuteCommand<T>(command, ...args);
        };

        const originalCreateTestRun = testControllerPrivate.controller.createTestRun;
        let endCalled = false;
        testControllerPrivate.controller.createTestRun = (req: any) => {
            const run = originalCreateTestRun.call(testControllerPrivate.controller, req);
            run.end = () => { endCalled = true; };
            return run;
        };

        try {
            const request = new vscode.TestRunRequest([fileItem]);
            const tokenSource = new vscode.CancellationTokenSource();

            await testControllerPrivate.runHandler(request, tokenSource.token, 'debug');

            assert.strictEqual(executeCommandCalled, true, 'debug command should have been called');
            assert.ok(executeCommandArgs[0], 'Should have passed uri to debug command');
            assert.strictEqual(endCalled, false, 'Run should not have been created or ended in debug mode');

            testControllerPrivate.controller.createTestRun = originalCreateTestRun;
        } finally {
            vscode.commands.executeCommand = originalExecuteCommand;
        }
    });
});
