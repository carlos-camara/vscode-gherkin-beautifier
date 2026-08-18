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
        assert.ok(html.includes('Analyzing Gherkin Health'));
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
            tagFrequencies: [{ name: '@smoke', count: 3, files: [] }],
            stepAnalysis: { totalStepDefs: 1, unusedSteps: [], duplicatedSteps: [], ambiguousSteps: [] },
            scores: {
                complexity: 20,
                maintainability: 95,
                health: 88
            }
        };

        const dummySnapshots = [
            { timestamp: new Date(Date.now() - 10000).toISOString(), health: 80, maintainability: 90, complexity: 10, techDebtTotal: 0, metricsAlgorithmVersion: '1.0.0' },
            { timestamp: new Date().toISOString(), health: 88, maintainability: 95, complexity: 20, techDebtTotal: 0, metricsAlgorithmVersion: '1.0.0' }
        ];

        const html = getDashboardHtml(dummyMetrics, [], '1.8.0', dummySnapshots);

        assert.ok(html.includes('Very long scenario with &lt;script&gt;'));
        assert.ok(html.includes('@smoke'));
        assert.ok(html.includes('88')); // health score
        assert.ok(html.includes('Chart.defaults.color')); // verify script block was included
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
        let webviewOptions: any;

        let store: any = {};
        const mockContext = {
            extension: {
                packageJSON: { version: '2.0.0' }
            },
            workspaceState: {
                get: (key: string, def: any) => store[key] !== undefined ? store[key] : def,
                update: (key: string, val: any) => { store[key] = val; return Promise.resolve(); }
            }
        } as any;

        const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
        const originalWithProgress = vscode.window.withProgress;

        vscode.window.createWebviewPanel = (_viewType, _title, _showOptions, options) => {
            webviewOptions = options;
            return {
                webview: {
                    set html(value: string) { webviewHtml = value; },
                    onDidReceiveMessage: () => {}
                },
                onDidDispose: () => {},
                dispose: () => {}
            } as any;
        };

        vscode.window.withProgress = async (_options: any, task: any) => {
            return task({ report: () => {} } as any, { isCancellationRequested: false } as any);
        };

        await showProjectHealthDashboard(mockContext, graph, symbolCache);

        assert.ok(webviewHtml.includes('Gherkin Health'), 'Dashboard HTML should be set');
        assert.ok(webviewOptions, 'Webview options should be passed');
        assert.deepStrictEqual(webviewOptions.localResourceRoots, [], 'localResourceRoots should be empty for strict sandboxing');

        vscode.window.createWebviewPanel = originalCreateWebviewPanel;
        vscode.window.withProgress = originalWithProgress;
    });

    test('calculateHealthMetrics: Calculates scores correctly for a populated graph', async () => {
        const dummyStep = (id: string, uri: string, definitionId?: string) => ({
            id, type: 'Step', uri, line: 1, text: 'step', keyword: 'Given', parent: 'parent', definitionId
        });

        const f1Steps = [
            dummyStep('s1', 'file:///f1.feature', 'def1'),
            dummyStep('s2', 'file:///f1.feature', undefined), // undefined
            dummyStep('s3', 'file:///f1.feature', 'def2'),
            dummyStep('s4', 'file:///f1.feature', 'def2'),
            dummyStep('s5', 'file:///f1.feature', 'def1')
        ];

        const allNodes = [
            { type: 'Feature', uri: 'file:///f1.feature', name: 'Feature 1' },
            { type: 'Scenario', uri: 'file:///f1.feature', line: 10, name: 'Scenario 1', steps: ['s1', 's2'] },
            { type: 'Scenario', uri: 'file:///f1.feature', line: 20, name: 'Scenario 2', steps: ['s3', 's4'] },
            { type: 'Background', uri: 'file:///f1.feature', line: 5, steps: ['s5'] },
            ...f1Steps,
            { type: 'Tag', name: '@smoke', targets: ['target1', 'target2'] }
        ];

        const mockGraph: any = {
            getAllNodes: () => allNodes,
            getAllStepDefNodes: () => [
                { id: 'def1', pattern: 'step 1', usages: ['s1', 's5'] },
                { id: 'def2', pattern: 'step 2', usages: ['s3', 's4'] },
                { id: 'def3', pattern: 'unused step', usages: [] } // unused
            ],
            getAllStepNodes: () => f1Steps
        };

        const mockSymbolCache: any = {
            getStepDefinitions: async () => []
        };

        const metrics = await calculateHealthMetrics(mockGraph as WorkspaceGraph, mockSymbolCache as SymbolCache);

        // Verification of Mathematics
        // Scenarios = 2, totalSteps = 5, averageScenarioLength = 2, largestScenario = 2
        // averageBackgroundLength = 1, largestFeature = 5
        // complexity = (2/20)*40 + (2/30)*30 + (1/5)*10 + (5/100)*20 = 4 + 2 + 2 + 1 = 9
        assert.strictEqual(metrics.scores.complexity, 9, 'Complexity should be calculated precisely');

        // Step Analysis: totalStepDefs = 3, unusedSteps = 1 (33.333% capped at 30), undefinedSteps = 1 (1 out of 5 = 20%)
        // Maintainability = 100 - (30 + 20) = 50
        assert.strictEqual(metrics.scores.maintainability, 50, 'Maintainability should be calculated precisely');

        // Health = (50 * 0.6) + ((100 - 9) * 0.4) = 30 + 36.4 = 66.4 => 66
        assert.strictEqual(metrics.scores.health, 66, 'Health score should be weighted correctly');
    });
});
