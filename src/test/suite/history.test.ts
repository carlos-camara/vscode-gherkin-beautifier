import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { MetricsHistory } from '../../history';
import { ProjectHealthMetrics } from '../../statistics';

suite('MetricsHistory Test Suite', () => {
    let mockContext: vscode.ExtensionContext;
    let store: { [key: string]: any } = {};
    let getConfigurationStub: sinon.SinonStub;

    setup(() => {
        store = {};
        mockContext = {
            workspaceState: {
                get: <T>(key: string, defaultValue: T): T => {
                    return store[key] !== undefined ? store[key] : defaultValue;
                },
                update: (key: string, value: any): Thenable<void> => {
                    store[key] = value;
                    return Promise.resolve();
                },
                keys: () => Object.keys(store)
            }
        } as unknown as vscode.ExtensionContext;

        getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
        getConfigurationStub.withArgs('gherkinPowerTools').returns({
            get: (key: string, defaultValue: any) => {
                if (key === 'analytics.historicalTrends.enabled') return true;
                if (key === 'analytics.historicalTrends.retentionSnapshots') return 30;
                return defaultValue;
            }
        } as any);
    });

    teardown(() => {
        sinon.restore();
    });

    test('addSnapshot should store a new snapshot', () => {
        const history = new MetricsHistory(mockContext);
        const dummyMetrics = {
            scores: { health: 85, maintainability: 90, complexity: 20 },
            undefinedSteps: [],
            stepAnalysis: {}
        } as unknown as ProjectHealthMetrics;

        const snapshots = history.addSnapshot(dummyMetrics);
        
        assert.strictEqual(snapshots.length, 1);
        assert.strictEqual(snapshots[0].health, 85);
        assert.strictEqual(snapshots[0].maintainability, 90);
        assert.strictEqual(snapshots[0].complexity, 20);
        assert.strictEqual(snapshots[0].techDebtTotal, 0);
    });

    test('addSnapshot should honor retention limits', () => {
        const history = new MetricsHistory(mockContext);
        const dummyMetrics = {
            scores: { health: 80, maintainability: 80, complexity: 20 },
            undefinedSteps: [],
            stepAnalysis: {}
        } as unknown as ProjectHealthMetrics;

        for (let i = 0; i < 40; i++) {
            history.addSnapshot(dummyMetrics);
        }

        const snapshots = history.getSnapshots();
        // Retention default is 30
        assert.strictEqual(snapshots.length, 30);
    });

    test('clearHistory should remove all snapshots', () => {
        const history = new MetricsHistory(mockContext);
        const dummyMetrics = {
            scores: { health: 80, maintainability: 80, complexity: 20 },
            undefinedSteps: [],
            stepAnalysis: {}
        } as unknown as ProjectHealthMetrics;

        history.addSnapshot(dummyMetrics);
        history.clearHistory();
        const snapshots = history.getSnapshots();
        assert.strictEqual(snapshots.length, 0);
    });
});
