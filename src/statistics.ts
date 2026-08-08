import * as vscode from 'vscode';
import { WorkspaceGraph, FeatureNode, ScenarioNode, BackgroundNode, StepNode, TagNode, parseFeatureFile, DocumentNode, buildWorkspaceGraph } from './graph';
import { SymbolCache } from './cache';
import { StepAnalyzer, StepAnalysisResult } from './stepAnalyzer';
import { AntiPattern, AntiPatternEngine } from './antiPatternEngine';
import { MetricsHistory, VersionedSnapshot } from './history';
import { batchCreateStepDefinitions } from './codeAction';

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
    tagFrequencies: { name: string; count: number; files: string[] }[];

    stepAnalysis: StepAnalysisResult;

    scores: {
        complexity: number;
        maintainability: number;
        health: number;
    };
}

let currentPanel: vscode.WebviewPanel | undefined;

export async function showProjectHealthDashboard(context: vscode.ExtensionContext, graph: WorkspaceGraph, symbolCache: SymbolCache) {
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
    } else {
        currentPanel = vscode.window.createWebviewPanel(
            'gherkinHealthDashboard',
            'Gherkin Health',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
        });
    }

    const panel = currentPanel;

    panel.webview.html = getLoadingHtml();

    try {
        const { metrics, recommendations, snapshots } = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Calculating Gherkin Health & Anti-patterns",
            cancellable: false
        }, async () => {
            await graph.initialize();
            const metrics = await calculateHealthMetrics(graph, symbolCache);
            const engine = new AntiPatternEngine();
            const rawConfig = vscode.workspace.getConfiguration('gherkinPowerTools.antiPatterns').get('rules') || {};
            const ruleConfig = rawConfig as Record<string, string>;
            const recommendations = engine.generateAntiPatterns(graph, metrics, ruleConfig);
            
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
                    const line = typeof message.line === 'number' && message.line > 0 ? message.line - 1 : 0;
                    const range = new vscode.Range(line, 0, line, 0);
                    editor.selection = new vscode.Selection(range.start, range.end);
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                } catch (e) {
                    vscode.window.showErrorMessage(`Could not open file: ${e}`);
                }
            } else if (message.command === 'autoFix') {
                if (message.ruleId === 'undefined-steps') {
                    if (metrics.undefinedSteps && metrics.undefinedSteps.length > 0) {
                        let stepsToFix = metrics.undefinedSteps;
                        if (message.uri && typeof message.line === 'number') {
                            stepsToFix = metrics.undefinedSteps.filter(s => s.uri.toString() === message.uri && s.line === message.line);
                            if (stepsToFix.length === 0) {
                                vscode.window.showErrorMessage(`Could not find step to fix at ${message.uri}:${message.line}`);
                            }
                        }
                        const targetUri = await batchCreateStepDefinitions(stepsToFix);
                        if (targetUri) {
                            await symbolCache.updateFile(targetUri);
                            vscode.commands.executeCommand('gherkinPowerTools.showStatistics');
                        }
                    } else {
                        vscode.window.showInformationMessage('No undefined steps to fix.');
                    }
                }
            } else if (message.command === 'refresh') {
                vscode.commands.executeCommand('gherkinPowerTools.showStatistics');
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

    const tagFrequencies = tags.map(t => ({ 
        name: t.name, 
        count: t.targets.length,
        files: Array.from(new Set(t.targets.map(id => {
            const parts = id.split(':');
            return parts.length >= 2 ? parts[1] : '';
        }).filter(p => p !== '')))
    })).sort((a, b) => b.count - a.count);

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

export function getDashboardHtml(metrics: ProjectHealthMetrics, recommendations: AntiPattern[], version: string, snapshots: VersionedSnapshot[] = []): string {
    const renderLink = (uri: string, line: number, text: string) => {
        return `<a href="javascript:void(0)" class="file-link" onclick="openFile('${escapeHtml(uri)}', ${line})">${escapeHtml(text)}</a>`;
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

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            if (hours === 0) {
                const mins = Math.floor(diff / (1000 * 60));
                return mins <= 1 ? 'hace un momento' : `hace ${mins} min`;
            }
            return `hace ${hours}h`;
        }
        if (days === 1) return 'ayer';
        if (days < 7) return `hace ${days} días`;
        if (days < 14) return 'la semana pasada';
        const weeks = Math.floor(days / 7);
        if (weeks < 4) return `hace ${weeks} semanas`;
        return `el mes pasado`;
    };

    const renderDelta = (current: number, previous: number | undefined, timestamp?: string, inverse = false) => {
        if (previous === undefined) return '';
        const diff = current - previous;
        if (diff === 0) return '<div style="font-size: 14px; opacity: 0.5; margin-top: 4px; font-weight: normal; letter-spacing: normal;">= Sin cambios</div>';
        
        let isGood = inverse ? diff < 0 : diff > 0;
        const color = isGood ? '#10b981' : '#ef4444';
        const arrow = diff > 0 ? '↑' : '↓';
        const agoText = timestamp ? timeAgo(timestamp) : 'el último análisis';
        
        return `<div style="font-size: 14px; margin-top: 4px; font-weight: 500; letter-spacing: normal; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span style="color: ${color}; background: ${color}15; padding: 2px 8px; border-radius: 12px; font-weight: 700; border: 1px solid ${color}30;">${diff > 0 ? '+' : ''}${diff}% ${arrow}</span>
            <span style="opacity: 0.8; color: var(--vscode-descriptionForeground);">desde ${agoText}</span>
        </div>`;
    };

    const allFiles = new Set<string>();
    recommendations.forEach(rec => {
        if (rec.affectedItems) rec.affectedItems.forEach(i => allFiles.add(i.uri));
        if (rec.affectedFiles) rec.affectedFiles.forEach(f => allFiles.add(f));
    });
    const uniqueFiles = Array.from(allFiles).map(f => {
        return { uri: f, basename: f.split('/').pop() || f };
    }).sort((a, b) => a.basename.localeCompare(b.basename));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net;">
    <script src="https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.js"></script>
    <title>Gherkin Health</title>
    <style>
        :root {
            --radius-xl: 24px;
            --radius-lg: 16px;
            --radius-md: 12px;
            --spacing: 32px;
            --glass-border: rgba(128, 128, 128, 0.15);
            --glass-border-light: rgba(255, 255, 255, 0.08);
            --shadow-sm: 0 8px 32px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.2);
            --shadow-glow: 0 0 30px rgba(168, 85, 247, 0.15);
            --apple-font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
        }

        body {
            font-family: var(--apple-font);
            padding: 60px 40px;
            color: var(--vscode-foreground);
            margin: 0 auto;
            line-height: 1.5;
            max-width: 1100px;
            background-color: var(--vscode-editor-background);
            background-image: radial-gradient(circle at 50% -10%, rgba(168, 85, 247, 0.08) 0%, transparent 50%);
            background-attachment: fixed;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .header {
            margin-bottom: 60px;
            display: flex; justify-content: space-between; align-items: baseline;
            animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .header h1 {
            margin: 0;
            font-size: 3.8rem;
            font-weight: 800;
            letter-spacing: -0.04em;
            background: linear-gradient(135deg, var(--vscode-textLink-foreground), #bf5af2, #ff375f);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header .badge {
            font-size: 14px; padding: 6px 14px; background: rgba(128,128,128,0.15); border-radius: 20px; font-weight: 600; border: 1px solid var(--glass-border);
        }
        
        .refresh-btn {
            background: rgba(128,128,128,0.05);
            border: 1px solid var(--glass-border);
            color: var(--vscode-foreground);
            width: 38px;
            height: 38px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }
        
        .refresh-btn:hover {
            background: rgba(128,128,128,0.15);
            border-color: var(--glass-border-light);
            transform: rotate(180deg);
        }
        
        .search-container {
            position: relative;
            margin-bottom: 60px;
            animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.1s;
        }
        
        .spotlight-search {
            width: 100%;
            padding: 20px 28px;
            font-size: 1.4rem;
            font-family: var(--apple-font);
            border: 1px solid var(--glass-border);
            border-top: 1px solid var(--glass-border-light);
            border-radius: var(--radius-xl);
            background: var(--vscode-editorWidget-background);
            color: var(--vscode-foreground);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), var(--shadow-lg);
            outline: none;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-sizing: border-box;
        }
        
        .spotlight-search::placeholder {
            color: var(--vscode-descriptionForeground);
            opacity: 0.6;
        }
        
        .spotlight-search:focus {
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 0 4px rgba(168, 85, 247, 0.15), var(--shadow-lg), var(--shadow-glow);
            border-color: rgba(168, 85, 247, 0.4);
        }

        /* Card Base Styles */
        .premium-card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--glass-border);
            border-top: 1px solid var(--glass-border-light);
            border-radius: var(--radius-lg);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), var(--shadow-sm);
            transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            overflow: hidden;
        }
        .premium-card:hover {
            transform: translateY(-6px);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), var(--shadow-lg), var(--shadow-glow);
            border-color: rgba(128,128,128,0.25);
        }

        /* Scores Grid */
        .scores-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 24px;
            margin-bottom: 60px;
            animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.1s;
        }

        .score-card {
            border-radius: var(--radius-xl);
            padding: 40px 32px;
            text-align: center;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
        }

        .score-card::before {
            content: ''; position: absolute; top: 0; left: 0; right: 0; height: 100%;
            background: radial-gradient(circle at top, var(--glow-color) 0%, transparent 60%);
            opacity: 0.12; pointer-events: none;
        }
        .score-card.health { --glow-color: ${healthBg}; }
        .score-card.maintain { --glow-color: ${maintainBg}; }
        .score-card.complex { --glow-color: ${complexityBg}; }

        .score-value {
            font-size: 76px;
            font-weight: 800;
            margin: 8px 0 16px 0;
            line-height: 1;
            letter-spacing: -0.04em;
        }
        .score-card.health .score-value { color: ${healthBg}; }
        .score-card.maintain .score-value { color: ${maintainBg}; }
        .score-card.complex .score-value { color: ${complexityBg}; }

        .score-label {
            font-size: 14px;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-weight: 700;
        }

        h2.section-title {
            font-size: 2.2rem;
            font-weight: 700;
            letter-spacing: -0.03em;
            margin: 80px 0 24px 0;
            border: none;
            padding: 0;
            animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.2s;
        }

        /* Charts Grid */
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
            gap: 32px;
            margin-bottom: 80px;
            animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.3s;
        }
        .chart-card {
            padding: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .chart-card h3 {
            margin-top: 0;
            margin-bottom: 32px;
            font-weight: 600;
            text-align: center;
            font-size: 1.4rem;
            letter-spacing: -0.02em;
        }
        .chart-container {
            position: relative;
            width: 100%;
            min-height: 380px;
        }

        /* Anti-Patterns Grid */
        .rec-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
            gap: 32px;
            margin-bottom: 60px;
            animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.4s;
        }
        
        .rec-card {
            padding: 32px;
            display: flex;
            flex-direction: column;
        }
        body.vscode-light .rec-card { background: rgba(0, 0, 0, 0.02); }
        .rec-header {
            display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;
        }
        .rec-title { margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
        .severity-badge {
            padding: 4px 12px; border-radius: 12px; font-size: 0.75em; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .severity-error { background: rgba(255, 69, 58, 0.15); color: #ff453a; border: 1px solid rgba(255, 69, 58, 0.3); }
        .severity-warning { background: rgba(255, 159, 10, 0.15); color: #ff9f0a; border: 1px solid rgba(255, 159, 10, 0.3); }
        .severity-info { background: rgba(10, 132, 255, 0.15); color: #0a84ff; border: 1px solid rgba(10, 132, 255, 0.3); }
        .rec-explanation { margin: 0 0 24px 0; color: var(--vscode-descriptionForeground); flex-grow: 1; font-size: 1.05rem; }
        .rec-fix {
            background-color: rgba(128, 128, 128, 0.05);
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding: 16px 20px;
            border-radius: 8px;
            margin-bottom: 24px;
            font-size: 0.95em;
            line-height: 1.5;
        }
        .rec-affected { font-size: 0.95em; }
        .rec-affected ul { margin: 8px 0 0 0; padding-left: 20px; }

        /* Metrics Grid */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 24px;
            animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.5s;
        }

        .metric-panel {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            box-shadow: var(--shadow-sm);
            overflow: hidden;
            padding: 0;
            transition: box-shadow 0.3s;
        }
        .metric-panel:hover { box-shadow: var(--shadow-lg); }
        .metric-header {
            padding: 20px 24px;
            font-size: 1.1rem;
            font-weight: 600;
            display: flex; justify-content: space-between; align-items: center;
            cursor: pointer; user-select: none;
            background: transparent;
            transition: background 0.2s ease;
        }
        .metric-header:hover { background: rgba(128,128,128,0.04); }
        .metric-header .icon-title { display: flex; align-items: center; gap: 14px; }
        .chevron-icon {
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0.4;
            display: flex;
        }
        .metric-panel.expanded .chevron-icon { transform: rotate(90deg); }

        .metric-body {
            padding: 0 24px;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease, padding 0.4s ease, opacity 0.4s ease;
            opacity: 0;
        }
        .metric-panel.expanded .metric-body {
            max-height: 500px;
            padding: 16px 24px 24px 24px;
            opacity: 1;
            overflow-y: auto;
        }
        
        /* Leaderboard Item */
        .leaderboard-item {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 12px 0;
            position: relative;
        }
        .leaderboard-item:not(:last-child)::after {
            content: ''; position: absolute; bottom: 0; left: 44px; right: 0;
            height: 1px; background: var(--glass-border);
        }
        .leaderboard-rank { 
            font-size: 1rem; font-weight: 700; width: 28px; height: 28px; 
            background: rgba(128,128,128,0.1); border-radius: 8px; 
            display: flex; align-items: center; justify-content: center; 
        }
        .leaderboard-content { flex-grow: 1; min-width: 0; }
        .leaderboard-bar {
            height: 5px;
            background: var(--vscode-textLink-foreground);
            border-radius: 3px;
            margin-top: 8px;
            opacity: 0.85;
            transition: width 1s ease-out;
        }
        
        .list-item { padding: 12px 16px; border-bottom: 1px solid rgba(128,128,128,0.1); display: flex; justify-content: space-between; align-items: center; }
        .list-item:last-child { border-bottom: none; }
        
        /* Bento Box Grid */
        .bento-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .bento-card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: var(--shadow-sm);
            aspect-ratio: 1;
        }
        .bento-card:hover { 
            transform: translateY(-4px); 
            box-shadow: var(--shadow-lg); 
        }
        .bento-value {
            font-size: 3.2rem;
            font-weight: 800;
            letter-spacing: -0.04em;
            line-height: 1;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
            z-index: 1;
        }
        .bento-label {
            font-size: 0.95rem;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            z-index: 1;
            letter-spacing: 0.02em;
        }
        .bento-icon {
            position: absolute;
            right: -15px;
            bottom: -25px;
            font-size: 7rem;
            opacity: 0.06;
            z-index: 0;
            pointer-events: none;
            line-height: 1;
        }

        .badge {
            background: rgba(128,128,128,0.15);
            color: var(--vscode-foreground);
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            border: 1px solid var(--glass-border);
        }

        .file-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
            font-weight: 500;
            display: inline-block;
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s;
        }
        .file-link:hover { text-decoration: underline; color: #a855f7; transform: translateX(4px); }

        details {
            background: rgba(128, 128, 128, 0.05);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            padding: 12px 16px;
            margin-top: 16px;
            transition: background 0.2s ease;
        }
        details:hover { background: rgba(128, 128, 128, 0.08); }
        summary {
            font-weight: 600; cursor: pointer; outline: none; user-select: none;
            color: var(--vscode-textLink-foreground);
        }
        details > ul { margin-top: 16px; margin-bottom: 4px; padding-left: 20px; }
        
        .step-def {
            margin-top: 6px;
            font-size: 13px;
            font-family: var(--vscode-editor-font-family);
            background: rgba(128,128,128,0.1);
            padding: 6px 10px;
            border-radius: 6px;
            display: inline-block;
        }

        .empty-state {
            text-align: center;
            padding: 40px 16px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-state .emoji { font-size: 48px; margin-bottom: 16px; display: block; }

        .overview-stats { margin-top: 16px; animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.6s; }
        .stat-pill {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--glass-border);
            border-top: 1px solid var(--glass-border-light);
            padding: 12px 24px;
            border-radius: 30px;
            font-size: 14px;
            display: inline-flex; gap: 8px; align-items: center;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), var(--shadow-sm);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            margin-right: 12px;
            margin-bottom: 12px;
        }
        .stat-pill:hover { transform: translateY(-3px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), var(--shadow-lg), var(--shadow-glow); }
        .stat-pill strong { color: var(--vscode-foreground); font-weight: 600; opacity: 0.8; }
        
        .load-more-btn {
            background: none; border: none;
            color: var(--vscode-textLink-foreground);
            cursor: pointer; font-size: 13px; padding: 4px 0;
            margin-top: 12px; margin-left: 20px; font-weight: 600;
        }
        .load-more-btn:hover { text-decoration: underline; color: #a855f7; }
        .fix-btn { font-size: 1.25em; cursor: pointer; }
    </style>
    <script>
        const vscode = acquireVsCodeApi();
        
        // Auto-scroll details elements when they open
        document.querySelectorAll('details').forEach(detail => {
            detail.addEventListener('toggle', (e) => {
                if (detail.open) {
                    setTimeout(() => {
                        detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 50);
                }
            });
        });

        function refreshDashboard() { vscode.postMessage({ command: 'refresh' }); }
        function openFile(uri, line) { vscode.postMessage({ command: 'openFile', uri, line }); }
        function autoFix(ruleId, uri, line) { vscode.postMessage({ command: 'autoFix', ruleId, uri, line }); }
        function applyFilters() {
            const searchInput = document.getElementById('search-input');
            const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
            const featureFilter = document.getElementById('feature-filter');
            const uri = featureFilter ? featureFilter.value : '';
            
            const cards = document.querySelectorAll('.rec-card');
            const hideOnSearch = document.querySelectorAll('.hide-on-search');
            
            if (query.length > 0) {
                hideOnSearch.forEach(el => el.style.display = 'none');
                document.querySelectorAll('.inner-item').forEach(el => el.style.display = 'flex');
                document.querySelectorAll('.load-more-inner-btn').forEach(el => el.style.display = 'none');
            } else {
                hideOnSearch.forEach(el => el.style.display = '');
            }
            
            let isTagSearch = query.startsWith('@');
            let tagFiles = [];
            if (isTagSearch) {
                const matchedTag = tagsData.find(t => t.name.toLowerCase() === query);
                if (matchedTag) {
                    tagFiles = matchedTag.files.map(f => f.toLowerCase());
                } else {
                    const partialTags = tagsData.filter(t => t.name.toLowerCase().includes(query));
                    partialTags.forEach(t => {
                        tagFiles.push(...t.files.map(f => f.toLowerCase()));
                    });
                }
                renderTopTags(null);
            } else {
                renderTopTags(null); // Do not filter top tags by text query
            }
            
            const typeCounts = {};
            
            cards.forEach(card => {
                const title = card.querySelector('.rec-title').textContent.toLowerCase();
                const explanation = card.querySelector('.rec-explanation').textContent.toLowerCase();
                const cardSearchMatches = !isTagSearch && (title.includes(query) || explanation.includes(query));
                
                let hasVisibleItems = false;
                let totalCardItems = 0;
                const containers = card.querySelectorAll('[data-visible]');
                
                if (containers.length > 0) {
                    containers.forEach(container => {
                        const items = Array.from(container.querySelectorAll('.filterable-item'));
                        let matchCount = 0;
                        let itemTotal = 0;
                        
                        items.forEach(item => {
                            const fileAttr = item.getAttribute('data-file');
                            const itemText = item.textContent.toLowerCase();
                            
                            let searchMatches = false;
                            if (isTagSearch) {
                                if (fileAttr) {
                                    searchMatches = tagFiles.some(tf => fileAttr.toLowerCase().includes(tf));
                                }
                            } else {
                                searchMatches = query.length === 0 || cardSearchMatches || itemText.includes(query) || (fileAttr && fileAttr.toLowerCase().includes(query));
                            }
                            
                            const uriMatches = !uri || (fileAttr === uri);
                            
                            if (searchMatches && uriMatches) {
                                if (matchCount < 10) {
                                    item.style.display = '';
                                } else {
                                    item.style.display = 'none';
                                }
                                item.classList.add('is-match');
                                matchCount++;
                                
                                const innerItems = item.querySelectorAll('.inner-item');
                                if (innerItems.length > 0) {
                                    itemTotal += innerItems.length;
                                } else {
                                    itemTotal += 1;
                                }
                            } else {
                                item.style.display = 'none';
                                item.classList.remove('is-match');
                            }
                        });
                        
                        container.setAttribute('data-visible', Math.min(matchCount, 10).toString());
                        const btn = container.nextElementSibling;
                        if (btn && btn.classList.contains('load-more-btn')) {
                            const remaining = matchCount - 10;
                            if (remaining > 0) {
                                btn.textContent = 'Show more (' + remaining + ' remaining)';
                                btn.style.display = '';
                            } else {
                                btn.style.display = 'none';
                            }
                        }
                        
                        if (matchCount > 0) hasVisibleItems = true;
                        totalCardItems += itemTotal;
                        
                        const details = container.closest('details');
                        if (details) {
                            if ((uri || query.length > 0) && matchCount > 0) details.open = true;
                        }
                    });
                    
                    card.style.display = hasVisibleItems ? '' : 'none';
                } else {
                    card.style.display = (query.length === 0 || cardSearchMatches) ? '' : 'none';
                    if (card.style.display !== 'none') {
                        totalCardItems = 1;
                    }
                }
                
                const summaryCount = card.querySelector('.summary-count');
                if (summaryCount) {
                    summaryCount.textContent = totalCardItems.toString();
                }
                
                const explanationEl = card.querySelector('.rec-explanation');
                if (explanationEl) {
                    const originalText = explanationEl.getAttribute('data-original-text');
                    const originalCount = parseInt(explanationEl.getAttribute('data-original-count') || '0', 10);
                    if (originalCount > 0 && totalCardItems !== originalCount) {
                        const regex = new RegExp('\\\\b' + originalCount + '\\\\b');
                        explanationEl.textContent = originalText.replace(regex, totalCardItems.toString());
                    } else {
                        explanationEl.textContent = originalText;
                    }
                }
                
                if (card.style.display !== 'none') {
                    const cardType = card.getAttribute('data-type');
                    if (cardType) {
                        typeCounts[cardType] = (typeCounts[cardType] || 0) + totalCardItems;
                    }
                }
            });
            
            document.querySelectorAll('.anti-pattern-badge').forEach(badge => {
                const type = badge.getAttribute('data-type');
                const countSpan = badge.querySelector('.badge-count');
                if (type && countSpan) {
                    const newCount = typeCounts[type] || 0;
                    countSpan.textContent = newCount;
                    if (newCount === 0) {
                        badge.style.display = 'none';
                    } else {
                        badge.style.display = 'inline-flex';
                    }
                }
            });
        }

        function filterFeatures(uri) { applyFilters(); }
        
        const tagsData = ${JSON.stringify(metrics.tagFrequencies)};
        
        function renderTopTags(fileFilter) {
            const container = document.getElementById('tags-leaderboard-container');
            if (!container) return;
            
            let filteredTags = tagsData;
            if (fileFilter && fileFilter.length > 0) {
                const lowerFilter = fileFilter.toLowerCase();
                filteredTags = tagsData.filter(t => t.files.some(f => f.toLowerCase().includes(lowerFilter)));
            }
            
            filteredTags = [...filteredTags].sort((a, b) => b.count - a.count).slice(0, 10);
            
            if (filteredTags.length === 0) {
                container.innerHTML = '<div class="empty-state"><span class="emoji">🎉</span><span>No tags match.</span></div>';
                return;
            }
            
            const max = Math.max(...filteredTags.map(t => t.count), 1);
            
            container.innerHTML = filteredTags.map((t, i) => {
                const rank = (i + 1) + '.';
                const barWidth = (t.count / max) * 100;
                
                return '<div class="leaderboard-item">' +
                    '<div class="leaderboard-rank">' + rank + '</div>' +
                    '<div class="leaderboard-content">' +
                        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px;">' +
                            '<span style="flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">' + t.name + '</span>' +
                            '<span class="badge" style="flex-shrink: 0; white-space: nowrap; background: transparent; color: inherit; border: none; padding: 0;">' + t.count + ' usages</span>' +
                        '</div>' +
                        '<div class="leaderboard-bar" style="width: ' + barWidth + '%; background: linear-gradient(90deg, #34c759, #30d158);"></div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
        
        function filterByTag(tagName) {
            const input = document.querySelector('.spotlight-search');
            if (input) {
                const searchContainer = document.querySelector('.search-container');
                const scrollBefore = searchContainer ? searchContainer.getBoundingClientRect().top : 0;
                
                if (input.value === tagName) {
                    input.value = ''; // Toggle off
                } else {
                    input.value = tagName; // Toggle on
                }
                applyFilters();
                
                if (searchContainer) {
                    const scrollAfter = searchContainer.getBoundingClientRect().top;
                    window.scrollBy(0, scrollAfter - scrollBefore);
                }
            }
        }
        function showMoreItems(btn) {
            const container = btn.previousElementSibling;
            let visible = parseInt(container.getAttribute('data-visible') || '10', 10);
            const items = Array.from(container.querySelectorAll('.filterable-item.is-match'));
            const activeItems = items.length > 0 ? items : Array.from(container.querySelectorAll('.filterable-item'));
            
            const newVisible = visible + 10;
            
            for (let i = visible; i < newVisible && i < activeItems.length; i++) {
                activeItems[i].style.display = '';
            }
            
            container.setAttribute('data-visible', newVisible.toString());
            
            const remaining = activeItems.length - newVisible;
            if (remaining > 0) {
                btn.textContent = 'Show more (' + remaining + ' remaining)';
            } else {
                btn.style.display = 'none';
            }
        }

        function showMoreInnerItems(btn) {
            const container = btn.previousElementSibling;
            let visible = parseInt(container.getAttribute('data-visible') || '10', 10);
            const items = Array.from(container.querySelectorAll('.inner-item'));
            
            const newVisible = visible + 10;
            for (let i = visible; i < newVisible && i < items.length; i++) {
                items[i].style.display = 'flex';
            }
            
            container.setAttribute('data-visible', newVisible.toString());
            
            const remaining = items.length - newVisible;
            if (remaining > 0) {
                btn.textContent = 'Show more (' + remaining + ' hidden)';
            } else {
                btn.style.display = 'none';
            }
        }
        
        function filterByType(type, el) {
            const searchInput = document.getElementById('search-input');
            if (!searchInput) return;
            
            const searchContainer = document.getElementById('antipatterns-header') || document.querySelector('.search-container');
            const scrollBefore = searchContainer ? searchContainer.getBoundingClientRect().top : 0;
            
            if (searchInput.value === type) {
                searchInput.value = '';
                applyFilters();
                el.style.boxShadow = '';
                el.style.border = '1px solid var(--glass-border)';
                el.style.background = 'rgba(128,128,128,0.15)';
                el.style.color = '';
            } else {
                searchInput.value = type;
                applyFilters();
                document.querySelectorAll('.anti-pattern-badge').forEach(b => {
                    b.style.boxShadow = '';
                    b.style.border = '1px solid var(--glass-border)';
                    b.style.background = 'rgba(128,128,128,0.15)';
                    b.style.color = '';
                });
                el.style.boxShadow = '0 0 0 2px var(--vscode-focusBorder)';
                el.style.border = '1px solid transparent';
                el.style.background = 'var(--vscode-button-background)';
                el.style.color = 'var(--vscode-button-foreground)';
            }
            
            if (searchContainer) {
                const scrollAfter = searchContainer.getBoundingClientRect().top;
                window.scrollBy(0, scrollAfter - scrollBefore);
            }
        }

        function filterDashboard(query) { applyFilters(); }
        // Initial render
        function initDashboard() {
            renderTopTags('');
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initDashboard);
        } else {
            initDashboard();
        }
    </script>
</head>
<body>
    <div class="header">
        <h1>Gherkin Health</h1>
        <div style="display: flex; align-items: center; gap: 12px;">
            <button onclick="refreshDashboard()" class="refresh-btn" title="Refresh Dashboard">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-5.67"/>
                </svg>
            </button>
            <span class="badge" style="font-size: 14px; padding: 6px 14px;">v${version}</span>
        </div>
    </div>
    
    <div class="search-container">
        <input type="text" id="search-input" class="spotlight-search" placeholder="🔍 Search features, files, or anti-patterns..." oninput="filterDashboard(this.value)">
    </div>

    <div class="hide-on-search">
        <div class="scores-grid">
        <div class="score-card premium-card health">
            <div class="score-label">Health Balance</div>
            <div class="score-value">
                ${metrics.scores.health}%
            </div>
            ${renderDelta(metrics.scores.health, prevSnapshot?.health, prevSnapshot?.timestamp)}
        </div>
        <div class="score-card premium-card maintain">
            <div class="score-label">Maintainability</div>
            <div class="score-value">
                ${metrics.scores.maintainability}%
            </div>
            ${renderDelta(metrics.scores.maintainability, prevSnapshot?.maintainability, prevSnapshot?.timestamp)}
        </div>
        <div class="score-card premium-card complex">
            <div class="score-label">Complexity</div>
            <div class="score-value">
                ${metrics.scores.complexity}%
            </div>
            ${renderDelta(metrics.scores.complexity, prevSnapshot?.complexity, prevSnapshot?.timestamp, true)}
        </div>
    </div>


    ${snapshots.length > 1 ? `
    <h2 class="section-title">Historical Trends</h2>
    <div class="premium-card" style="padding: 32px; margin-bottom: 60px;">
        <canvas id="trendsChart" width="1000" height="250"></canvas>
    </div>
    ` : ''}

    ${recommendations.length > 0 ? `
    </div> <!-- end hide-on-search -->
    <h2 class="section-title" id="antipatterns-header">Actionable Anti-patterns</h2>
    <p style="color: var(--vscode-descriptionForeground); margin-bottom: 16px; opacity: 0; animation: fadeInUp 0.6s ease-out forwards 0.4s;">Prioritized anti-patterns affecting the health, maintenance, and reliability of your Gherkin tests.</p>
    
    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; opacity: 0; animation: fadeInUp 0.6s ease-out forwards 0.45s;">
        ${(() => {
            const aggregated = {};
            recommendations.forEach(r => {
                const type = r.title.includes(':') ? r.title.split(':')[0].trim() : r.title;
                const count = (r.affectedItems && r.affectedItems.length) || (r.affectedFiles && r.affectedFiles.length) || 1;
                aggregated[type] = (aggregated[type] || 0) + count;
            });
            const emojis = {
                'Undefined Steps': '🔴',
                'Oversized Scenario': '🐘',
                'Oversized Feature': '📚',
                'Duplicated Steps': '👯',
                'Unused Steps': '👻',
                'Ambiguous Steps': '🤷',
                'Excessive Tags on Feature': '🏷️',
                'Excessive Tags on Scenario': '🏷️',
                'Low Maintainability Score': '📉',
                'Inconsistent Formatting': '🧹'
            };
            return Object.entries(aggregated).map(([type, count]) => {
                const emoji = emojis[type] || '⚠️';
                return `<span class="anti-pattern-badge" data-type="${type}" onclick="filterByType('${type.replace(/'/g, "\\\\'")}', this)" style="cursor: pointer; background: rgba(128,128,128,0.15); border: 1px solid var(--glass-border); padding: 4px 12px; border-radius: 20px; font-size: 0.9em; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                    <span>${emoji}</span> <span class="badge-count">${count}</span> ${type}
                </span>`;
            }).join('');
        })()}
    </div>
    
    ${uniqueFiles.length > 0 ? `
    <div style="margin-bottom: 20px; animation: fadeInUp 0.6s ease-out forwards 0.5s;">
        <label for="feature-filter" style="font-weight: 600; margin-right: 8px;">Filter by File:</label>
        <select id="feature-filter" onchange="filterFeatures(this.value)" style="background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); padding: 4px 8px; border-radius: 4px; font-family: inherit; outline: none; cursor: pointer;">
            <option value="">All Files</option>
            ${uniqueFiles.map(f => `<option value="${escapeHtml(f.uri)}">${escapeHtml(f.basename)}</option>`).join('')}
        </select>
    </div>
    ` : ''}

    <div class="rec-grid">
        ${recommendations.map(rec => {
            const type = rec.title.includes(':') ? rec.title.split(':')[0].trim() : rec.title;
            const originalCount = (rec.affectedItems && rec.affectedItems.length) || (rec.affectedFiles && rec.affectedFiles.length) || 1;
            return `
            <div class="premium-card rec-card" data-type="${escapeHtml(type)}">
                <div class="rec-header">
                    <h3 class="rec-title">${escapeHtml(rec.title)}</h3>
                    <span class="severity-badge severity-${rec.severity}">${rec.severity}</span>
                </div>
                <p class="rec-explanation" data-original-text="${escapeHtml(rec.explanation)}" data-original-count="${originalCount}">${escapeHtml(rec.explanation)}</p>
                <div class="rec-fix">
                    <strong>Suggested Fix:</strong> ${escapeHtml(rec.suggestedFix)}
                    ${rec.id === 'undefined-steps' ? `
                    <div style="margin-top: 12px;">
                        <button type="button" onclick="autoFix('${rec.id}')" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-family: var(--vscode-font-family); font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                            <span style="font-size: 14px;">🛠️</span> Fix all automatically
                        </button>
                    </div>
                    ` : ''}
                </div>
                ${rec.affectedItems && rec.affectedItems.length > 0 ? `
                <div class="rec-affected">
                    <strong>Affected Items:</strong>
                    <details>
                        <summary class="rec-summary">Show all <span class="summary-count">${rec.affectedItems.length}</span> items</summary>
                        ${(() => {
                            const grouped = {};
                            rec.affectedItems.forEach(item => {
                                if (!grouped[item.uri]) grouped[item.uri] = [];
                                grouped[item.uri].push(item);
                            });
                            const fileUris = Object.keys(grouped);
                            return `
                            <div data-visible="10" data-items-list="true" style="margin-top: 12px;">
                                ${fileUris.map((uri, i) => `
                                    <div data-file="${escapeHtml(uri)}" class="filterable-item" style="${i >= 10 ? 'display: none;' : ''} margin-bottom: 12px; background: rgba(128,128,128,0.04); border: 1px solid var(--glass-border); border-radius: 8px; padding: 12px;">
                                        <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                                            <div>
                                                <span style="opacity: 0.8; margin-right: 6px;">📁</span>
                                                <a href="javascript:void(0)" class="file-link" onclick="openFile('${escapeHtml(uri)}', 0)">${escapeHtml(uri.split('/').pop() || uri)}</a>
                                            </div>
                                            <span class="badge" style="background: transparent; border: 1px solid var(--vscode-badge-background); color: var(--vscode-foreground);">${grouped[uri].length} items</span>
                                        </div>
                                        <div class="inner-items-container" data-visible="10" style="padding-left: 28px; display: flex; flex-direction: column; gap: 6px;">
                                            ${grouped[uri].map((item, j) => `
                                                <div class="inner-item" style="display: ${j >= 10 ? 'none' : 'flex'}; gap: 8px; font-size: 0.95em; align-items: flex-start;">
                                                    <span style="color: var(--vscode-descriptionForeground); font-variant-numeric: tabular-nums; opacity: 0.8; min-width: 35px;">L${item.line || 0}</span>
                                                    <span style="flex-grow: 1; font-family: var(--vscode-editor-font-family);">
                                                        ${escapeHtml(item.label)}
                                                        ${item.description ? `<div style="font-size: 0.9em; opacity: 0.8; margin-top: 6px; margin-bottom: 4px; padding-left: 8px; border-left: 2px solid var(--vscode-focusBorder); line-height: 1.4;">${escapeHtml(item.description).replace(/\\n/g, '<br>')}
                                                            ${item.subItems && item.subItems.length > 0 ? `
                                                                <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
                                                                    ${item.subItems.map(sub => `
                                                                        <div style="display: flex; gap: 8px; font-size: 1em; align-items: center; width: 100%;">
                                                                            <span style="color: var(--vscode-descriptionForeground); font-variant-numeric: tabular-nums; opacity: 0.8; min-width: 30px;">L${sub.line || 0}</span>
                                                                            <span style="flex-grow: 1; font-family: var(--vscode-editor-font-family);">${escapeHtml(sub.label)} <span style="opacity: 0.6; font-size: 0.9em;">(${escapeHtml(sub.uri.split('/').pop() || sub.uri)})</span></span>
                                                                            <a href="javascript:void(0)" style="opacity: 0.5; text-decoration: none; padding-left: 10px; font-size: 1.25em;" onclick="openFile('${escapeHtml(sub.uri)}', ${sub.line || 0})" title="Go to line">↗</a>
                                                                        </div>
                                                                    `).join('')}
                                                                </div>
                                                            ` : ''}
                                                        </div>` : ''}
                                                    </span>
                                                    ${rec.id === 'undefined-steps' ? `<a href="javascript:void(0)" style="opacity: 0.8; text-decoration: none; padding-left: 10px; font-size: 1.25em;" onclick="autoFix('${rec.id}', '${escapeHtml(uri)}', ${item.line || 0})" title="Fix this step automatically">🛠️</a>` : ''}
                                                    <a href="javascript:void(0)" style="opacity: 0.7; text-decoration: none; padding-left: 10px; font-size: 1.25em;" onclick="openFile('${escapeHtml(uri)}', ${item.line || 0})" title="Go to line">↗</a>
                                                </div>
                                            `).join('')}
                                        </div>
                                        ${grouped[uri].length > 10 ? `<button type="button" class="load-more-inner-btn" onclick="showMoreInnerItems(this)" style="margin-top: 8px; margin-left: 28px; background: transparent; border: 1px solid var(--glass-border); color: var(--vscode-textLink-foreground); cursor: pointer; padding: 4px 10px; border-radius: 12px; font-size: 0.85em; font-weight: 500;">Show more (${grouped[uri].length - 10} hidden)</button>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                            ${fileUris.length > 10 ? `<button class="load-more-btn" onclick="showMoreItems(this)">Show more (${fileUris.length - 10} files remaining)</button>` : ''}
                            `;
                        })()}
                    </details>
                </div>` : rec.affectedFiles && rec.affectedFiles.length > 0 ? `
                <div class="rec-affected">
                    <strong>Affected Files:</strong>
                    <details>
                        <summary class="rec-summary">Show all <span class="summary-count">${rec.affectedFiles.length}</span> files</summary>
                        <ul data-visible="10" data-files-list="true">
                            ${rec.affectedFiles.map((uri, i) => `
                                <li data-file="${escapeHtml(uri)}" class="filterable-item" style="${i >= 10 ? 'display: none;' : ''}"><a href="javascript:void(0)" class="file-link" onclick="openFile('${escapeHtml(uri)}', 0)">${escapeHtml(uri.split('/').pop() || uri)}</a></li>
                            `).join('')}
                        </ul>
                        ${rec.affectedFiles.length > 10 ? `<button class="load-more-btn" onclick="showMoreItems(this)">Show more (${rec.affectedFiles.length - 10} remaining)</button>` : ''}
                    </details>
                </div>` : ''}
            </div>
        `;
        }).join('')}
    </div>
    ` : `
    <h3 id="antipatterns-header" style="margin-bottom: 20px; font-weight: 500;">Actionable Anti-patterns</h3>
    <div class="rec-grid">
        <div class="rec-card" style="text-align: center; grid-column: 1 / -1; padding: 40px;">
            <span style="font-size: 32px; display: block; margin-bottom: 16px;">🎉</span>
            <h3 style="margin: 0;">Amazing!</h3>
            <p style="color: var(--vscode-descriptionForeground);">Your workspace is perfectly healthy. No anti-patterns found.</p>
        </div>
    </div>
    `}

    <div class="hide-on-search">
    <h2 class="section-title">Technical Debt & Quality</h2>
    <p style="color: var(--vscode-descriptionForeground); margin-bottom: 24px; opacity: 0; animation: fadeInUp 0.6s ease-out forwards 0.4s;">Detailed metrics on potential issues and codebase complexity.</p>

    <h2 class="section-title">Architecture & Size</h2>
    <div class="metrics-grid">
        <div class="metric-panel">
            <div class="metric-header">
                <div class="icon-title"><span>🐘</span> <span>Largest Scenarios</span></div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="badge">Top 10</span>
                    <span class="chevron-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
                </div>
            </div>
            <div class="metric-body">
                ${(() => {
                    if (!metrics.largestScenarios.length) return '<div class="empty-state"><span class="emoji">🎉</span><span>No scenarios found.</span></div>';
                    const max = Math.max(...metrics.largestScenarios.map(s => s.size), 1);
                    return metrics.largestScenarios.map((s, i) => {
                        const rank = `${i + 1}.`;
                        return `
                        <div class="leaderboard-item">
                            <div class="leaderboard-rank">${rank}</div>
                            <div class="leaderboard-content">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px;">
                                    <span style="flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
                                        ${renderLink(s.uri, s.line, s.name || 'Unnamed')}
                                    </span>
                                    <span class="badge" style="flex-shrink: 0; white-space: nowrap; background: transparent; color: var(--vscode-foreground); border: none; padding: 0;">${s.size} steps</span>
                                </div>
                                <div class="leaderboard-bar" style="width: ${(s.size / max) * 100}%;"></div>
                            </div>
                        </div>`;
                    }).join('');
                })()}
            </div>
        </div>

        <div class="metric-panel">
            <div class="metric-header">
                <div class="icon-title"><span>📚</span> <span>Largest Features</span></div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="badge">Top 10</span>
                    <span class="chevron-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
                </div>
            </div>
            <div class="metric-body">
                ${(() => {
                    if (!metrics.largestFeatures.length) return '<div class="empty-state"><span class="emoji">🎉</span><span>No features found.</span></div>';
                    const max = Math.max(...metrics.largestFeatures.map(f => f.size), 1);
                    return metrics.largestFeatures.map((f, i) => {
                        const rank = `${i + 1}.`;
                        return `
                        <div class="leaderboard-item">
                            <div class="leaderboard-rank">${rank}</div>
                            <div class="leaderboard-content">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px;">
                                    <span style="flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
                                        ${renderLink(f.uri, 0, f.name || 'Unnamed')}
                                    </span>
                                    <span class="badge" style="flex-shrink: 0; white-space: nowrap; background: transparent; color: var(--vscode-foreground); border: none; padding: 0;">${f.size} steps</span>
                                </div>
                                <div class="leaderboard-bar" style="width: ${(f.size / max) * 100}%;"></div>
                            </div>
                        </div>`;
                    }).join('');
                })()}
            </div>
        </div>

        <div class="metric-panel">
            <div class="metric-header">
                <div class="icon-title"><span>🏷️</span> <span>Top Tags</span></div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="badge">Top 10</span>
                    <span class="chevron-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
                </div>
            </div>
            <div class="metric-body">
                <div id="tags-leaderboard-container">
                    <!-- Rendered by JS -->
                </div>
            </div>
        </div>
    </div>

    <h2 class="section-title">Overview Stats</h2>
    <div class="bento-grid">
        <div class="bento-card">
            <div class="bento-value">${metrics.totalFeatures}</div>
            <div class="bento-label">Features</div>
            <div class="bento-icon">📚</div>
        </div>
        <div class="bento-card">
            <div class="bento-value">${metrics.totalScenarios}</div>
            <div class="bento-label">Scenarios</div>
            <div class="bento-icon">🎬</div>
        </div>
        <div class="bento-card">
            <div class="bento-value">${metrics.totalSteps}</div>
            <div class="bento-label">Total Steps</div>
            <div class="bento-icon">👣</div>
        </div>
        <div class="bento-card">
            <div class="bento-value">${metrics.stepAnalysis.totalStepDefs}</div>
            <div class="bento-label">Step Definitions</div>
            <div class="bento-icon">🧩</div>
        </div>
        <div class="bento-card">
            <div class="bento-value">${metrics.averageScenarioLength.toFixed(1)}</div>
            <div class="bento-label">Avg. Scenario Length</div>
            <div class="bento-icon">📏</div>
        </div>
        <div class="bento-card">
            <div class="bento-value">${metrics.totalTags}</div>
            <div class="bento-label">Tags Used</div>
            <div class="bento-icon">🏷️</div>
        </div>
    </div>



    </div>
    </div> <!-- end second hide-on-search -->

    <script>
        const snapshots = ${JSON.stringify(snapshots)};
        const recs = ${JSON.stringify(recommendations)};
        const metrics = ${JSON.stringify(metrics)};
        
        const header = document.getElementById('antipatterns-header');
        if (header) header.innerHTML = \`Actionable Anti-patterns (\${recs.length})\`;
        
        const style = getComputedStyle(document.body);
        const textColor = style.getPropertyValue('--vscode-foreground') || '#cccccc';
        const gridColor = style.getPropertyValue('--vscode-editorWidget-border') || 'rgba(128,128,128,0.2)';

        Chart.defaults.color = textColor;
        Chart.defaults.font.family = style.getPropertyValue('--apple-font') || 'sans-serif';
        


        // 3. Historical Trends (if available)
        const trendsCtx = document.getElementById('trendsChart')?.getContext('2d');
        if (trendsCtx && snapshots.length > 1) {
            const labels = snapshots.map(s => {
                const d = new Date(s.timestamp);
                return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            });
            const pointStyles = snapshots.map((s, i) => i === 0 ? 'circle' : (s.metricsAlgorithmVersion !== snapshots[i-1].metricsAlgorithmVersion ? 'rectRot' : 'circle'));
            const pointRadii = snapshots.map((s, i) => i === 0 ? 3 : (s.metricsAlgorithmVersion !== snapshots[i-1].metricsAlgorithmVersion ? 6 : 3));
            new Chart(trendsCtx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Health', data: snapshots.map(s => s.health), borderColor: '#30d158', backgroundColor: 'rgba(48, 209, 88, 0.1)', fill: true, pointStyle: pointStyles, pointRadius: pointRadii, borderWidth: 3, tension: 0.4 },
                        { label: 'Maintainability', data: snapshots.map(s => s.maintainability), borderColor: '#ff9f0a', backgroundColor: 'rgba(255, 159, 10, 0.1)', fill: true, pointStyle: pointStyles, pointRadius: pointRadii, borderWidth: 3, tension: 0.4 },
                        { label: 'Complexity', data: snapshots.map(s => s.complexity), borderColor: '#ff453a', backgroundColor: 'rgba(255, 69, 58, 0.1)', fill: true, pointStyle: pointStyles, pointRadius: pointRadii, borderWidth: 3, tension: 0.4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { grid: { color: gridColor, display: false } },
                        y: { min: 0, max: 100, grid: { color: gridColor, borderDash: [5, 5] } }
                    },
                    plugins: { legend: { labels: { color: textColor, usePointStyle: true, padding: 20, font: { weight: '500' } } } },
                    interaction: { mode: 'index', intersect: false }
                }
            });
        }
        
        document.querySelectorAll('.metric-header').forEach(el => {
            el.addEventListener('click', function() {
                const panel = this.closest('.metric-panel');
                if (panel) {
                    panel.classList.toggle('expanded');
                    if (panel.classList.contains('expanded')) {
                        setTimeout(() => {
                            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }, 400); // Wait for the 0.4s CSS transition
                    }
                }
            });
        });

        document.querySelectorAll('details').forEach(el => {
            el.addEventListener('toggle', function() {
                if (this.open) {
                    setTimeout(() => {
                        this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 50);
                }
            });
        });
        
        filterFeatures('');
    </script>
</body>
</html>`;
}
