import * as vscode from 'vscode';
import { StepAnalysisResult, StepAnalyzer } from './stepAnalyzer';
import { WorkspaceGraph } from './graph';
import { SymbolCache } from './cache';
import * as path from 'path';

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
            { enableScripts: true }
        );

        panel.webview.html = getReportHtml(result);
    });
}

function getReportHtml(result: StepAnalysisResult): string {
    const escapeHtml = (unsafe: string) => unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    let unusedHtml = '';
    if (result.unusedSteps.length === 0) {
        unusedHtml = '<p>No unused step definitions found.</p>';
    } else {
        unusedHtml = '<ul>' + result.unusedSteps.map(u => {
            const file = path.basename(vscode.Uri.parse(u.stepDef.uri).fsPath);
            return `<li><code>${escapeHtml(u.stepDef.matcherType)} "${escapeHtml(u.stepDef.pattern)}"</code> in <b>${escapeHtml(file)}</b> line ${u.stepDef.line + 1}</li>`;
        }).join('') + '</ul>';
    }

    let duplicatedHtml = '';
    if (result.duplicatedSteps.length === 0) {
        duplicatedHtml = '<p>No duplicated step definitions found.</p>';
    } else {
        duplicatedHtml = '<ul>' + result.duplicatedSteps.map(d => {
            let items = d.stepDefs.map(def => {
                const file = path.basename(vscode.Uri.parse(def.uri).fsPath);
                return `<li><b>${escapeHtml(file)}</b> line ${def.line + 1}</li>`;
            }).join('');
            return `<li><code>${escapeHtml(d.matcherType)} "${escapeHtml(d.pattern)}"</code> implemented in: <ul>${items}</ul></li>`;
        }).join('') + '</ul>';
    }

    let ambiguousHtml = '';
    if (result.ambiguousSteps.length === 0) {
        ambiguousHtml = '<p>No ambiguous step usages found.</p>';
    } else {
        ambiguousHtml = '<ul>' + result.ambiguousSteps.map(a => {
            const file = path.basename(vscode.Uri.parse(a.step.uri).fsPath);
            let defs = a.matchingDefs.map(def => {
                const defFile = path.basename(vscode.Uri.parse(def.uri).fsPath);
                return `<li><code>${escapeHtml(def.matcherType)} "${escapeHtml(def.pattern)}"</code> in <b>${escapeHtml(defFile)}</b> line ${def.line + 1}</li>`;
            }).join('');
            return `<li>Step <code>${escapeHtml(a.step.keyword)} ${escapeHtml(a.step.text)}</code> in <b>${escapeHtml(file)}</b> line ${a.step.line + 1} matches: <ul>${defs}</ul></li>`;
        }).join('') + '</ul>';
    }

    let suspiciousHtml = '';
    if (result.suspiciousSimilarities.length === 0) {
        suspiciousHtml = '<p>No suspiciously similar step definitions found.</p>';
    } else {
        suspiciousHtml = '<ul>' + result.suspiciousSimilarities.map(s => {
            const file1 = path.basename(vscode.Uri.parse(s.stepDef1.uri).fsPath);
            const file2 = path.basename(vscode.Uri.parse(s.stepDef2.uri).fsPath);
            return `<li>Similarity: <b>${Math.round(s.similarity * 100)}%</b><ul>
                <li><code>${escapeHtml(s.stepDef1.matcherType)} "${escapeHtml(s.stepDef1.pattern)}"</code> in <b>${escapeHtml(file1)}</b> line ${s.stepDef1.line + 1}</li>
                <li><code>${escapeHtml(s.stepDef2.matcherType)} "${escapeHtml(s.stepDef2.pattern)}"</code> in <b>${escapeHtml(file2)}</b> line ${s.stepDef2.line + 1}</li>
            </ul></li>`;
        }).join('') + '</ul>';
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Step Definition Analysis</title>
    <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background-color: var(--vscode-editor-background); padding: 20px; }
        h1, h2, h3 { color: var(--vscode-textLink-foreground); }
        ul { list-style-type: none; padding-left: 0; }
        li { margin-bottom: 8px; }
        li ul { list-style-type: disc; padding-left: 20px; margin-top: 4px; }
        code { background-color: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 4px; font-family: var(--vscode-editor-font-family); }
        .summary-box { background-color: var(--vscode-editorWidget-background); padding: 15px; border-radius: 8px; border: 1px solid var(--vscode-widget-border); margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
    </style>
</head>
<body>
    <h1>Step Definition Analysis Report</h1>
    
    <div class="summary-box">
        <h3>Summary</h3>
        <ul>
            <li>Total Step Definitions Analyzed: <b>${result.totalStepDefs}</b></li>
            <li>Unused Steps: <b style="color: ${result.unusedSteps.length > 0 ? 'var(--vscode-charts-yellow)' : 'inherit'}">${result.unusedSteps.length}</b></li>
            <li>Duplicated Implementations: <b style="color: ${result.duplicatedSteps.length > 0 ? 'var(--vscode-charts-red)' : 'inherit'}">${result.duplicatedSteps.length}</b></li>
            <li>Ambiguous Step Usages: <b style="color: ${result.ambiguousSteps.length > 0 ? 'var(--vscode-charts-red)' : 'inherit'}">${result.ambiguousSteps.length}</b></li>
            <li>Suspicious Similarities: <b style="color: ${result.suspiciousSimilarities.length > 0 ? 'var(--vscode-charts-yellow)' : 'inherit'}">${result.suspiciousSimilarities.length}</b></li>
        </ul>
    </div>

    <div class="section">
        <h2>Unused Steps</h2>
        <p><i>These step definitions are not referenced by any parsed feature file in the workspace. Consider removing them to keep the codebase clean.</i></p>
        ${unusedHtml}
    </div>

    <div class="section">
        <h2>Duplicated Implementations</h2>
        <p><i>These step definitions have the exact same matcher type and pattern, which will cause a runtime AmbiguousStep error in Behave.</i></p>
        ${duplicatedHtml}
    </div>

    <div class="section">
        <h2>Ambiguous Step Usages</h2>
        <p><i>These steps in feature files match multiple step definitions. Behave will fail to execute them.</i></p>
        ${ambiguousHtml}
    </div>

    <div class="section">
        <h2>Suspicious Similarities</h2>
        <p><i>These step definitions have very similar patterns (>85% similarity). They might be duplicates with minor typos or overly generic patterns that could lead to ambiguity.</i></p>
        ${suspiciousHtml}
    </div>
</body>
</html>`;
}
