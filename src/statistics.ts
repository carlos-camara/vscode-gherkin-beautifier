import * as vscode from 'vscode';
import { WorkspaceGraph, FeatureNode, ScenarioNode, BackgroundNode, StepNode, TagNode } from './graph';
import { SymbolCache } from './cache';
import { StepAnalyzer, StepAnalysisResult } from './stepAnalyzer';

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
        'Project Health Dashboard',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getLoadingHtml();

    try {
        const metrics = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Calculating Project Health",
            cancellable: false
        }, async () => {
            await graph.initialize();
            return calculateHealthMetrics(graph, symbolCache);
        });

        const version = context.extension.packageJSON?.version || '1.8.0';
        panel.webview.html = getDashboardHtml(metrics, version);

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
    return `<!DOCTYPE html><html><body style="padding:20px;font-family:sans-serif;"><h2>Analyzing Project Health...</h2><p>Scanning graph...</p></body></html>`;
}

export function getDashboardHtml(metrics: ProjectHealthMetrics, version: string): string {
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

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Health Dashboard</title>
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
            /* Animated subtle gradient background */
            background: linear-gradient(-45deg, var(--vscode-editor-background), var(--vscode-editorWidget-background), var(--vscode-editor-background));
            background-size: 400% 400%;
            animation: gradientBG 15s ease infinite;
        }

        @keyframes gradientBG {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 40px;
            animation: fadeInUp 0.5s ease-out forwards;
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
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            opacity: 0;
            animation: fadeInUp 0.6s ease-out forwards;
        }

        .score-card:nth-child(1) { animation-delay: 0.1s; }
        .score-card:nth-child(2) { animation-delay: 0.2s; }
        .score-card:nth-child(3) { animation-delay: 0.3s; }

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
            opacity: 0;
            animation: fadeInUp 0.6s ease-out forwards 0.4s;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: var(--spacing);
            opacity: 0;
            animation: fadeInUp 0.6s ease-out forwards 0.5s;
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
            opacity: 0;
            animation: fadeInUp 0.6s ease-out forwards 0.6s;
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
        <h1>Project Health Dashboard</h1>
        <span class="badge" style="font-size: 14px; padding: 6px 14px;">v${version}</span>
    </div>

    <div class="scores-grid">
        <div class="score-card health">
            <div class="score-label">Overall Health</div>
            <div class="score-value">${metrics.scores.health}</div>
        </div>
        <div class="score-card maintain">
            <div class="score-label">Maintainability</div>
            <div class="score-value">${metrics.scores.maintainability}</div>
        </div>
        <div class="score-card complex">
            <div class="score-label">Complexity</div>
            <div class="score-value">${metrics.scores.complexity}</div>
        </div>
    </div>

    <h2 class="section-title">Technical Debt & Quality</h2>
    <div class="metrics-grid">
        <div class="metric-panel">
            <div class="metric-header" onclick="togglePanel(this)">
                <div class="icon-title"><span>⚠️</span> <span>Unused Steps</span></div>
                <span class="badge">${metrics.stepAnalysis.unusedSteps.length}</span>
            </div>
            <div class="metric-body">
                ${metrics.stepAnalysis.unusedSteps.length ? metrics.stepAnalysis.unusedSteps.map(u =>
                    `<div class="list-item">
                        <div>
                            <div class="step-def">${escapeHtml(u.stepDef.pattern)}</div>
                        </div>
                        ${renderLink(u.stepDef.uri, u.stepDef.line, 'Go →')}
                    </div>`
                ).join('') : '<div class="empty-state"><span class="emoji">🎉</span><span>No unused steps! Codebase is clean.</span></div>'}
            </div>
        </div>

        <div class="metric-panel">
            <div class="metric-header" onclick="togglePanel(this)">
                <div class="icon-title"><span>🔄</span> <span>Duplicated Steps</span></div>
                <span class="badge">${metrics.stepAnalysis.duplicatedSteps.length}</span>
            </div>
            <div class="metric-body">
                ${metrics.stepAnalysis.duplicatedSteps.length ? metrics.stepAnalysis.duplicatedSteps.map(d =>
                    `<div class="list-item" style="flex-direction: column; align-items: flex-start;">
                        <div class="step-def">${escapeHtml(d.pattern)}</div>
                        <div style="font-size: 13px; margin-top: 8px; opacity: 0.8; padding-left: 4px;">
                            Found in: ${d.stepDefs.map(def => renderLink(def.uri, def.line, 'Go →')).join(' | ')}
                        </div>
                    </div>`
                ).join('') : '<div class="empty-state"><span class="emoji">✨</span><span>No duplicated steps! Great job.</span></div>'}
            </div>
        </div>

        <div class="metric-panel">
            <div class="metric-header" onclick="togglePanel(this)">
                <div class="icon-title"><span>❓</span> <span>Undefined Steps</span></div>
                <span class="badge">${metrics.undefinedSteps.length}</span>
            </div>
            <div class="metric-body">
                ${metrics.undefinedSteps.length ? metrics.undefinedSteps.map(s =>
                    `<div class="list-item">
                        <span title="${escapeHtml(s.text)}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; display: inline-block;">
                            <strong>${escapeHtml(s.keyword)}</strong> ${escapeHtml(s.text)}
                        </span>
                        ${renderLink(s.uri, s.line, 'Go →')}
                    </div>`
                ).join('') : '<div class="empty-state"><span class="emoji">✅</span><span>All steps are defined!</span></div>'}
            </div>
        </div>
    </div>

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
</body>
</html>`;
}
