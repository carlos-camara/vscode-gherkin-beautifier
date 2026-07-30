import * as vscode from 'vscode';
import { ProjectHealthMetrics } from './statistics';

export interface MetricsSnapshot {
    timestamp: string;
    health: number;
    maintainability: number;
    complexity: number;
    techDebtTotal: number;
}

export class MetricsHistory {
    private static readonly STATE_KEY = 'gherkinPowerTools.historicalSnapshots';

    constructor(private context: vscode.ExtensionContext) {}

    public getSnapshots(): MetricsSnapshot[] {
        return this.context.workspaceState.get<MetricsSnapshot[]>(MetricsHistory.STATE_KEY, []);
    }

    public addSnapshot(metrics: ProjectHealthMetrics): MetricsSnapshot[] {
        const config = vscode.workspace.getConfiguration('gherkinPowerTools');
        const enabled = config.get<boolean>('analytics.historicalTrends.enabled', true);
        
        const snapshots = this.getSnapshots();
        
        if (!enabled) {
            return snapshots;
        }

        const retention = config.get<number>('analytics.historicalTrends.retentionSnapshots', 30);
        
        const techDebtTotal = 
            (metrics.undefinedSteps?.length || 0) + 
            (metrics.stepAnalysis?.unusedSteps?.length || 0) + 
            (metrics.stepAnalysis?.duplicatedSteps?.length || 0) + 
            (metrics.stepAnalysis?.ambiguousSteps?.length || 0);

        const newSnapshot: MetricsSnapshot = {
            timestamp: new Date().toISOString(),
            health: metrics.scores.health,
            maintainability: metrics.scores.maintainability,
            complexity: metrics.scores.complexity,
            techDebtTotal
        };

        snapshots.push(newSnapshot);

        while (snapshots.length > retention) {
            snapshots.shift();
        }

        this.context.workspaceState.update(MetricsHistory.STATE_KEY, snapshots);
        return snapshots;
    }

    public clearHistory(): void {
        this.context.workspaceState.update(MetricsHistory.STATE_KEY, undefined);
    }
}
