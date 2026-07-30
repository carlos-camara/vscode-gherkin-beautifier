import * as assert from 'assert';
import { calculateHealthMetrics, getDashboardHtml, getLoadingHtml, escapeHtml, showProjectHealthDashboard, ProjectHealthMetrics } from '../../statistics';
import { WorkspaceGraph } from '../../graph';
import { SymbolCache } from '../../cache';
import * as vscode from 'vscode';

suite('Statistics Security (XSS & Escaping) Test Suite', () => {

    test('escapeHtml: Escapes <script> tags', () => {
        const input = '<script>alert(1)</script>';
        const expected = '&lt;script&gt;alert(1)&lt;/script&gt;';
        assert.strictEqual(escapeHtml(input), expected);
    });

    test('escapeHtml: Handles complex SVG payload', () => {
        const input = '<svg onload="alert(1)"></svg>';
        const expected = '&lt;svg onload=&quot;alert(1)&quot;&gt;&lt;/svg&gt;';
        assert.strictEqual(escapeHtml(input), expected);
    });
});

suite('Project Health Dashboard Test Suite', () => {
    let symbolCache: SymbolCache;
    let graph: WorkspaceGraph;

    setup(() => {
        symbolCache = new SymbolCache();
        graph = new WorkspaceGraph(symbolCache);
    });

    test('getLoadingHtml: Returns valid HTML', () => {
        const html = getLoadingHtml();
        assert.ok(html.includes('Analyzing Project Health'));
    });

    test('getDashboardHtml: Renders metrics correctly', () => {
        const dummyMetrics: ProjectHealthMetrics = {
            totalFiles: 1,
            totalFeatures: 1,
            totalScenarios: 2,
            totalBackgrounds: 1,
            totalSteps: 10,
            totalTags: 5,
            averageScenarioLength: 5,
            averageBackgroundLength: 2,
            largestFeatures: [{ uri: 'file:///test.feature', name: 'Test Feature', size: 10 }],
            largestScenarios: [{ uri: 'file:///test.feature', line: 5, name: 'Very long scenario with <script>', size: 5 }],
            undefinedSteps: [],
            tagFrequencies: [{ name: '@smoke', count: 3 }],
            stepAnalysis: { totalStepDefs: 1, unusedSteps: [], duplicatedSteps: [], ambiguousSteps: [], suspiciousSimilarities: [] },
            scores: {
                complexity: 20,
                maintainability: 95,
                health: 88
            }
        };

        const html = getDashboardHtml(dummyMetrics, '1.8.0');

        assert.ok(html.includes('Very long scenario with &lt;script&gt;'));
        assert.ok(html.includes('@smoke'));
        assert.ok(html.includes('88')); // health score
    });

    test('calculateHealthMetrics: Handles empty graph gracefully', async () => {
        const metrics = await calculateHealthMetrics(graph, symbolCache);
        assert.strictEqual(metrics.totalFeatures, 0);
        assert.strictEqual(metrics.totalSteps, 0);
        assert.strictEqual(metrics.scores.complexity, 0);
        assert.strictEqual(metrics.scores.maintainability, 100);
        assert.strictEqual(metrics.scores.health, 100);
    });

    test('showProjectHealthDashboard: creates webview and calculates stats', async () => {
        let webviewHtml = '';

        const mockContext = {
            extension: {
                packageJSON: { version: '2.0.0' }
            }
        } as any;

        const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
        const originalWithProgress = vscode.window.withProgress;

        vscode.window.createWebviewPanel = () => ({
            webview: {
                set html(value: string) { webviewHtml = value; },
                onDidReceiveMessage: () => {}
            },
            dispose: () => {}
        } as any);

        vscode.window.withProgress = async (_options: any, task: any) => {
            return task({ report: () => {} } as any, { isCancellationRequested: false } as any);
        };

        await showProjectHealthDashboard(mockContext, graph, symbolCache);

        assert.ok(webviewHtml.includes('Project Health Dashboard'), 'Dashboard HTML should be set');

        vscode.window.createWebviewPanel = originalCreateWebviewPanel;
        vscode.window.withProgress = originalWithProgress;
    });
});
