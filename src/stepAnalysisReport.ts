import * as vscode from 'vscode';
import { StepAnalysisResult, StepAnalyzer } from './stepAnalyzer';
import { WorkspaceGraph } from './graph';
import { SymbolCache } from './cache';
import * as path from 'path';
import { StepDefNode } from './graph';

export async function showStepAnalysisReport(graph: WorkspaceGraph, symbolCache: SymbolCache) {
    const analyzer = new StepAnalyzer(graph, symbolCache);
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Gherkin PowerTools",
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Analyzing step definitions...' });
        await graph.initialize();
        const result = await analyzer.analyze();

        const panel = vscode.window.createWebviewPanel(
            'gherkinStepAnalysis',
            'Step Definition Analysis',
            vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.webview.html = getReportHtml(result);

        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'openFile':
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
                        return;
                }
            }
        );
    });
}

export function getReportHtml(result: StepAnalysisResult): string {
    const escapeHtml = (unsafe: string) => unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Group unused steps by file
    const unusedByFile = new Map<string, typeof result.unusedSteps>();
    for (const u of result.unusedSteps) {
        if (!unusedByFile.has(u.stepDef.uri)) {
            unusedByFile.set(u.stepDef.uri, []);
        }
        unusedByFile.get(u.stepDef.uri)!.push(u);
    }

    const renderLink = (uri: string, line: number, text: string) => {
        return `<a href="#" class="file-link" onclick="openFile('${escapeHtml(uri)}', ${line})">${escapeHtml(text)}</a>`;
    };

    const renderStepDef = (def: StepDefNode) => {
        const file = path.basename(vscode.Uri.parse(def.uri).fsPath);
        return `<div class="step-def">
            <span class="badge badge-keyword">${escapeHtml(def.matcherType)}</span>
            <span class="regex-pattern">${escapeHtml(def.pattern)}</span>
            <span class="file-ref">in ${renderLink(def.uri, def.line, file + ':' + (def.line + 1))}</span>
        </div>`;
    };

    let unusedHtml = '';
    if (unusedByFile.size === 0) {
        unusedHtml = '<div class="empty-state">🎉 No unused step definitions found! Your codebase is clean.</div>';
    } else {
        for (const [uri, steps] of unusedByFile.entries()) {
            const fileName = path.basename(vscode.Uri.parse(uri).fsPath);
            unusedHtml += `<div class="file-group">
                <div class="file-group-header">
                    <span class="codicon codicon-file-code"></span>
                    ${renderLink(uri, 0, fileName)}
                    <span class="badge badge-count">${steps.length} steps</span>
                </div>
                <div class="file-group-content">
                    ${steps.map(u => renderStepDef(u.stepDef)).join('')}
                </div>
            </div>`;
        }
    }

    let duplicatedHtml = '';
    if (result.duplicatedSteps.length === 0) {
        duplicatedHtml = '<div class="empty-state">🎉 No duplicated step definitions found!</div>';
    } else {
        duplicatedHtml = '<div class="card-list">' + result.duplicatedSteps.map(d => {
            return `<div class="card">
                <div class="card-header">
                    <span class="badge badge-keyword">${escapeHtml(d.matcherType)}</span>
                    <span class="regex-pattern">${escapeHtml(d.pattern)}</span>
                </div>
                <div class="card-body">
                    <div class="warning-text">Implemented in multiple locations:</div>
                    ${d.stepDefs.map(def => renderStepDef(def)).join('')}
                </div>
            </div>`;
        }).join('') + '</div>';
    }

    let ambiguousHtml = '';
    if (result.ambiguousSteps.length === 0) {
        ambiguousHtml = '<div class="empty-state">🎉 No ambiguous step usages found in feature files!</div>';
    } else {
        ambiguousHtml = '<div class="card-list">' + result.ambiguousSteps.map(a => {
            const file = path.basename(vscode.Uri.parse(a.step.uri).fsPath);
            return `<div class="card">
                <div class="card-header">
                    <span class="badge badge-keyword">${escapeHtml(a.step.keyword.trim())}</span>
                    <span class="regex-pattern">${escapeHtml(a.step.text)}</span>
                    <span class="file-ref">in ${renderLink(a.step.uri, a.step.line, file + ':' + (a.step.line + 1))}</span>
                </div>
                <div class="card-body">
                    <div class="error-text">Matches ${a.matchingDefs.length} definitions:</div>
                    ${a.matchingDefs.map(def => renderStepDef(def)).join('')}
                </div>
            </div>`;
        }).join('') + '</div>';
    }

    let suspiciousHtml = '';
    if (result.suspiciousSimilarities.length === 0) {
        suspiciousHtml = '<div class="empty-state">🎉 No suspiciously similar step definitions found!</div>';
    } else {
        suspiciousHtml = '<div class="card-list">' + result.suspiciousSimilarities.map(s => {
            const percent = Math.round(s.similarity * 100);
            const badgeClass = percent > 95 ? 'badge-error' : 'badge-warning';
            return `<div class="card">
                <div class="card-header">
                    <span class="badge ${badgeClass}">${percent}% Match</span>
                    Possible duplicate or typo
                </div>
                <div class="card-body">
                    ${renderStepDef(s.stepDef1)}
                    ${renderStepDef(s.stepDef2)}
                </div>
            </div>`;
        }).join('') + '</div>';
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Step Definition Analysis</title>
    <style>
        :root {
            --radius: 6px;
            --spacing-sm: 8px;
            --spacing-md: 16px;
            --spacing-lg: 24px;
        }
        body { 
            font-family: var(--vscode-font-family); 
            color: var(--vscode-foreground); 
            background-color: var(--vscode-editor-background); 
            padding: var(--spacing-lg); 
            line-height: 1.5;
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 { color: var(--vscode-textLink-foreground); margin-bottom: var(--spacing-lg); border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: var(--spacing-sm); }
        h2 { color: var(--vscode-editor-foreground); margin-top: var(--spacing-lg); margin-bottom: var(--spacing-md); }
        
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: var(--spacing-md);
            margin-bottom: var(--spacing-lg);
        }
        
        .metric-card {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: var(--radius);
            padding: var(--spacing-md);
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .metric-card:hover {
            transform: translateY(-2px);
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: var(--spacing-sm);
        }
        .metric-label {
            font-size: 0.9em;
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .value-red { color: var(--vscode-charts-red); }
        .value-yellow { color: var(--vscode-charts-yellow); }
        .value-green { color: var(--vscode-charts-green); }

        .section { margin-bottom: 40px; }
        .section-desc { opacity: 0.8; margin-bottom: var(--spacing-md); }

        .file-group {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: var(--radius);
            margin-bottom: var(--spacing-md);
            overflow: hidden;
        }
        .file-group-header {
            background-color: var(--vscode-editorGroupHeader-tabsBackground, rgba(0,0,0,0.1));
            padding: var(--spacing-sm) var(--spacing-md);
            border-bottom: 1px solid var(--vscode-widget-border);
            display: flex;
            align-items: center;
            gap: var(--spacing-sm);
            font-weight: 600;
        }
        .file-group-content {
            padding: var(--spacing-md);
            display: flex;
            flex-direction: column;
            gap: var(--spacing-sm);
        }

        .card-list {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-md);
        }
        .card {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: var(--radius);
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .card-header {
            background-color: var(--vscode-editorGroupHeader-tabsBackground, rgba(0,0,0,0.1));
            padding: var(--spacing-sm) var(--spacing-md);
            border-bottom: 1px solid var(--vscode-widget-border);
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: var(--spacing-sm);
        }
        .card-body {
            padding: var(--spacing-md);
            display: flex;
            flex-direction: column;
            gap: var(--spacing-sm);
        }

        .step-def {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: var(--spacing-sm);
            padding: var(--spacing-sm);
            background-color: var(--vscode-editor-background);
            border-radius: 4px;
            border: 1px solid var(--vscode-widget-border);
        }

        .badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 600;
        }
        .badge-keyword { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); }
        .badge-count { background-color: var(--vscode-badge-background); color: var(--vscode-badge-foreground); margin-left: auto; }
        .badge-warning { background-color: var(--vscode-charts-yellow); color: var(--vscode-editor-background); }
        .badge-error { background-color: var(--vscode-charts-red); color: var(--vscode-editor-background); }

        .regex-pattern {
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-symbolIcon-stringForeground);
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 4px;
            word-break: break-all;
        }

        .file-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
        }
        .file-link:hover {
            text-decoration: underline;
        }
        .file-ref {
            opacity: 0.7;
            font-size: 0.9em;
            margin-left: auto;
        }

        .empty-state {
            padding: var(--spacing-lg);
            text-align: center;
            background-color: var(--vscode-editorWidget-background);
            border-radius: var(--radius);
            border: 1px dashed var(--vscode-widget-border);
            color: var(--vscode-charts-green);
            font-weight: 600;
        }
        
        .warning-text { color: var(--vscode-editorWarning-foreground); font-weight: 600; margin-bottom: 4px; }
        .error-text { color: var(--vscode-editorError-foreground); font-weight: 600; margin-bottom: 4px; }

    </style>
</head>
<body>
    <h1>Step Definition Analysis</h1>
    
    <div class="dashboard-grid">
        <div class="metric-card">
            <div class="metric-value">${result.totalStepDefs}</div>
            <div class="metric-label">Total Step Defs</div>
        </div>
        <div class="metric-card">
            <div class="metric-value ${result.unusedSteps.length > 0 ? 'value-yellow' : 'value-green'}">${result.unusedSteps.length}</div>
            <div class="metric-label">Unused</div>
        </div>
        <div class="metric-card">
            <div class="metric-value ${result.duplicatedSteps.length > 0 ? 'value-red' : 'value-green'}">${result.duplicatedSteps.length}</div>
            <div class="metric-label">Duplicates</div>
        </div>
        <div class="metric-card">
            <div class="metric-value ${result.ambiguousSteps.length > 0 ? 'value-red' : 'value-green'}">${result.ambiguousSteps.length}</div>
            <div class="metric-label">Ambiguous</div>
        </div>
        <div class="metric-card">
            <div class="metric-value ${result.suspiciousSimilarities.length > 0 ? 'value-yellow' : 'value-green'}">${result.suspiciousSimilarities.length}</div>
            <div class="metric-label">Suspicious</div>
        </div>
    </div>

    <div class="section">
        <h2>Unused Steps</h2>
        <div class="section-desc">These step definitions are not referenced by any parsed feature file. Consider removing them to keep the codebase clean.</div>
        ${unusedHtml}
    </div>

    <div class="section">
        <h2>Duplicated Implementations</h2>
        <div class="section-desc">These step definitions have the exact same matcher type and pattern, which causes a runtime AmbiguousStep error in Behave.</div>
        ${duplicatedHtml}
    </div>

    <div class="section">
        <h2>Ambiguous Step Usages</h2>
        <div class="section-desc">These steps in feature files match multiple step definitions. Behave will fail to execute them.</div>
        ${ambiguousHtml}
    </div>

    <div class="section">
        <h2>Suspicious Similarities</h2>
        <div class="section-desc">These step definitions have very similar patterns (>85% similarity). They might be duplicates with minor typos or overly generic patterns.</div>
        ${suspiciousHtml}
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        function openFile(uri, line) {
            vscode.postMessage({
                command: 'openFile',
                uri: uri,
                line: line
            });
        }
    </script>
</body>
</html>`;
}
