import * as vscode from 'vscode';
import { WorkspaceGraph, FeatureNode, ScenarioNode, BackgroundNode, StepNode, TagNode } from './graph';
import { SymbolCache } from './cache';
import { StepAnalyzer, StepAnalysisResult } from './stepAnalyzer';
import { Recommendation, RecommendationEngine } from './recommendationEngine';
import { MetricsHistory, MetricsSnapshot } from './history';

export function escapeHtml(unsafe: string) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export interface ProjectHealthMetrics {
    totalFiles: number;
    totalFeatures: number;
    totalScenarios: number;
    totalBackgrounds: number;
    totalSteps: number;
    totalTags: number;

    averageScenarioLength: number;
    averageBackgroundLength: number;

    largestFeatures: { uri: string; name: string; size: number }[];
    largestScenarios: { uri: string; line: number; name: string; size: number }[];

    undefinedSteps: StepNode[];
    tagFrequencies: { name: string; count: number }[];

    stepAnalysis: StepAnalysisResult;

    scores: {
        complexity: number;
        maintainability: number;
        health: number;
    };
}

export async function showProjectHealthDashboard(context: vscode.ExtensionContext, graph: WorkspaceGraph, symbolCache: SymbolCache) {
    const panel = vscode.window.createWebviewPanel(
        'gherkinHealthDashboard',
        'Gherkin Health',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getLoadingHtml();

    try {
        const { metrics, recommendations, snapshots } = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Calculating Gherkin Health & Recommendations",
            cancellable: false
        }, async () => {
            await graph.initialize();
            const metrics = await calculateHealthMetrics(graph, symbolCache);
            const engine = new RecommendationEngine();
            const recommendations = engine.generateRecommendations(graph, metrics);
            
            const history = new MetricsHistory(context);
            const snapshots = history.addSnapshot(metrics);

            return { metrics, recommendations, snapshots };
        });

        const version = context.extension.packageJSON?.version || '1.8.0';
        panel.webview.html = getDashboardHtml(metrics, recommendations, version, snapshots);

        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'openFile') {
                try {
                    const uri = vscode.Uri.parse(message.uri);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    const editor = await vscode.window.showTextDocument(doc, { preview: false });
                    const line = message.line;
                    const range = new vscode.Range(line, 0, line, 0);
                    editor.selection = new vscode.Selection(range.start, range.end);
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                } catch (e) {
                    vscode.window.showErrorMessage(`Could not open file: ${e}`);
                }
            }
        });
    } catch (error) {
        panel.webview.html = `<h1>Error generating dashboard</h1><pre>${error}</pre>`;
    }
}

export async function calculateHealthMetrics(graph: WorkspaceGraph, symbolCache: SymbolCache): Promise<ProjectHealthMetrics> {
    const allNodes = graph.getAllNodes();
    const features = allNodes.filter(n => n.type === 'Feature') as FeatureNode[];
    const scenarios = allNodes.filter(n => n.type === 'Scenario') as ScenarioNode[];
    const backgrounds = allNodes.filter(n => n.type === 'Background') as BackgroundNode[];
    const steps = allNodes.filter(n => n.type === 'Step') as StepNode[];
    const tags = allNodes.filter(n => n.type === 'Tag') as TagNode[];

    const totalSteps = steps.length;
    const averageScenarioLength = scenarios.length > 0 ? scenarios.reduce((acc, s) => acc + s.steps.length, 0) / scenarios.length : 0;
    const averageBackgroundLength = backgrounds.length > 0 ? backgrounds.reduce((acc, b) => acc + b.steps.length, 0) / backgrounds.length : 0;

    const largestScenarios = [...scenarios]
        .sort((a, b) => b.steps.length - a.steps.length)
        .slice(0, 10)
        .map(s => ({ uri: s.uri, line: s.line, name: s.name, size: s.steps.length }));

    const featureSizes = features.map(f => {
        const fSteps = steps.filter(s => s.uri === f.uri);
        return { uri: f.uri, name: f.name, size: fSteps.length };
    });
    const largestFeatures = [...featureSizes].sort((a, b) => b.size - a.size).slice(0, 10);

    const undefinedSteps = steps.filter(s => !s.definitionId);

    const tagFrequencies = tags.map(t => ({ name: t.name, count: t.targets.length })).sort((a, b) => b.count - a.count).slice(0, 50);

    const analyzer = new StepAnalyzer(graph, symbolCache);
    const stepAnalysis = await analyzer.analyze();

    // Scoring Algorithms
    // 1. Complexity (0 to 100, where 0 is perfect simple code, 100 is extreme spaghetti)
    let complexity = 0;
    complexity += Math.min((averageScenarioLength / 20) * 40, 40);
    complexity += Math.min(((largestScenarios[0]?.size || 0) / 30) * 30, 30);
    complexity += Math.min((averageBackgroundLength / 5) * 10, 10);
    complexity += Math.min(((largestFeatures[0]?.size || 0) / 100) * 20, 20);
    const finalComplexity = Math.round(Math.min(100, Math.max(0, complexity)));

    // 2. Maintainability (0 to 100, where 100 is perfect)
    let maintainability = 100;
    const totalDefs = Math.max(stepAnalysis.totalStepDefs, 1);
    const unusedPenalty = Math.min((stepAnalysis.unusedSteps.length / totalDefs) * 100, 30);
    const duplicatePenalty = Math.min((stepAnalysis.duplicatedSteps.length / totalDefs) * 100, 40);
    const undefinedPenalty = Math.min((undefinedSteps.length / Math.max(totalSteps, 1)) * 100, 30);
    maintainability -= (unusedPenalty + duplicatePenalty + undefinedPenalty);
    const finalMaintainability = Math.round(Math.min(100, Math.max(0, maintainability)));

    // 3. Overall Health (0 to 100)
    const health = Math.round((finalMaintainability * 0.6) + ((100 - finalComplexity) * 0.4));

    return {
        totalFiles: new Set(features.map(f => f.uri)).size,
        totalFeatures: features.length,
        totalScenarios: scenarios.length,
        totalBackgrounds: backgrounds.length,
        totalSteps: steps.length,
        totalTags: tags.length,
        averageScenarioLength,
        averageBackgroundLength,
        largestFeatures,
        largestScenarios,
        undefinedSteps,
        tagFrequencies,
        stepAnalysis,
        scores: {
            complexity: finalComplexity,
            maintainability: finalMaintainability,
            health
        }
    };
}

export function getLoadingHtml() {
    return `<!DOCTYPE html><html><body style="padding:20px;font-family:sans-serif;"><h2>Analyzing Gherkin Health...</h2><p>Scanning graph...</p></body></html>`;
}

export function getDashboardHtml(metrics: ProjectHealthMetrics, recommendations: Recommendation[], version: string, snapshots: MetricsSnapshot[] = []): string {
    const renderLink = (uri: string, line: number, text: string) => {
        return `<a href="#" class="file-link" onclick="openFile('${escapeHtml(uri)}', ${line})">${escapeHtml(text)}</a>`;
    };

    const getScoreGradient = (score: number, inverse = false) => {
        const s = inverse ? 100 - score : score;
        if (s >= 80) return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        if (s >= 50) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        return 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
    };

    const healthBg = getScoreGradient(metrics.scores.health);
    const maintainBg = getScoreGradient(metrics.scores.maintainability);
    const complexityBg = getScoreGradient(metrics.scores.complexity, true);

    const prevSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : undefined;

    const renderDelta = (current: number, previous: number | undefined, inverse = false) => {
        if (previous === undefined) return '';
        const diff = current - previous;
        if (diff === 0) return '<span style="font-size: 0.8em; opacity: 0.7; margin-left: 8px;">=</span>';
        
        let isGood = inverse ? diff < 0 : diff > 0;
        const color = isGood ? '#10b981' : '#ef4444';
        const arrow = diff > 0 ? '↗' : '↘';
        return `<span style="color: ${color}; font-size: 0.85em; margin-left: 8px; font-weight: bold; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 8px;">${diff > 0 ? '+' : ''}${diff} ${arrow}</span>`;
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net;">
    <title>Gherkin Health</title>
    <style>
        :root {
            --radius-lg: 16px;
            --radius-md: 12px;
            --spacing: 24px;
            --glass-bg: rgba(var(--vscode-editor-background-rgb, 30, 30, 30), 0.6);
            --glass-border: rgba(128, 128, 128, 0.2);
            --shadow-sm: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        body {
            font-family: var(--vscode-font-family);
            padding: var(--spacing);
            color: var(--vscode-foreground);
            margin: 0 auto;
            line-height: 1.6;
            max-width: 1200px;
            background: var(--vscode-editor-background);
        }

        /* Recommendations Card Styles */
        .rec-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
            animation: fadeInUp 0.4s ease-out forwards;
        }
        
        .rec-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            padding: 25px;
            transition: transform 0.2s, box-shadow 0.2s;
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow-sm);
        }
        body.vscode-light .rec-card {
            background: rgba(0, 0, 0, 0.02);
        }
        .rec-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-lg);
            border-color: var(--vscode-button-background);
        }
        .rec-header {
            display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;
        }
        .rec-title { margin: 0; font-size: 1.2em; font-weight: 600; }
        .severity-badge {
            padding: 4px 10px; border-radius: 12px; font-size: 0.75em; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .severity-high { background: #e74c3c; color: white; }
        .severity-medium { background: #f39c12; color: white; }
        .severity-low { background: #3498db; color: white; }
        .rec-explanation { margin: 0 0 20px 0; color: var(--vscode-descriptionForeground); flex-grow: 1; }
        .rec-fix {
            background-color: rgba(46, 204, 113, 0.1); border-left: 4px solid #2ecc71; padding: 12px 15px; border-radius: 4px; margin-bottom: 15px; font-size: 0.9em;
        }
        .rec-affected { font-size: 0.9em; }
        .rec-affected ul { margin: 5px 0 0 0; padding-left: 20px; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 40px;
            animation: fadeInUp 0.4s ease-out forwards;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5rem;
            background: linear-gradient(90deg, var(--vscode-textLink-foreground), var(--vscode-textPreformat-foreground));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 800;
            letter-spacing: -0.02em;
        }

        .scores-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: var(--spacing);
            margin-bottom: 48px;
        }

        .score-card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
            padding: 32px;
            text-align: center;
            box-shadow: var(--shadow-sm);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            animation: fadeInUp 0.4s ease-out forwards;
        }



        .score-card:hover {
            transform: translateY(-5px);
            box-shadow: var(--shadow-lg);
            border-color: var(--vscode-focusBorder);
        }

        .score-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; height: 4px;
        }
        .score-card.health::before { background: ${healthBg}; }
        .score-card.maintain::before { background: ${maintainBg}; }
        .score-card.complex::before { background: ${complexityBg}; }

        .score-value {
            font-size: 56px;
            font-weight: 900;
            margin: 16px 0;
            line-height: 1;
        }

        .score-card.health .score-value { background: ${healthBg}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .score-card.maintain .score-value { background: ${maintainBg}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .score-card.complex .score-value { background: ${complexityBg}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

        .score-label {
            font-size: 14px;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-weight: 600;
        }

        h2.section-title {
            font-size: 1.5rem;
            margin: 40px 0 24px 0;
            border-bottom: 2px solid var(--glass-border);
            padding-bottom: 8px;
            animation: fadeInUp 0.4s ease-out forwards;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: var(--spacing);
            animation: fadeInUp 0.4s ease-out forwards;
        }

        .metric-panel {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            overflow: hidden;
            box-shadow: var(--shadow-sm);
            transition: all 0.3s ease;
        }

        .metric-panel:hover {
            box-shadow: var(--shadow-lg);
            border-color: rgba(128,128,128, 0.4);
        }

        .metric-header {
            background: rgba(0,0,0,0.05);
            padding: 16px 20px;
            font-weight: 600;
            display: flex; justify-content: space-between; align-items: center;
            cursor: pointer; user-select: none;
            transition: background 0.2s ease;
        }

        .metric-header:hover { background: rgba(0,0,0,0.1); }
        .metric-header .icon-title { display: flex; align-items: center; gap: 8px; }

        .metric-body {
            padding: 0 20px;
            max-height: 0;
            overflow-y: auto;
            transition: max-height 0.4s cubic-bezier(0, 1, 0, 1), padding 0.4s ease;
            opacity: 0;
        }

        .metric-panel.expanded .metric-body {
            max-height: 400px;
            padding: 16px 20px;
            opacity: 1;
            transition: max-height 0.5s ease-in-out, padding 0.3s ease, opacity 0.4s ease 0.1s;
        }

        .list-item {
            padding: 12px 0;
            border-bottom: 1px solid var(--glass-border);
            display: flex; justify-content: space-between; align-items: center;
            transition: background 0.2s ease;
        }
        .list-item:last-child { border-bottom: none; }
        .list-item:hover { background: rgba(255,255,255,0.02); }

        .badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .file-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
            font-weight: 500;
            display: inline-block;
            transition: transform 0.2s ease;
        }
        .file-link:hover { text-decoration: underline; transform: translateX(2px); }

        details {
            background: rgba(0, 0, 0, 0.03);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            padding: 8px 12px;
            margin-top: 12px;
            transition: background 0.2s ease;
        }
        details:hover { background: rgba(0, 0, 0, 0.05); }
        summary {
            font-weight: 600;
            cursor: pointer;
            outline: none;
            user-select: none;
            color: var(--vscode-textLink-foreground);
        }
        details > ul { margin-top: 12px; margin-bottom: 4px; padding-left: 20px; }
        
        .step-def {
            margin-top: 6px;
            font-size: 13px;
            font-family: var(--vscode-editor-font-family);
            background: var(--vscode-textCodeBlock-background);
            padding: 6px 10px;
            border-radius: 6px;
            border: 1px solid var(--glass-border);
            display: inline-block;
        }

        .empty-state {
            text-align: center;
            padding: 32px 16px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-state .emoji { font-size: 32px; margin-bottom: 8px; display: block; }

        .overview-stats {
            display: flex; gap: 16px; flex-wrap: wrap; margin-top: 16px;
            animation: fadeInUp 0.4s ease-out forwards;
        }
        .stat-pill {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--glass-border);
            padding: 12px 20px;
            border-radius: 30px;
            font-size: 14px;
            display: flex; gap: 8px; align-items: center;
            box-shadow: var(--shadow-sm);
            transition: transform 0.2s ease;
        }
        .stat-pill:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
        .stat-pill strong { color: var(--vscode-foreground); font-weight: 600; opacity: 0.7; }
    </style>
    <script>
        const vscode = acquireVsCodeApi();
        function openFile(uri, line) { vscode.postMessage({ command: 'openFile', uri, line }); }
        function togglePanel(el) {
            const panel = el.closest('.metric-panel');
            panel.classList.toggle('expanded');
        }
    </script>
</head>
<body>
    <div class="header">
        <h1>Gherkin Health</h1>
        <span class="badge" style="font-size: 14px; padding: 6px 14px;">v${version}</span>
    </div>

    <div class="scores-grid">
        <div class="score-card health">
            <div class="score-label">Overall Health ${renderDelta(metrics.scores.health, prevSnapshot?.health)}</div>
            <div class="score-value">${metrics.scores.health}</div>
        </div>
        <div class="score-card maintain">
            <div class="score-label">Maintainability ${renderDelta(metrics.scores.maintainability, prevSnapshot?.maintainability)}</div>
            <div class="score-value">${metrics.scores.maintainability}</div>
        </div>
        <div class="score-card complex">
            <div class="score-label">Complexity ${renderDelta(metrics.scores.complexity, prevSnapshot?.complexity, true)}</div>
            <div class="score-value">${metrics.scores.complexity}</div>
        </div>
    </div>

    ${snapshots.length > 1 ? `
    <h2 class="section-title">Historical Trends</h2>
    <div style="background: var(--vscode-editorWidget-background); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 20px; box-shadow: var(--shadow-sm); margin-bottom: 40px; animation: fadeInUp 0.5s ease-out forwards 0.2s;">
        <canvas id="trendsChart" width="1000" height="250"></canvas>
    </div>
    ` : ''}

    ${recommendations.length > 0 ? `
    <h2 class="section-title">Actionable Insights</h2>
    <p style="color: var(--vscode-descriptionForeground); margin-bottom: 24px; opacity: 0; animation: fadeInUp 0.6s ease-out forwards 0.4s;">Prioritized recommendations to improve the health, maintenance, and reliability of your Gherkin tests.</p>
    <div class="rec-grid">
        ${recommendations.map(rec => `
            <div class="rec-card">
                <div class="rec-header">
                    <h3 class="rec-title">${escapeHtml(rec.title)}</h3>
                    <span class="severity-badge severity-${rec.severity}">${rec.severity}</span>
                </div>
                <p class="rec-explanation">${escapeHtml(rec.explanation)}</p>
                <div class="rec-fix">
                    <strong>Suggested Fix:</strong> ${escapeHtml(rec.suggestedFix)}
                </div>
                ${rec.affectedItems && rec.affectedItems.length > 0 ? `
                <div class="rec-affected">
                    <strong>Affected Items:</strong>
                    <details>
                        <summary>Show all ${rec.affectedItems.length} items</summary>
                        <ul>
                            ${rec.affectedItems.map(item => `
                                <li>
                                    <div class="step-def" style="margin-bottom: 4px; display: block;">${escapeHtml(item.label)}</div>
                                    <a href="#" class="file-link" style="font-size: 12px; margin-left: 8px;" onclick="openFile('${escapeHtml(item.uri)}', ${item.line || 0})">↳ ${escapeHtml(item.uri.split('/').pop() || item.uri)}${item.line ? `:${item.line + 1}` : ''}</a>
                                </li>
                            `).join('')}
                        </ul>
                    </details>
                </div>` : rec.affectedFiles && rec.affectedFiles.length > 0 ? `
                <div class="rec-affected">
                    <strong>Affected Files:</strong>
                    <details>
                        <summary>Show all ${rec.affectedFiles.length} files</summary>
                        <ul>
                            ${rec.affectedFiles.map(uri => `
                                <li><a href="#" class="file-link" onclick="openFile('${escapeHtml(uri)}', 0)">${escapeHtml(uri.split('/').pop() || uri)}</a></li>
                            `).join('')}
                        </ul>
                    </details>
                </div>` : ''}
            </div>
        `).join('')}
    </div>
    ` : `
    <h2 class="section-title">Actionable Insights</h2>
    <p style="color: var(--vscode-descriptionForeground); margin-bottom: 24px; opacity: 0; animation: fadeInUp 0.6s ease-out forwards 0.4s;">Prioritized recommendations to improve the health, maintenance, and reliability of your Gherkin tests.</p>
    <div class="rec-grid">
        <div class="rec-card" style="text-align: center; grid-column: 1 / -1; padding: 40px;">
            <span style="font-size: 32px; display: block; margin-bottom: 16px;">🎉</span>
            <h3 style="margin: 0;">Amazing!</h3>
            <p style="color: var(--vscode-descriptionForeground);">Your workspace is perfectly healthy. No recommendations found.</p>
        </div>
    </div>
    `}

    <h2 class="section-title">Technical Debt & Quality</h2>
    <p style="color: var(--vscode-descriptionForeground); margin-bottom: 24px; opacity: 0; animation: fadeInUp 0.6s ease-out forwards 0.4s;">Detailed metrics on potential issues and codebase complexity.</p>

    <h2 class="section-title">Architecture & Size</h2>
    <div class="metrics-grid">
        <div class="metric-panel">
            <div class="metric-header" onclick="togglePanel(this)">
                <div class="icon-title"><span>🐘</span> <span>Largest Scenarios</span></div>
                <span class="badge">Top 10</span>
            </div>
            <div class="metric-body">
                ${metrics.largestScenarios.length ? metrics.largestScenarios.map(s =>
                    `<div class="list-item">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; display: inline-block;">
                            ${renderLink(s.uri, s.line, s.name || 'Unnamed')}
                        </span>
                        <span class="badge">${s.size} steps</span>
                    </div>`
                ).join('') : '<div class="empty-state"><span>No scenarios found.</span></div>'}
            </div>
        </div>

        <div class="metric-panel">
            <div class="metric-header" onclick="togglePanel(this)">
                <div class="icon-title"><span>📚</span> <span>Largest Features</span></div>
                <span class="badge">Top 10</span>
            </div>
            <div class="metric-body">
                ${metrics.largestFeatures.length ? metrics.largestFeatures.map(f =>
                    `<div class="list-item">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; display: inline-block;">
                            ${renderLink(f.uri, 0, f.name || 'Unnamed')}
                        </span>
                        <span class="badge">${f.size} steps</span>
                    </div>`
                ).join('') : '<div class="empty-state"><span>No features found.</span></div>'}
            </div>
        </div>

        <div class="metric-panel">
            <div class="metric-header" onclick="togglePanel(this)">
                <div class="icon-title"><span>🏷️</span> <span>Top Tags</span></div>
                <span class="badge">Top 50</span>
            </div>
            <div class="metric-body">
                ${metrics.tagFrequencies.length ? metrics.tagFrequencies.map(t =>
                    `<div class="list-item">
                        <span style="font-weight: 500;">${escapeHtml(t.name)}</span>
                        <span class="badge" style="background: transparent; border: 1px solid var(--vscode-badge-background); color: var(--vscode-foreground);">${t.count} usages</span>
                    </div>`
                ).join('') : '<div class="empty-state"><span>No tags used.</span></div>'}
            </div>
        </div>
    </div>

    <h2 class="section-title">Overview Stats</h2>
    <div class="overview-stats">
        <div class="stat-pill"><strong>Features:</strong> <span>${metrics.totalFeatures}</span></div>
        <div class="stat-pill"><strong>Scenarios:</strong> <span>${metrics.totalScenarios}</span></div>
        <div class="stat-pill"><strong>Backgrounds:</strong> <span>${metrics.totalBackgrounds}</span></div>
        <div class="stat-pill"><strong>Steps:</strong> <span>${metrics.totalSteps}</span></div>
        <div class="stat-pill"><strong>Tags:</strong> <span>${metrics.totalTags}</span></div>
        <div class="stat-pill"><strong>Step Definitions:</strong> <span>${metrics.stepAnalysis.totalStepDefs}</span></div>
        <div class="stat-pill"><strong>Avg Scenario Length:</strong> <span>${metrics.averageScenarioLength.toFixed(1)} steps</span></div>
        <div class="stat-pill"><strong>Avg Background Length:</strong> <span>${metrics.averageBackgroundLength.toFixed(1)} steps</span></div>
    </div>

    ${snapshots.length > 1 ? `
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        const vscode = acquireVsCodeApi();
        const snapshots = ${JSON.stringify(snapshots)};
        const ctx = document.getElementById('trendsChart').getContext('2d');
        
        const labels = snapshots.map(s => {
            const d = new Date(s.timestamp);
            return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        });
        
        const style = getComputedStyle(document.body);
        const textColor = style.getPropertyValue('--vscode-foreground') || '#cccccc';
        const gridColor = style.getPropertyValue('--vscode-editorWidget-border') || 'rgba(128,128,128,0.2)';

        Chart.defaults.color = textColor;
        Chart.defaults.font.family = style.getPropertyValue('--vscode-font-family');
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Health',
                        data: snapshots.map(s => s.health),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Maintainability',
                        data: snapshots.map(s => s.maintainability),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Complexity',
                        data: snapshots.map(s => s.complexity),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: gridColor } },
                    y: { 
                        min: 0, 
                        max: 100, 
                        grid: { color: gridColor } 
                    }
                },
                plugins: {
                    legend: { labels: { color: textColor } }
                }
            }
        });
    </script>
    ` : ''}
</body>
</html>`;
}
