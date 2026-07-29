import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { GherkinTestController } from '../../testController';
import { ConfigurationService } from '../../configuration';

suite('GherkinTestController Test Suite', () => {
    let tempDir: string;
    let configService: ConfigurationService;
    let controller: GherkinTestController;

    setup(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gherkin-test-controller-'));
        const configDiagnostics = vscode.languages.createDiagnosticCollection('gherkin-configuration-test');
        configService = new ConfigurationService(configDiagnostics);
        const uniqueId = `gherkin-tests-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const mockContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        controller = new GherkinTestController(mockContext, configService, uniqueId);
    });

    teardown(() => {
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
        assert.strictEqual(featureItem!.label, 'Feature: Sample Feature');
        assert.strictEqual(featureItem!.children.size, 1);

        let scenarioItem: vscode.TestItem | undefined;
        featureItem!.children.forEach((item: vscode.TestItem) => {
            scenarioItem = item;
        });

        assert.ok(scenarioItem);
        assert.strictEqual(scenarioItem!.label, 'Scenario: First scenario');
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
        
        assert.strictEqual(featureItem!.children.size, 1);
        let ruleItem: vscode.TestItem | undefined;
        featureItem!.children.forEach((item: vscode.TestItem) => { ruleItem = item; });
        
        assert.ok(ruleItem);
        assert.strictEqual(ruleItem!.label, 'Rule: A business rule');
        assert.strictEqual(ruleItem!.children.size, 1);
        
        let scenarioItem: vscode.TestItem | undefined;
        ruleItem!.children.forEach((item: vscode.TestItem) => { scenarioItem = item; });
        
        assert.strictEqual(scenarioItem!.label, 'Scenario: Rule scenario');
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
});
