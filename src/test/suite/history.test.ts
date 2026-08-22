import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { MetricsHistory } from '../../history';
import { ProjectHealthMetrics } from '../../statistics';

suite('MetricsHistory Test Suite', () => {
    let context: vscode.ExtensionContext;
    let mockState: Map<string, any>;
    let history: MetricsHistory;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        mockState = new Map<string, any>();
        context = {
            workspaceState: {
                get: (key: string, defaultValue?: any) => mockState.has(key) ? mockState.get(key) : defaultValue,
                update: (key: string, value: any) => mockState.set(key, value),
                keys: () => Array.from(mockState.keys())
            } as any
        } as vscode.ExtensionContext;

        history = new MetricsHistory(context);

        // Mock getConfiguration
        const config = {
            get: (key: string, defaultValue?: any) => {
                if (key === 'analytics.historicalTrends.enabled') return true;
                if (key === 'analytics.historicalTrends.retentionSnapshots') return 5;
                if (key === 'analytics.historicalTrends.maxStorageBytes') return 50000;
                return defaultValue;
            }
        };
        sandbox.stub(vscode.workspace, 'getConfiguration').returns(config as any);
        
        // Mock workspace info
        sandbox.stub(vscode.workspace, 'name').value('mock-workspace');
        const folders = [{ uri: vscode.Uri.file('/tmp'), name: 'tmp', index: 0 }];
        sandbox.stub(vscode.workspace, 'workspaceFolders').value(folders);
        
        // Default git branch stub
        sandbox.stub(require('child_process'), 'execSync').returns('main\n');
    });

    teardown(() => {
        sandbox.restore();
    });

    const createMockMetrics = (health = 80, maintain = 90, complex = 20, debt = 5): ProjectHealthMetrics => ({
        scores: { health, maintainability: maintain, complexity: complex },
        stepAnalysis: { 
            technicalDebt: debt,
            totalStepDefs: 10,
            unusedSteps: [],
            duplicatedSteps: [],
            ambiguousSteps: []
        },
        parseErrors: [],
        totalFiles: 0, totalFeatures: 0, totalScenarios: 0, totalBackgrounds: 0, totalSteps: 0, totalTags: 0,
        averageScenarioLength: 0, averageBackgroundLength: 0,
        largestFeatures: [], largestScenarios: [], undefinedSteps: [], tagFrequencies: []
    } as any);

    test('Initial state should be empty schema', () => {
        const snapshots = history.getSnapshots();
        assert.strictEqual(snapshots.length, 0);

        const storage = history.getHistoryStorage();
        assert.strictEqual(storage.schemaVersion, 1);
        assert.deepStrictEqual(storage.branches, {});
    });

    test('getWorkspaceName returns correct value', () => {
        const storage = history.getHistoryStorage();
        assert.strictEqual(storage.workspaceName, 'mock-workspace');
        
        // Force no workspace name to hit fallback
        sandbox.stub(vscode.workspace, 'name').value(undefined);
        const emptyStorage = (history as any).createEmptySchema();
        assert.strictEqual(emptyStorage.workspaceName, 'default');
    });

    test('getCurrentBranch falls back when git fails or no folders', () => {
        const cpStub = require('child_process').execSync;
        cpStub.throws(new Error('no git'));
        
        let branch = (history as any).getCurrentBranch();
        assert.strictEqual(branch, 'default');

        // Without workspace folders
        sandbox.stub(vscode.workspace, 'workspaceFolders').value(undefined);
        branch = (history as any).getCurrentBranch();
        assert.strictEqual(branch, 'default');
    });

    test('Migrates from v0 array schema', () => {
        const oldArray = [
            { timestamp: '2020-01-01T00:00:00Z', health: 50, maintainability: 60, complexity: 70, techDebtTotal: 10 }
        ];
        mockState.set('gherkinPowerTools.historicalSnapshots', oldArray);

        const snapshots = history.getSnapshots('main');
        assert.strictEqual(snapshots.length, 1);
        assert.strictEqual(snapshots[0].metricsAlgorithmVersion, '1.0.0'); // V0 migration sets to 1.0.0
    });

    test('Handles corrupted state', () => {
        mockState.set('gherkinPowerTools.historicalSnapshots', { unexpected: 'garbage' });

        const snapshots = history.getSnapshots();
        assert.strictEqual(snapshots.length, 0);

        // Should have archived the bad state
        const keys = Array.from(mockState.keys());
        const corruptedKey = keys.find(k => k.includes('.corrupted_'));
        assert.ok(corruptedKey, 'Should have created a corrupted backup key');
    });

    test('Handles corrupted state where get throws', () => {
        // Force context.workspaceState.get to throw
        sandbox.stub(context.workspaceState, 'get').throws(new Error('Corrupt state'));
        
        const snapshots = history.getSnapshots();
        assert.strictEqual(snapshots.length, 0);
        assert.ok(mockState.has('gherkinPowerTools.historicalSnapshots.corrupted'));
    });

    test('Adds snapshot and creates branch bucket', () => {
        const metrics = createMockMetrics();
        const snapshots = history.addSnapshot(metrics);

        assert.strictEqual(snapshots.length, 1);
        assert.strictEqual(snapshots[0].health, 80);
        assert.strictEqual(snapshots[0].metricsAlgorithmVersion, '1.1.0');

        const storage = history.getHistoryStorage();
        assert.ok(storage.branches['main']);
    });

    test('Returns current snapshots if disabled', () => {
        const config = {
            get: (key: string, defaultValue?: any) => {
                if (key === 'analytics.historicalTrends.enabled') return false;
                return defaultValue;
            }
        };
        // Override config just for this test
        sandbox.restore();
        sandbox.stub(vscode.workspace, 'getConfiguration').returns(config as any);

        const snapshots = history.addSnapshot(createMockMetrics());
        assert.strictEqual(snapshots.length, 0); // Didn't add
    });

    test('Deduplicates identical successive snapshots', async () => {
        const metrics = createMockMetrics(80, 90, 20, 5);
        history.addSnapshot(metrics);
        const snaps1 = history.getSnapshots();
        const time1 = snaps1[0].timestamp;

        // Add exact same again (wait a bit to ensure time difference)
        await new Promise(resolve => setTimeout(resolve, 10));
        history.addSnapshot(metrics);
        const snaps2 = history.getSnapshots();

        assert.strictEqual(snaps2.length, 1, 'Should deduplicate');
        assert.notStrictEqual(snaps2[0].timestamp, time1, 'Should update timestamp');
    });

    test('Appends if metrics change', () => {
        history.addSnapshot(createMockMetrics(80));
        history.addSnapshot(createMockMetrics(81));

        const snaps = history.getSnapshots();
        assert.strictEqual(snaps.length, 2);
    });

    test('Enforces retention limit per branch', () => {
        for (let i = 0; i < 10; i++) {
            history.addSnapshot(createMockMetrics(i)); // Ensure they don't deduplicate
        }
        const snaps = history.getSnapshots();
        assert.strictEqual(snaps.length, 5, 'Retention should be 5');
        assert.strictEqual(snaps[0].health, 5, 'Should keep the most recent 5');
    });

    test('Enforces maxStorageBytes limit across all branches', () => {
        // Override maxStorageBytes to be very small, e.g. 300 bytes, which forces trim
        const config = {
            get: (key: string, defaultValue?: any) => {
                if (key === 'analytics.historicalTrends.enabled') return true;
                if (key === 'analytics.historicalTrends.retentionSnapshots') return 5;
                if (key === 'analytics.historicalTrends.maxStorageBytes') return 10; // VERY small
                return defaultValue;
            }
        };
        sandbox.restore();
        sandbox.stub(vscode.workspace, 'getConfiguration').returns(config as any);
        
        sandbox.stub(vscode.workspace, 'name').value('mock');
        const folders = [{ uri: vscode.Uri.file('/tmp'), name: 'tmp', index: 0 }];
        sandbox.stub(vscode.workspace, 'workspaceFolders').value(folders);
        
        const cpStub = sandbox.stub(require('child_process'), 'execSync');

        // Add a snapshot in main branch
        cpStub.returns('main');
        history.addSnapshot(createMockMetrics(10));
        
        // Add a snapshot in other branch
        cpStub.returns('other');
        history.addSnapshot(createMockMetrics(20));

        // Add another snapshot in main branch
        cpStub.returns('main');
        history.addSnapshot(createMockMetrics(30));

        // Let's also create an empty branch directly in the storage to test line 181-182
        const storage = history.getHistoryStorage();
        storage.branches['empty'] = [];
        (history as any).saveStorage(storage, 10); // Calling private saveStorage with small bytes limit
        
        // It should have trimmed the oldest snapshot or deleted empty branches
        const newStorage = history.getHistoryStorage();
        assert.strictEqual(newStorage.branches['empty'], undefined, "Should have deleted empty branch");
        // We know it deleted something because it loops until serialized length < 10
        const serialized = JSON.stringify(newStorage);
        assert.ok(serialized.length <= JSON.stringify((history as any).createEmptySchema()).length, "Should have reduced size");
    });

    test('Clears history', () => {
        history.addSnapshot(createMockMetrics());
        assert.strictEqual(history.getSnapshots().length, 1);

        history.clearHistory();
        assert.strictEqual(history.getSnapshots().length, 0);
    });

    test('Exports history as JSON', () => {
        history.addSnapshot(createMockMetrics());
        const exported = history.exportHistory();

        assert.ok(exported.includes('"schemaVersion": 1'));
        assert.ok(exported.includes('"main"'));
        assert.ok(exported.includes('"health": 80'));
    });
});
