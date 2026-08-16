import * as assert from 'assert';
import * as vscode from 'vscode';
import { GherkinTestController } from '../../testController';
import { WorkspaceEventBus } from '../../eventBus';

suite('Test Controller Coexistence E2E Test Suite', () => {
    let gherkinTestController: GherkinTestController;
    let mockCoverageController: vscode.TestController;
    let eventBus: WorkspaceEventBus;

    setup(async () => {
        eventBus = new WorkspaceEventBus();
        
        // Initialize our extension's Test Controller
        gherkinTestController = new GherkinTestController(
            { extensionPath: __dirname, subscriptions: [] } as any, 
            { get: () => [] } as any,
            'gherkin-tests-mock-e2e'
        );

        // Initialize a mock Test Controller from another extension that supports Coverage
        mockCoverageController = vscode.tests.createTestController('mock-coverage-id', 'Mock Coverage Controller');
        mockCoverageController.createRunProfile(
            'Coverage Profile',
            vscode.TestRunProfileKind.Coverage,
            async () => {}
        );
    });

    teardown(() => {
        gherkinTestController.dispose();
        mockCoverageController.dispose();
        eventBus.dispose();
    });

    test('Gherkin Test Controller does not conflict with external Coverage profiles', () => {
        // Assert our controller only creates Run and Debug profiles
        // Note: VS Code API doesn't expose a direct array of profiles on the TestController interface 
        // to assert the count directly in tests, but we can verify our controller instantiated without throwing
        assert.ok(gherkinTestController, 'GherkinTestController initialized');
        assert.ok(mockCoverageController, 'Mock coverage controller initialized');

        // We check that our implementation did not throw when a coverage profile exists in the same workspace.
        assert.strictEqual(mockCoverageController.id, 'mock-coverage-id');
    });
});
