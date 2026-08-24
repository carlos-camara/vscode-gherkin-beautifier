import * as vscode from 'vscode';
import * as cp from 'child_process';
import { ProjectHealthMetrics } from './statistics';

export interface VersionedSnapshot {
    timestamp: string;
    health: number;
    maintainability: number;
    complexity: number;
    techDebtTotal: number;
    metricsAlgorithmVersion: string;
}

interface HistorySchemaV1 {
    schemaVersion: 1;
    workspaceName: string;
    branches: {
        [branchName: string]: VersionedSnapshot[];
    };
}

export class MetricsHistory {
    private static readonly STATE_KEY = 'gherkinPowerTools.historicalSnapshots';
    private static readonly CURRENT_ALGORITHM_VERSION = '1.1.0';

    constructor(private context: vscode.ExtensionContext) {}

    private getCurrentBranch(): string {
        try {
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
                const branch = cp.execSync('git branch --show-current', { cwd: folders[0].uri.fsPath, encoding: 'utf8' }).trim();
                return branch || 'default';
            }
        } catch (e) {
            // Git might not be installed or not a git repo
        }
        return 'default';
    }

    private getWorkspaceName(): string {
        return vscode.workspace.name || 'default';
    }

    public getHistoryStorage(): HistorySchemaV1 {
        try {
            const raw = this.context.workspaceState.get<any>(MetricsHistory.STATE_KEY);
            if (!raw) {
                return this.createEmptySchema();
            }

            // Migration from v0 (Array) to v1
            if (Array.isArray(raw)) {
                return this.migrateFromV0(raw);
            }

            // If it has a schemaVersion, we can handle it
            if (raw.schemaVersion === 1) {
                return raw as HistorySchemaV1;
            }

            // Unrecognized schema
            this.archiveCorrupted(raw);
            return this.createEmptySchema();
        } catch (e) {
            this.context.workspaceState.update(MetricsHistory.STATE_KEY + '.corrupted', Date.now());
            return this.createEmptySchema();
        }
    }

    private createEmptySchema(): HistorySchemaV1 {
        return {
            schemaVersion: 1,
            workspaceName: this.getWorkspaceName(),
            branches: {}
        };
    }

    private migrateFromV0(oldSnapshots: any[]): HistorySchemaV1 {
        const schema = this.createEmptySchema();
        const branch = this.getCurrentBranch();

        schema.branches[branch] = oldSnapshots.map(s => ({
            timestamp: s.timestamp,
            health: s.health,
            maintainability: s.maintainability,
            complexity: s.complexity,
            techDebtTotal: s.techDebtTotal || 0,
            metricsAlgorithmVersion: '1.0.0' // Explicitly mark old ones
        }));

        return schema;
    }

    private archiveCorrupted(raw: any) {
        this.context.workspaceState.update(MetricsHistory.STATE_KEY + '.corrupted_' + Date.now(), raw);
    }

    public getSnapshots(branch?: string): VersionedSnapshot[] {
        const history = this.getHistoryStorage();
        const targetBranch = branch || this.getCurrentBranch();
        return history.branches[targetBranch] || [];
    }

    public addSnapshot(metrics: ProjectHealthMetrics): VersionedSnapshot[] {
        const config = vscode.workspace.getConfiguration('gherkinPowerTools');
        const enabled = config.get<boolean>('analytics.historicalTrends.enabled', true);

        if (!enabled) {
            return this.getSnapshots();
        }

        const history = this.getHistoryStorage();
        const branch = this.getCurrentBranch();

        if (!history.branches[branch]) {
            history.branches[branch] = [];
        }

        const snapshots = history.branches[branch];
        const retention = config.get<number>('analytics.historicalTrends.retentionSnapshots', 30);
        const maxStorageBytes = config.get<number>('analytics.historicalTrends.maxStorageBytes', 500000);

        const techDebtTotal =
            (metrics.undefinedSteps?.length || 0) +
            (metrics.stepAnalysis?.unusedSteps?.length || 0) +
            (metrics.stepAnalysis?.duplicatedSteps?.length || 0) +
            (metrics.stepAnalysis?.ambiguousSteps?.length || 0);

        // Deduplication
        if (snapshots.length > 0) {
            const last = snapshots[snapshots.length - 1];
            if (last.health === metrics.scores.health &&
                last.maintainability === metrics.scores.maintainability &&
                last.complexity === metrics.scores.complexity &&
                last.techDebtTotal === techDebtTotal &&
                last.metricsAlgorithmVersion === MetricsHistory.CURRENT_ALGORITHM_VERSION) {

                // Update timestamp but don't append a new record
                last.timestamp = new Date().toISOString();
                this.saveStorage(history, maxStorageBytes);
                return snapshots;
            }
        }

        const newSnapshot: VersionedSnapshot = {
            timestamp: new Date().toISOString(),
            health: metrics.scores.health,
            maintainability: metrics.scores.maintainability,
            complexity: metrics.scores.complexity,
            techDebtTotal,
            metricsAlgorithmVersion: MetricsHistory.CURRENT_ALGORITHM_VERSION
        };

        snapshots.push(newSnapshot);

        while (snapshots.length > retention) {
            snapshots.shift();
        }

        this.saveStorage(history, maxStorageBytes);
        return snapshots;
    }

    private saveStorage(history: HistorySchemaV1, maxStorageBytes: number) {
        // Enforce max storage size across all branches
        let serialized = JSON.stringify(history);
        while (serialized.length > maxStorageBytes) {
            // Need to trim the oldest snapshot from any branch
            let oldestBranch: string | null = null;
            let oldestTime = new Date('9999-12-31').getTime();

            for (const [branch, snaps] of Object.entries(history.branches)) {
                if (snaps.length > 0) {
                    const time = new Date(snaps[0].timestamp).getTime();
                    if (time < oldestTime) {
                        oldestTime = time;
                        oldestBranch = branch;
                    }
                } else {
                    // Empty branch bucket, delete it
                    delete history.branches[branch];
                }
            }

            if (oldestBranch) {
                history.branches[oldestBranch].shift();
            } else {
                // If we get here, it means we can't trim anymore (shouldn't happen unless schema overhead is huge)
                break;
            }

            serialized = JSON.stringify(history);
        }

        this.context.workspaceState.update(MetricsHistory.STATE_KEY, history);
    }

    public exportHistory(): string {
        const history = this.getHistoryStorage();
        return JSON.stringify(history, null, 2);
    }

    public clearHistory(): void {
        this.context.workspaceState.update(MetricsHistory.STATE_KEY, undefined);
    }
}
