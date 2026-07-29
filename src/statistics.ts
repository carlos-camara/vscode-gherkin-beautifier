import * as vscode from 'vscode';
import { astRepository } from './ast';
import type { Tag, Step, Background, Scenario, Rule } from '@cucumber/messages';

export function escapeHtml(unsafe: string) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export interface GherkinStats {
    totalFiles: number;
    totalFeatures: number;
    totalRules: number;
    totalScenarios: number;
    totalScenarioOutlines: number;
    totalBackgrounds: number;
    totalTags: number;
    totalSteps: number;
    totalGiven: number;
    totalWhen: number;
    totalThen: number;
    totalAnd: number;
    totalBut: number;
    totalExampleRows: number;
    totalDataTableRows: number;
    totalComments: number;
    totalLines: number;
    totalEmptyLines: number;
    tagFrequencies: [string, number][];
    
    uiSteps: number;
    apiSteps: number;
    dbSteps: number;
    uniqueStepsCount: number;
    topRepeatedSteps: [string, number][];

    totalWordsInSteps: number;
    longestScenarioName: string;
    maxStepsInScenario: number;
}

export async function showStatisticsDashboard(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'gherkinStatistics',
        'Gherkin Statistics',
        vscode.ViewColumn.One,
        { enableScripts: false }
    );

    panel.webview.html = getLoadingHtml();

    try {
        const stats = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Calculating Gherkin Statistics",
            cancellable: true
        }, async (progress, token) => {
            return calculateStatistics(progress, token);
        });

        if (!stats) {
            panel.dispose();
            return;
        }

        const version = context.extension.packageJSON?.version || '1.6.0';
        panel.webview.html = getDashboardHtml(stats, version);
    } catch (error) {
        panel.webview.html = getErrorHtml();
    }
}

export async function calculateStatistics(
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken
): Promise<GherkinStats | undefined> {
    const files = await vscode.workspace.findFiles('**/*.feature', '**/node_modules/**');
    
    const stats: GherkinStats = {
        totalFiles: 0,
        totalFeatures: 0,
        totalRules: 0,
        totalScenarios: 0,
        totalScenarioOutlines: 0,
        totalBackgrounds: 0,
        totalTags: 0,
        totalSteps: 0,
        totalGiven: 0,
        totalWhen: 0,
        totalThen: 0,
        totalAnd: 0,
        totalBut: 0,
        totalExampleRows: 0,
        totalDataTableRows: 0,
        totalComments: 0,
        totalLines: 0,
        totalEmptyLines: 0,
        tagFrequencies: [],
        uiSteps: 0,
        apiSteps: 0,
        dbSteps: 0,
        uniqueStepsCount: 0,
        topRepeatedSteps: [],
        totalWordsInSteps: 0,
        longestScenarioName: "N/A",
        maxStepsInScenario: 0
    };

    const uiRegex = /click|button|page|browser|url|navigate/i;
    const apiRegex = /api|request|response|status code|json|endpoint|bearer/i;
    const dbRegex = /database|table|record|query|sql/i;

    const processedUris = new Set<string>();
    const tagMap = new Map<string, number>();
    const stepMap = new Map<string, number>();

    const openDocs = vscode.workspace.textDocuments.filter(doc => doc.languageId === 'feature' || doc.languageId === 'gherkin' || doc.fileName.endsWith('.feature'));
    
    let fileCount = 0;

    const processFile = async (content: string) => {
        if (token?.isCancellationRequested) return;

        stats.totalFiles++;
        const lines = content.split(/\r?\n/);
        stats.totalLines += lines.length;
        
        for (const line of lines) {
            if (/^\s*$/.test(line)) stats.totalEmptyLines++;
            if (/^\s*#/.test(line)) stats.totalComments++;
        }

        const { document: doc } = await astRepository.getAST({ uri, version: 0, getText: () => content });
        if (!doc || !doc.feature) return;

        stats.totalFeatures++;

        const processTags = (tags: readonly Tag[] | undefined) => {
            if (!tags) return;
            stats.totalTags += tags.length;
            for (const t of tags) {
                tagMap.set(t.name, (tagMap.get(t.name) || 0) + 1);
            }
        };

        const processSteps = (steps: readonly Step[] | undefined, scenarioName: string) => {
            if (!steps) return;
            let currentScenarioSteps = 0;

            for (const step of steps) {
                stats.totalSteps++;
                currentScenarioSteps++;
                
                const keywordText = (step.keyword || "").trim().toLowerCase();
                
                if (step.keywordType === 'Context') { stats.totalGiven++; }
                else if (step.keywordType === 'Action') { stats.totalWhen++; }
                else if (step.keywordType === 'Outcome') { stats.totalThen++; }
                else if (step.keywordType === 'Conjunction') {
                    if (keywordText === 'but' || keywordText === 'pero' || keywordText === 'mais' || keywordText === 'aber') {
                        stats.totalBut++;
                    } else {
                        stats.totalAnd++;
                    }
                } else {
                    if (keywordText === 'given' || keywordText === 'dado') stats.totalGiven++;
                    else if (keywordText === 'when' || keywordText === 'cuando') stats.totalWhen++;
                    else if (keywordText === 'then' || keywordText === 'entonces') stats.totalThen++;
                    else if (keywordText === 'but' || keywordText === 'pero') stats.totalBut++;
                    else stats.totalAnd++;
                }

                if (step.dataTable) {
                    stats.totalDataTableRows += step.dataTable?.rows?.length || 0;
                }

                const stepText = (step.text || "").trim().toLowerCase();
                if (stepText) {
                    stepMap.set(stepText, (stepMap.get(stepText) || 0) + 1);
                    stats.totalWordsInSteps += stepText.split(/\s+/).length;

                    if (uiRegex.test(stepText)) stats.uiSteps++;
                    if (apiRegex.test(stepText)) stats.apiSteps++;
                    if (dbRegex.test(stepText)) stats.dbSteps++;
                }
            }

            if (currentScenarioSteps > stats.maxStepsInScenario) {
                stats.maxStepsInScenario = currentScenarioSteps;
                stats.longestScenarioName = scenarioName;
            }
        };

        const processBackground = (bg: Background | undefined) => {
            if (!bg) return;
            stats.totalBackgrounds++;
            processSteps(bg.steps, "Background");
        };

        const processScenario = (sc: Scenario | undefined) => {
            if (!sc) return;
            processTags(sc.tags);
            if (sc.examples && sc.examples.length > 0) {
                stats.totalScenarioOutlines++;
                for (const ex of sc.examples) {
                    processTags(ex.tags);
                    if (ex.tableBody) {
                        stats.totalExampleRows += ex.tableBody.length;
                    }
                }
            } else {
                stats.totalScenarios++;
            }
            processSteps(sc.steps, sc.name || "Unnamed Scenario");
        };

        const processRule = (rule: Rule | undefined) => {
            if (!rule) return;
            stats.totalRules++;
            processTags(rule.tags);
            if (rule.children) {
                for (const rc of rule.children) {
                    if (rc.background) processBackground(rc.background);
                    if (rc.scenario) processScenario(rc.scenario);
                }
            }
        };

        processTags(doc.feature.tags);
        if (doc.feature.children) {
            for (const child of doc.feature.children) {
                if (child.background) processBackground(child.background);
                if (child.scenario) processScenario(child.scenario);
                if (child.rule) processRule(child.rule);
            }
        }
    };

    for (const doc of openDocs) {
        processedUris.add(doc.uri.toString());
        await processFile(doc.getText());
    }

    for (const file of files) {
        if (token?.isCancellationRequested) return undefined;
        if (!processedUris.has(file.toString())) {
            processedUris.add(file.toString());
            const contentBytes = await vscode.workspace.fs.readFile(file);
            const contentStr = new TextDecoder().decode(contentBytes);
            await processFile(contentStr);
        }
        fileCount++;
        if (progress) {
            progress.report({ increment: 100 / files.length, message: `Parsed ${fileCount}/${files.length}` });
        }
    }

    stats.tagFrequencies = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    stats.uniqueStepsCount = stepMap.size;
    stats.topRepeatedSteps = Array.from(stepMap.entries())
        .filter(entry => entry[1] > 1) 
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
        
    return stats;
}

export function getLoadingHtml() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
            <style>
                body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, rgba(30,144,255,0.1) 0%, rgba(197,134,192,0.1) 100%); }
                .spinner { width: 50px; height: 50px; border: 5px solid var(--vscode-editorWidget-background); border-top: 5px solid #C586C0; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                h1 { color: #C586C0; font-weight: 300; letter-spacing: 2px;}
            </style>
        </head>
        <body><div class="spinner"></div><h1>Analyzing Workspace</h1></body>
        </html>
    `;
}

export function getErrorHtml() {
    return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"></head><body><h1 style="color: var(--vscode-errorForeground);">Error parsing workspace</h1></body></html>`;
}

export function getDashboardHtml(stats: GherkinStats, version: string) {
    const totalScenarioBlocks = stats.totalScenarios + stats.totalScenarioOutlines;
    const avgSteps = totalScenarioBlocks > 0 ? (stats.totalSteps / totalScenarioBlocks) : 0;
    
    let gqs = 50; 
    const docBonus = stats.totalSteps > 0 ? Math.min(20, (stats.totalComments / stats.totalSteps) * 50) : 0;
    const reuseBonus = stats.totalFeatures > 0 ? Math.min(15, (stats.totalBackgrounds / stats.totalFeatures) * 50) : 0;
    const dataBonus = stats.totalScenarios > 0 ? Math.min(15, ((stats.totalExampleRows + stats.totalDataTableRows) / stats.totalScenarios) * 10) : 0;
    const complexityPenalty = avgSteps > 12 ? Math.min(30, (avgSteps - 12) * 2) : 0;
    gqs = Math.max(0, Math.min(100, Math.round(gqs + docBonus + reuseBonus + dataBonus - complexityPenalty)));
    
    let gqsColor = "#4EC9B0"; 
    if (gqs < 75) gqsColor = "#DCDCAA"; 
    if (gqs < 50) gqsColor = "#F44336"; 

    const reusabilityIndex = stats.uniqueStepsCount > 0 ? (stats.totalSteps / stats.uniqueStepsCount).toFixed(1) : "0";

    const totalArchetypeSteps = stats.uiSteps + stats.apiSteps + stats.dbSteps;
    const uiPct = totalArchetypeSteps > 0 ? (stats.uiSteps / totalArchetypeSteps) * 100 : 0;
    const apiPct = totalArchetypeSteps > 0 ? (stats.apiSteps / totalArchetypeSteps) * 100 : 0;
    const dbPct = totalArchetypeSteps > 0 ? (stats.dbSteps / totalArchetypeSteps) * 100 : 0;

    let tagsHtml = stats.tagFrequencies.map((tag) => 
        `<div class="tag-row">
            <div class="tag-name" title="Hover to expand">${escapeHtml(tag[0])}</div>
            <span class="tag-count counter">${tag[1]}</span>
        </div>`
    ).join('');
    if (stats.tagFrequencies.length === 0) tagsHtml = `<div style="text-align: center; opacity: 0.5; padding: 20px;">No tags found</div>`;

    let stepsHtml = stats.topRepeatedSteps.map(step => 
        `<div class="tag-row" style="flex-direction: column; align-items: flex-start; gap: 5px;">
            <div class="expandable-text" title="Hover to expand">"${escapeHtml(step[0])}"</div>
            <div style="font-size: 0.8em; color: var(--accent-secondary); flex-shrink: 0; white-space: nowrap;"><strong class="counter">${step[1]}</strong> uses</div>
        </div>`
    ).join('');
    if (stats.topRepeatedSteps.length === 0) stepsHtml = `<div style="text-align: center; opacity: 0.5; padding: 20px;">No repeated steps</div>`;

    const avgWordsPerStep = stats.totalSteps > 0 ? (stats.totalWordsInSteps / stats.totalSteps).toFixed(1) : "0";
    const dataDensity = stats.totalScenarioOutlines > 0 ? (stats.totalExampleRows / stats.totalScenarioOutlines).toFixed(1) : "0";

    const givenPct = stats.totalSteps > 0 ? (stats.totalGiven / stats.totalSteps) * 100 : 0;
    const whenPct = stats.totalSteps > 0 ? (stats.totalWhen / stats.totalSteps) * 100 : 0;
    const thenPct = stats.totalSteps > 0 ? (stats.totalThen / stats.totalSteps) * 100 : 0;
    const andButPct = stats.totalSteps > 0 ? ((stats.totalAnd + stats.totalBut) / stats.totalSteps) * 100 : 0;

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Project Analytics</title>
            <style>
                :root {
                    --accent-primary: #C586C0; --accent-secondary: #569CD6; --accent-tertiary: #4EC9B0;
                    --accent-warning: #DCDCAA; --accent-danger: #F44336;
                }
                
                @keyframes floatUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulseGlow { 0% { box-shadow: 0 0 20px ${gqsColor}20; } 50% { box-shadow: 0 0 40px ${gqsColor}60; } 100% { box-shadow: 0 0 20px ${gqsColor}20; } }

                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: var(--vscode-editor-foreground);
                    padding: 40px; margin: 0; background-color: var(--vscode-editor-background);
                    background-image: 
                        radial-gradient(at 0% 0%, rgba(197, 134, 192, 0.08) 0px, transparent 50%),
                        radial-gradient(at 100% 0%, rgba(86, 156, 214, 0.08) 0px, transparent 50%);
                    background-attachment: fixed;
                }
                .container { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 30px; }
                
                .header {
                    display: flex; justify-content: space-between; align-items: flex-end;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 20px; animation: floatUp 0.6s ease-out;
                }
                .title-wrapper { display: flex; flex-direction: column; gap: 5px; }
                .title { font-size: 2.8em; font-weight: 900; background: -webkit-linear-gradient(45deg, var(--accent-primary), var(--accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -1px; }
                .subtitle { font-size: 0.9em; text-transform: uppercase; letter-spacing: 4px; color: var(--vscode-descriptionForeground); font-weight: 600; }
                .badge { padding: 6px 16px; background: rgba(86, 156, 214, 0.1); color: var(--accent-secondary); border: 1px solid rgba(86, 156, 214, 0.3); border-radius: 20px; font-weight: 700; font-size: 0.8em; letter-spacing: 2px; white-space: nowrap; flex-shrink: 0;}

                /* Masonry Grid */
                .masonry { display: grid; grid-template-columns: repeat(12, 1fr); gap: 24px; }
                
                .card {
                    background: rgba(var(--vscode-editorWidget-background), 0.6); backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 16px; padding: 25px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column;
                    transition: transform 0.3s, box-shadow 0.3s; animation: floatUp 0.6s ease-out backwards;
                    overflow: hidden; position: relative;
                }
                .card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2); border-color: rgba(255,255,255,0.15); }
                
                .card-title { font-size: 0.85em; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 15px; font-weight: 600; display: flex; justify-content: space-between; align-items: center;}
                .card-value { font-size: 3.2em; font-weight: 800; color: var(--vscode-editor-foreground); line-height: 1.1; }

                /* Span classes */
                .span-3 { grid-column: span 3; }
                .span-4 { grid-column: span 4; }
                .span-5 { grid-column: span 5; }
                .span-6 { grid-column: span 6; }
                .span-8 { grid-column: span 8; }
                .span-12 { grid-column: span 12; }

                /* GQS Premium Card */
                .gqs-card {
                    background: linear-gradient(135deg, rgba(30,30,30,0.8), rgba(20,20,20,0.95));
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    border: 1px solid ${gqsColor}40;
                }
                .gqs-circle {
                    width: 120px; height: 120px; border-radius: 50%;
                    background: conic-gradient(${gqsColor} ${gqs * 3.6}deg, rgba(255,255,255,0.05) 0);
                    display: flex; align-items: center; justify-content: center; position: relative;
                    animation: pulseGlow 4s infinite;
                }
                .gqs-circle::after { content: ""; position: absolute; width: 100px; height: 100px; background: #1a1a1a; border-radius: 50%; }
                .gqs-value { position: relative; z-index: 10; font-size: 2.2em; font-weight: 900; color: ${gqsColor}; text-shadow: 0 0 15px ${gqsColor}80; }

                /* Progress Bars */
                .progress-track { width: 100%; height: 28px; background: rgba(0,0,0,0.2); border-radius: 14px; overflow: hidden; display: flex; box-shadow: inset 0 2px 5px rgba(0,0,0,0.3); margin: 20px 0; }
                
                /* Using pure CSS animation for expanding widths instead of JS */
                @keyframes expandWidth { from { width: 0%; } }
                .progress-segment { height: 100%; animation: expandWidth 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                
                .legend { display: flex; justify-content: space-between; font-size: 0.85em; font-weight: 600; color: var(--vscode-descriptionForeground); }

                /* Reusability & Tags Lists */
                .list-container { display: flex; flex-direction: column; gap: 10px; }
                .tag-row { display: flex; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); transition: background 0.2s; }
                .tag-row:hover { background: rgba(255,255,255,0.05); }
                .tag-name { color: var(--accent-secondary); font-weight: 600; font-size: 0.95em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
                .tag-name:hover { opacity: 0.8; white-space: normal; overflow: visible; word-break: break-word; }
                .tag-count { font-weight: bold; color: var(--vscode-editor-foreground); background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 12px; font-size: 0.75em; flex-shrink: 0; white-space: nowrap; margin-left: 10px; height: fit-content; }

                /* Expandable Text */
                .expandable-text { font-family: monospace; font-size: 0.9em; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; cursor: pointer; transition: background 0.2s; padding: 2px 4px; border-radius: 4px;}
                .expandable-text:hover { background: rgba(255,255,255,0.1); white-space: normal; overflow: visible; word-break: break-word; }

                /* Breakdown Details Grid */
                .breakdown-grid {
                    display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; width: 100%; margin-top: 20px;
                }
                .breakdown-item {
                    background: rgba(255,255,255,0.02); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);
                    display: flex; flex-direction: column; justify-content: space-between; min-width: 0;
                }
                .breakdown-label { font-size: 0.8em; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
                .breakdown-value { font-size: 1.5em; font-weight: 800; color: var(--vscode-editor-foreground); }

            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="title-wrapper">
                        <div class="subtitle">BDD Intelligence Platform</div>
                        <div class="title">Project Analytics</div>
                    </div>
                    <div class="badge">V${escapeHtml(version)}</div>
                </div>

                <div class="masonry">
                    <div class="card span-4 gqs-card" style="animation-delay: 0.1s; padding: 25px 15px;" title="Gherkin Quality Indicator = 50 (Base) + Comments Bonus + Background Reuse Bonus + Data Table Bonus - Complexity Penalty">
                        <div class="gqs-circle" style="margin-bottom: 5px;">
                            <div class="gqs-value counter">${gqs}</div>
                        </div>
                        <div style="margin-top: 15px; font-weight: 800; font-size: 0.85em; color: ${gqsColor}; letter-spacing: 1.5px; text-align: center;">GHERKIN QUALITY<br/>INDICATOR</div>
                    </div>
                    
                    <div class="card span-4" style="animation-delay: 0.15s; background: rgba(0,0,0,0.2); padding: 20px 15px;">
                        <div class="card-title">Score Breakdown</div>
                        <div style="display: flex; flex-direction: column; gap: 15px; font-size: 0.85em; flex: 1; justify-content: center;">
                            <div style="display: flex; justify-content: space-between; align-items: center;" title="(Backgrounds / Features) * 50 (max 15)">
                                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 10px;">BG Reuse</span> 
                                <strong style="color: var(--accent-tertiary); background: rgba(78,201,176,0.1); padding: 2px 6px; border-radius: 6px; flex-shrink: 0; white-space: nowrap;">+${Math.round(reuseBonus)}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;" title="((Example Rows + Data Table Rows) / Scenarios) * 10 (max 15)">
                                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 10px;">Data Density</span> 
                                <strong style="color: var(--accent-tertiary); background: rgba(78,201,176,0.1); padding: 2px 6px; border-radius: 6px; flex-shrink: 0; white-space: nowrap;">+${Math.round(dataBonus)}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;" title="(Comments / Steps) * 50 (max 20)">
                                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 10px;">Documentation</span> 
                                <strong style="color: var(--accent-tertiary); background: rgba(78,201,176,0.1); padding: 2px 6px; border-radius: 6px; flex-shrink: 0; white-space: nowrap;">+${Math.round(docBonus)}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; margin-top: 5px;" title="If avg steps > 12: (Avg Steps - 12) * 2 (max 30)">
                                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 10px;">Complexity Penalty</span> 
                                <strong style="color: var(--accent-danger); background: rgba(244,67,54,0.1); padding: 2px 6px; border-radius: 6px; flex-shrink: 0; white-space: nowrap;">-${Math.round(complexityPenalty)}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="card span-4" style="animation-delay: 0.2s; background: linear-gradient(135deg, rgba(86,156,214,0.15), transparent);">
                        <div class="card-title">Executable Tests</div>
                        <div class="card-value counter" style="color: var(--accent-secondary);">${stats.totalScenarios + stats.totalExampleRows}</div>
                        <div style="margin-top: 5px; font-size: 0.85em; opacity: 0.7; line-height: 1.3;">
                            Scenarios + Examples Permutations
                        </div>
                        <div style="margin-top: auto; font-weight: bold; color: var(--accent-tertiary); font-size: 1.3em;" title="Assumes 5 minutes to manually execute one test scenario block">
                            <span class="counter">${(((stats.totalScenarios + stats.totalExampleRows)*5)/60).toFixed(1)}</span> Hrs Estimated Execution Effort
                        </div>
                        <div style="margin-top: 5px; font-size: 0.7em; opacity: 0.5;">Manual testing time estimate</div>
                    </div>

                    <div class="card span-12" style="animation-delay: 0.25s;">
                        <div class="card-title">Scenario Intelligence</div>
                        <div class="breakdown-grid">
                            <div class="breakdown-item">
                                <div class="breakdown-label">Vocabulary Richness</div>
                                <div class="breakdown-value counter">${stats.totalWordsInSteps}</div>
                                <div style="font-size: 0.75em; opacity: 0.6; margin-top: 5px;">Total words parsed in steps</div>
                            </div>
                            <div class="breakdown-item">
                                <div class="breakdown-label">Avg Words / Step</div>
                                <div class="breakdown-value counter">${avgWordsPerStep}</div>
                                <div style="font-size: 0.75em; opacity: 0.6; margin-top: 5px;">Step conciseness</div>
                            </div>
                            <div class="breakdown-item">
                                <div class="breakdown-label">Data Density</div>
                                <div class="breakdown-value counter">${dataDensity}</div>
                                <div style="font-size: 0.75em; opacity: 0.6; margin-top: 5px;">Avg rows per Outline</div>
                            </div>
                            <div class="breakdown-item" style="border-color: rgba(220,220,170,0.3);">
                                <div class="breakdown-label" style="color: var(--accent-warning);">Longest scenario</div>
                                <div class="breakdown-value counter" style="color: var(--accent-warning);">${stats.maxStepsInScenario} <span style="font-size:0.4em">steps</span></div>
                                <div style="font-size: 0.75em; opacity: 0.8; margin-top: 8px; line-height: 1.4; word-break: break-word;">"${escapeHtml(stats.longestScenarioName)}"</div>
                            </div>
                        </div>
                    </div>

                    <div class="card span-6" style="animation-delay: 0.3s;">
                        <div class="card-title">Behavioral Archetypes</div>
                        <div style="opacity: 0.8; font-size: 0.9em;">Distribution of UI, API, and DB operations detected in steps.</div>
                        <div class="progress-track">
                            <div class="progress-segment" id="pb-ui" style="background-color: var(--accent-primary); width: ${uiPct}%;"></div>
                            <div class="progress-segment" id="pb-api" style="background-color: var(--accent-secondary); width: ${apiPct}%;"></div>
                            <div class="progress-segment" id="pb-db" style="background-color: var(--accent-warning); width: ${dbPct}%;"></div>
                        </div>
                        <div class="legend">
                            <div><span style="color: var(--accent-primary);">■</span> UI/E2E: <span class="counter">${stats.uiSteps}</span></div>
                            <div><span style="color: var(--accent-secondary);">■</span> API: <span class="counter">${stats.apiSteps}</span></div>
                            <div><span style="color: var(--accent-warning);">■</span> DB/SQL: <span class="counter">${stats.dbSteps}</span></div>
                        </div>
                    </div>

                    <div class="card span-6" style="animation-delay: 0.35s;">
                        <div class="card-title">Step Execution Breakdown</div>
                        <div style="opacity: 0.8; font-size: 0.9em;">Keyword usage across all ${stats.totalSteps} steps in the project.</div>
                        <div class="progress-track">
                            <div class="progress-segment" id="pb-given" style="background-color: var(--accent-secondary); width: ${givenPct}%;"></div>
                            <div class="progress-segment" id="pb-when" style="background-color: var(--accent-warning); width: ${whenPct}%;"></div>
                            <div class="progress-segment" id="pb-then" style="background-color: var(--accent-tertiary); width: ${thenPct}%;"></div>
                            <div class="progress-segment" id="pb-andbut" style="background-color: #9CDCFE; width: ${andButPct}%;"></div>
                        </div>
                        <div class="legend">
                            <div><span style="color: var(--accent-secondary);">■</span> Given: <span class="counter">${stats.totalGiven}</span></div>
                            <div><span style="color: var(--accent-warning);">■</span> When: <span class="counter">${stats.totalWhen}</span></div>
                            <div><span style="color: var(--accent-tertiary);">■</span> Then: <span class="counter">${stats.totalThen}</span></div>
                            <div><span style="color: #9CDCFE;">■</span> And/But: <span class="counter">${stats.totalAnd + stats.totalBut}</span></div>
                        </div>
                    </div>

                    <div class="card span-6" style="animation-delay: 0.5s;">
                        <div class="card-title" title="Ratio of Total Steps to Unique Steps">
                            <span>Reusability Index</span>
                            <span class="card-value counter" style="color: var(--accent-primary); font-size: 1.5em; line-height: 1;">${reusabilityIndex}</span>
                        </div>
                        <div style="font-size: 0.8em; opacity: 0.8; margin-bottom: 15px;">You have written <strong style="color: var(--accent-secondary);">${stats.totalSteps}</strong> total steps, but only <strong style="color: var(--accent-warning);">${stats.uniqueStepsCount}</strong> are unique.</div>
                        <div style="font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; color: var(--vscode-descriptionForeground); margin-bottom: 5px;">Most Repeated Steps:</div>
                        <div class="list-container">${stepsHtml}</div>
                    </div>
                    
                    <div class="card span-6" style="animation-delay: 0.6s;">
                        <div class="card-title">
                            <span>Top 5 Tags</span>
                            <span style="font-size: 0.8em; opacity: 0.6; text-transform: none; font-weight: normal;">Total Tags: <strong class="counter">${stats.totalTags}</strong></span>
                        </div>
                        <div class="list-container" style="flex: 1; margin-top: 10px;">${tagsHtml}</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}
