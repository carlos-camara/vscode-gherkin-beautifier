import * as vscode from 'vscode';

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
    totalDataRows: number;
    totalComments: number;
    totalLines: number;
    totalEmptyLines: number;
    tagFrequencies: [string, number][];
}

/**
 * Scans the workspace for Gherkin files and displays a visual statistics dashboard.
 */
export async function showStatisticsDashboard(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'gherkinStatistics',
        'Gherkin Statistics',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getLoadingHtml();

    try {
        const stats = await calculateStatistics();
        const version = context.extension.packageJSON?.version || '1.6.0';
        panel.webview.html = getDashboardHtml(stats, version);
    } catch (error) {
        panel.webview.html = getErrorHtml();
    }
}

async function calculateStatistics(): Promise<GherkinStats> {
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
        totalDataRows: 0,
        totalComments: 0,
        totalLines: 0,
        totalEmptyLines: 0,
        tagFrequencies: []
    };

    const featureRegex = /^\s*(Feature|Característica|Fonction|Funktionalität):/i;
    const ruleRegex = /^\s*(Rule|Regla|Règle|Regel):/i;
    const backgroundRegex = /^\s*(Background|Antecedentes|Contexte|Hintergrund):/i;
    const scenarioOutlineRegex = /^\s*(Scenario Outline|Esquema del escenario|Plan du scénario|Szenariogrundriss):/i;
    const scenarioRegex = /^\s*(Scenario|Escenario|Scénario|Szenario):/i;
    const tagRegex = /@[^\s@]+/g;
    const commentRegex = /^\s*#/;
    const dataRowRegex = /^\s*\|.*\|\s*$/;
    const emptyLineRegex = /^\s*$/;
    
    const givenRegex = /^\s*(Given|Dado|Dada|Dados|Dadas|Soit|Angenommen|Gegeben sei|Gegeben seien)\s/i;
    const whenRegex = /^\s*(When|Cuando|Quand|Wenn)\s/i;
    const thenRegex = /^\s*(Then|Entonces|Alors|Dann)\s/i;
    const andRegex = /^\s*(And|Y|E|Et|Und)\s/i;
    const butRegex = /^\s*(But|Pero|Mais|Aber)\s/i;

    const processedUris = new Set<string>();
    const tagMap = new Map<string, number>();

    const analyzeText = (text: string) => {
        const lines = text.split(/\r?\n/);
        stats.totalLines += lines.length;

        for (const line of lines) {
            if (emptyLineRegex.test(line)) { stats.totalEmptyLines++; continue; }
            
            if (featureRegex.test(line)) stats.totalFeatures++;
            else if (ruleRegex.test(line)) stats.totalRules++;
            else if (backgroundRegex.test(line)) stats.totalBackgrounds++;
            else if (scenarioOutlineRegex.test(line)) stats.totalScenarioOutlines++;
            else if (scenarioRegex.test(line)) stats.totalScenarios++;
            else if (givenRegex.test(line)) { stats.totalGiven++; stats.totalSteps++; }
            else if (whenRegex.test(line)) { stats.totalWhen++; stats.totalSteps++; }
            else if (thenRegex.test(line)) { stats.totalThen++; stats.totalSteps++; }
            else if (andRegex.test(line)) { stats.totalAnd++; stats.totalSteps++; }
            else if (butRegex.test(line)) { stats.totalBut++; stats.totalSteps++; }
            else if (commentRegex.test(line)) stats.totalComments++;
            else if (dataRowRegex.test(line)) stats.totalDataRows++;
            
            if (line.includes('@')) {
                const matches = line.match(tagRegex);
                if (matches) {
                    stats.totalTags += matches.length;
                    for (const tag of matches) {
                        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
                    }
                }
            }
        }
    };

    const openDocs = vscode.workspace.textDocuments.filter(doc => doc.languageId === 'feature' || doc.languageId === 'gherkin' || doc.fileName.endsWith('.feature'));
    
    for (const doc of openDocs) {
        processedUris.add(doc.uri.toString());
        analyzeText(doc.getText());
    }

    for (const file of files) {
        if (!processedUris.has(file.toString())) {
            processedUris.add(file.toString());
            const document = await vscode.workspace.openTextDocument(file);
            analyzeText(document.getText());
        }
    }

    // Sort tags by frequency and get top 5
    stats.tagFrequencies = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    stats.totalFiles = processedUris.size;
    return stats;
}

function getLoadingHtml() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
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

function getErrorHtml() {
    return `<!DOCTYPE html><html><body><h1 style="color: var(--vscode-errorForeground);">Error parsing workspace</h1></body></html>`;
}

function getDashboardHtml(stats: GherkinStats, version: string) {
    const totalScenarioBlocks = stats.totalScenarios + stats.totalScenarioOutlines;
    const avgSteps = totalScenarioBlocks > 0 ? (stats.totalSteps / totalScenarioBlocks) : 0;
    
    // Gherkin Quality Score (0-100)
    let gqs = 50; // Base score
    
    // Bonuses
    const docBonus = stats.totalSteps > 0 ? Math.min(20, (stats.totalComments / stats.totalSteps) * 50) : 0;
    const reuseBonus = stats.totalFeatures > 0 ? Math.min(15, (stats.totalBackgrounds / stats.totalFeatures) * 50) : 0;
    const dataBonus = stats.totalScenarios > 0 ? Math.min(15, (stats.totalDataRows / stats.totalScenarios) * 10) : 0;
    
    // Penalties
    const complexityPenalty = avgSteps > 12 ? Math.min(30, (avgSteps - 12) * 2) : 0;
    
    gqs = Math.max(0, Math.min(100, Math.round(gqs + docBonus + reuseBonus + dataBonus - complexityPenalty)));
    
    let gqsColor = "#4EC9B0"; // Green
    if (gqs < 75) gqsColor = "#DCDCAA"; // Yellow
    if (gqs < 50) gqsColor = "#F44336"; // Red

    const totalExecutableTests = stats.totalScenarios + stats.totalDataRows;
    const automationROIHours = ((totalExecutableTests * 5) / 60).toFixed(1);

    // Distribution
    const distributionStandard = totalExecutableTests > 0 ? (stats.totalScenarios / totalExecutableTests) * 360 : 0;

    let tagsHtml = stats.tagFrequencies.map((tag, index) => 
        `<div class="tag-row">
            <span class="tag-name">#${index + 1} ${tag[0]}</span>
            <span class="tag-count counter" data-target="${tag[1]}">0</span>
        </div>`
    ).join('');

    if (stats.tagFrequencies.length === 0) {
        tagsHtml = `<div style="text-align: center; opacity: 0.5; padding: 20px;">No tags found</div>`;
    }

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ultimate Gherkin Statistics V4</title>
            <style>
                :root {
                    --accent-primary: #C586C0;
                    --accent-secondary: #569CD6;
                    --accent-tertiary: #4EC9B0;
                    --accent-warning: #DCDCAA;
                }
                
                @keyframes floatUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    color: var(--vscode-editor-foreground);
                    padding: 30px; margin: 0;
                    background: radial-gradient(circle at top, rgba(197,134,192,0.05), transparent 60%),
                                radial-gradient(circle at bottom, rgba(86,156,214,0.05), transparent 60%);
                    background-color: var(--vscode-editor-background);
                }
                .container { max-width: 1100px; margin: 0 auto; }
                .header {
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 15px; margin-bottom: 30px;
                    animation: floatUp 0.6s ease-out;
                }
                .title { font-size: 2.5em; font-weight: 800; background: -webkit-linear-gradient(45deg, var(--accent-primary), var(--accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .badge { padding: 5px 12px; background: rgba(197, 134, 192, 0.1); color: var(--accent-primary); border: 1px solid rgba(197, 134, 192, 0.3); border-radius: 20px; font-weight: 800; font-size: 0.8em; letter-spacing: 2px;}
                
                .section-title { font-size: 1.1em; font-weight: 700; margin: 30px 0 15px 0; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 2px; }
                
                .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
                .grid-3 { grid-template-columns: repeat(3, 1fr); }
                
                .card {
                    background: rgba(var(--vscode-editorWidget-background), 0.5); backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column;
                    transition: all 0.3s; animation: floatUp 0.6s ease-out backwards; position: relative; overflow: hidden;
                }
                .card:hover { transform: translateY(-5px); border-color: rgba(255,255,255,0.15); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); }
                
                .card-title { font-size: 0.85em; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
                .card-value { font-size: 3em; font-weight: 800; color: var(--vscode-editor-foreground); line-height: 1; }
                
                /* GQS Card */
                .gqs-card {
                    grid-column: span 2;
                    background: linear-gradient(135deg, rgba(30,30,30,0.8), rgba(45,45,45,0.9));
                    border: 1px solid rgba(255,255,255,0.1);
                    display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: center; padding: 30px;
                }
                .gqs-circle {
                    width: 140px; height: 140px; border-radius: 50%;
                    background: conic-gradient(${gqsColor} ${gqs * 3.6}deg, rgba(255,255,255,0.05) 0);
                    display: flex; align-items: center; justify-content: center; position: relative; margin: 0 auto;
                    box-shadow: 0 0 30px ${gqsColor}40;
                }
                .gqs-circle::after { content: ""; position: absolute; width: 120px; height: 120px; background: var(--vscode-editorWidget-background); border-radius: 50%; }
                .gqs-value { position: relative; z-index: 10; font-size: 3em; font-weight: bold; color: ${gqsColor}; }

                /* Leaderboard */
                .leaderboard-card { grid-row: span 2; }
                .tag-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .tag-row:last-child { border-bottom: none; }
                .tag-name { color: var(--accent-secondary); font-family: monospace; font-size: 1.1em; }
                .tag-count { font-weight: bold; color: var(--vscode-editor-foreground); background: rgba(255,255,255,0.1); padding: 2px 10px; border-radius: 12px; }

                /* Mega ROI */
                .roi-value { font-size: 4em; background: -webkit-linear-gradient(45deg, var(--accent-tertiary), var(--accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="title">Project Analytics</div>
                    <div class="badge">V${version} ULTIMATE SQUEEZE</div>
                </div>

                <div class="grid grid-3">
                    <div class="card gqs-card" style="animation-delay: 0.1s;">
                        <div style="text-align: center;">
                            <div class="gqs-circle">
                                <div class="gqs-value counter" data-target="${gqs}">0</div>
                            </div>
                            <div style="margin-top: 15px; font-weight: bold; color: ${gqsColor}; letter-spacing: 1px;">GHERKIN QUALITY SCORE</div>
                        </div>
                        <div>
                            <div style="margin-bottom: 15px; opacity: 0.8;">Algorithm Breakdown:</div>
                            <div style="font-size: 0.9em; margin-bottom: 8px;">✔️ Reusability (Backgrounds): <strong>+${Math.round(reuseBonus)}</strong></div>
                            <div style="font-size: 0.9em; margin-bottom: 8px;">✔️ Parametrization (Data): <strong>+${Math.round(dataBonus)}</strong></div>
                            <div style="font-size: 0.9em; margin-bottom: 8px;">✔️ Documentation (Comments): <strong>+${Math.round(docBonus)}</strong></div>
                            <div style="font-size: 0.9em; color: var(--accent-danger);">❌ Complexity Penalty: <strong>-${Math.round(complexityPenalty)}</strong></div>
                        </div>
                    </div>
                    <div class="card leaderboard-card" style="animation-delay: 0.2s;">
                        <div class="card-title" style="color: var(--accent-primary);">🏆 Top 5 Tags</div>
                        <div style="margin-top: 10px;">${tagsHtml}</div>
                        <div style="margin-top: 20px; font-size: 0.8em; opacity: 0.6; text-align: center;">Total Tag Occurrences: <strong class="counter" data-target="${stats.totalTags}">0</strong></div>
                    </div>
                </div>

                <div class="section-title">🚀 Execution & Automation ROI</div>
                <div class="grid">
                    <div class="card" style="animation-delay: 0.3s; background: linear-gradient(135deg, rgba(78,201,176,0.1), transparent);">
                        <div class="card-title">Automation ROI</div>
                        <div style="display: flex; align-items: baseline; gap: 10px;">
                            <div class="card-value roi-value counter" data-target="${automationROIHours}" data-is-float="true">0</div>
                            <div style="font-size: 1.2em; color: var(--accent-tertiary); font-weight: bold;">Hrs</div>
                        </div>
                        <div style="font-size: 0.8em; opacity: 0.6; margin-top: 5px;">Time Saved (5m / Executable Test)</div>
                    </div>
                    <div class="card" style="animation-delay: 0.4s;">
                        <div class="card-title">Executable Tests</div>
                        <div class="card-value counter" data-target="${totalExecutableTests}" style="color: var(--accent-secondary);">0</div>
                        <div style="font-size: 0.8em; opacity: 0.6; margin-top: 5px;">Total Scenarios + Data Permutations</div>
                    </div>
                    <div class="card" style="animation-delay: 0.5s;">
                        <div class="card-title">Avg Steps / Scenario</div>
                        <div class="card-value counter" data-target="${avgSteps}" data-is-float="true" style="color: var(--accent-warning);">0</div>
                        <div style="font-size: 0.8em; opacity: 0.6; margin-top: 5px;">Complexity Indicator</div>
                    </div>
                </div>

                <div class="section-title">📦 Density & Scope</div>
                <div class="grid">
                    <div class="card" style="animation-delay: 0.6s;">
                        <div class="card-title">Code Density</div>
                        <div class="card-value counter" data-target="${stats.totalLines}">0</div>
                        <div style="font-size: 0.8em; opacity: 0.6; margin-top: 5px;">Total Lines of Code</div>
                    </div>
                    <div class="card" style="animation-delay: 0.7s;">
                        <div class="card-title">Formatting Space</div>
                        <div class="card-value counter" data-target="${stats.totalEmptyLines}" style="color: var(--accent-secondary);">0</div>
                        <div style="font-size: 0.8em; opacity: 0.6; margin-top: 5px;">Empty Lines</div>
                    </div>
                    <div class="card" style="animation-delay: 0.8s;">
                        <div class="card-title">Total Features</div>
                        <div class="card-value counter" data-target="${stats.totalFeatures}" style="color: var(--accent-primary);">0</div>
                        <div style="font-size: 0.8em; opacity: 0.6; margin-top: 5px;">Feature Files Analyzed: ${stats.totalFiles}</div>
                    </div>
                </div>
            </div>

            <script>
                // Animate Numbers
                const counters = document.querySelectorAll('.counter');
                counters.forEach(counter => {
                    const updateCount = () => {
                        const target = +counter.getAttribute('data-target');
                        const isFloat = counter.getAttribute('data-is-float') === 'true';
                        let current = isFloat ? parseFloat(counter.innerText) : parseInt(counter.innerText);
                        const inc = target / 50;

                        if (current < target) {
                            current += inc;
                            counter.innerText = isFloat ? current.toFixed(1) : Math.ceil(current);
                            setTimeout(updateCount, 15);
                        } else {
                            counter.innerText = isFloat ? target.toFixed(1) : target;
                        }
                    };
                    updateCount();
                });
            </script>
        </body>
        </html>
    `;
}
