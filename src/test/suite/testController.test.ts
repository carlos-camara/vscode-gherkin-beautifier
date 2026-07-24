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
        controller = new GherkinTestController(configService);
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
});
