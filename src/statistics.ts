import * as vscode from 'vscode';

/**
 * Scans the workspace for Gherkin files and displays a visual statistics dashboard.
 */
export async function showStatisticsDashboard(_context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'gherkinStatistics',
        'Gherkin Statistics',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getLoadingHtml();

    try {
        const stats = await calculateStatistics();
        panel.webview.html = getDashboardHtml(stats);
    } catch (error) {
        panel.webview.html = getErrorHtml();
    }
}

async function calculateStatistics() {
    const files = await vscode.workspace.findFiles('**/*.feature', '**/node_modules/**');
    
    let totalFeatures = 0;
    let totalScenarios = 0;
    let totalRules = 0;

    const featureRegex = /^\s*(Feature|Característica|Fonction|Funktionalität):/i;
    const scenarioRegex = /^\s*(Scenario|Scenario Outline|Escenario|Esquema del escenario|Scénario|Plan du scénario|Szenario|Szenariogrundriss):/i;
    const ruleRegex = /^\s*(Rule|Regla|Règle|Regel):/i;

    // Track processed URIs to avoid double counting
    const processedUris = new Set<string>();

    // First check open documents (includes unsaved files)
    const openDocs = vscode.workspace.textDocuments.filter(doc => doc.languageId === 'feature' || doc.languageId === 'gherkin' || doc.fileName.endsWith('.feature'));
    
    for (const doc of openDocs) {
        processedUris.add(doc.uri.toString());
        const text = doc.getText();
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
            if (featureRegex.test(line)) totalFeatures++;
            else if (scenarioRegex.test(line)) totalScenarios++;
            else if (ruleRegex.test(line)) totalRules++;
        }
    }

    // Then check files from disk that aren't open
    for (const file of files) {
        if (!processedUris.has(file.toString())) {
            processedUris.add(file.toString());
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();
            const lines = text.split(/\r?\n/);

            for (const line of lines) {
                if (featureRegex.test(line)) totalFeatures++;
                else if (scenarioRegex.test(line)) totalScenarios++;
                else if (ruleRegex.test(line)) totalRules++;
            }
        }
    }

    return { totalFiles: processedUris.size, totalFeatures, totalScenarios, totalRules };
}

function getLoadingHtml() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Loading Statistics...</title>
            <style>
                body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                h1 { color: #1E90FF; }
            </style>
        </head>
        <body>
            <h1>Scanning Workspace...</h1>
        </body>
        </html>
    `;
}

function getErrorHtml() {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error</title>
        </head>
        <body>
            <h1 style="color: red;">Failed to calculate statistics.</h1>
        </body>
        </html>
    `;
}

function getDashboardHtml(stats: { totalFiles: number, totalFeatures: number, totalScenarios: number, totalRules: number }) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Gherkin Statistics</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                    padding: 40px;
                    background-color: var(--vscode-editor-background);
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                .title {
                    font-size: 2.5em;
                    font-weight: bold;
                    margin-bottom: 30px;
                    text-align: center;
                    color: #FF00FF; /* Magenta */
                }
                .cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                }
                .card {
                    background-color: var(--vscode-editorWidget-background);
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 10px;
                    padding: 30px 20px;
                    text-align: center;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    transition: transform 0.2s;
                }
                .card:hover {
                    transform: translateY(-5px);
                    border-color: #1E90FF; /* DodgerBlue */
                }
                .card-title {
                    font-size: 1.2em;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 15px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .card-value {
                    font-size: 3em;
                    font-weight: bold;
                    color: #1E90FF; /* DodgerBlue */
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="title">Gherkin Project Statistics</div>
                <div class="cards">
                    <div class="card">
                        <div class="card-title">Files Analyzed</div>
                        <div class="card-value">${stats.totalFiles}</div>
                    </div>
                    <div class="card">
                        <div class="card-title">Total Features</div>
                        <div class="card-value">${stats.totalFeatures}</div>
                    </div>
                    <div class="card">
                        <div class="card-title">Total Rules</div>
                        <div class="card-value">${stats.totalRules}</div>
                    </div>
                    <div class="card">
                        <div class="card-title">Total Scenarios</div>
                        <div class="card-value">${stats.totalScenarios}</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}
