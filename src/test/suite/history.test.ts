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
        sandbox.stub(history as any, 'getCurrentBranch').returns('main');
    });

    teardown(() => {
        sandbox.restore();
    });

    const createMockMetrics = (health = 80, maintain = 90, complex = 20, debt = 5): ProjectHealthMetrics => ({
        scores: { health, maintainability: maintain, complexity: complex },
        undefinedSteps: new Array(debt) as any,
        stepAnalysis: { unusedSteps: [], duplicatedSteps: [], ambiguousSteps: [], totalStepDefs: 10 } as any
    } as any);

    test('Initial state should be empty schema', () => {
        const snapshots = history.getSnapshots();
        assert.strictEqual(snapshots.length, 0);

        const storage = history.getHistoryStorage();
        assert.strictEqual(storage.schemaVersion, 1);
        assert.deepStrictEqual(storage.branches, {});
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

    test('Adds snapshot and creates branch bucket', () => {
        const metrics = createMockMetrics();
        const snapshots = history.addSnapshot(metrics);

        assert.strictEqual(snapshots.length, 1);
        assert.strictEqual(snapshots[0].health, 80);
        assert.strictEqual(snapshots[0].metricsAlgorithmVersion, '1.1.0');

        const storage = history.getHistoryStorage();
        assert.ok(storage.branches['main']);
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
