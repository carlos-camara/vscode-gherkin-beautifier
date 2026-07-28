import * as assert from 'assert';
import { calculateStatistics, getDashboardHtml, getErrorHtml, getLoadingHtml, GherkinStats, escapeHtml, showStatisticsDashboard } from '../../statistics';
import * as vscode from 'vscode';

suite('Statistics Security (XSS & Escaping) Test Suite', () => {

    test('escapeHtml: Escapes <script> tags', () => {
        const input = '<script>alert(1)</script>';
        const expected = '&lt;script&gt;alert(1)&lt;/script&gt;';
        assert.strictEqual(escapeHtml(input), expected);
    });

    test('escapeHtml: Escapes <img onerror>', () => {
        const input = '<img src="x" onerror="alert(1)">';
        const expected = '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;';
        assert.strictEqual(escapeHtml(input), expected);
    });

    test('escapeHtml: Escapes ampersands', () => {
        const input = 'Foo & Bar';
        const expected = 'Foo &amp; Bar';
        assert.strictEqual(escapeHtml(input), expected);
    });

    test('escapeHtml: Escapes single and double quotes', () => {
        const input = 'O\'Brian said "Hello"';
        const expected = 'O&#039;Brian said &quot;Hello&quot;';
        assert.strictEqual(escapeHtml(input), expected);
    });

    test('escapeHtml: Handles complex SVG payload', () => {
        const input = '<svg onload="alert(1)"></svg>';
        const expected = '&lt;svg onload=&quot;alert(1)&quot;&gt;&lt;/svg&gt;';
        assert.strictEqual(escapeHtml(input), expected);
    });

    test('escapeHtml: Preserves safe Unicode characters without corrupting them', () => {
        const input = 'Escenario: 🚀 Testing Ñandú & "Château"';
        const expected = 'Escenario: 🚀 Testing Ñandú &amp; &quot;Château&quot;';
        assert.strictEqual(escapeHtml(input), expected);
    });

    test('escapeHtml: Handles empty strings correctly', () => {
        assert.strictEqual(escapeHtml(''), '');
    });

});

suite('Statistics Core Logic Test Suite', () => {
    
    test('calculateStatistics: Analyzes workspace feature files', async () => {
        const stats = await calculateStatistics();
        assert.ok(stats);
        if (stats) {
            assert.ok(stats.totalFiles >= 0);
            assert.ok(stats.totalSteps >= 0);
            assert.ok(stats.totalScenarios >= 0);
            assert.ok(Array.isArray(stats.tagFrequencies));
            assert.ok(Array.isArray(stats.topRepeatedSteps));
        }
    });

    test('getLoadingHtml: Returns valid HTML', () => {
        const html = getLoadingHtml();
        assert.ok(html.includes('Analyzing Workspace'));
        assert.ok(html.includes('spinner'));
    });

    test('getErrorHtml: Returns valid HTML', () => {
        const html = getErrorHtml();
        assert.ok(html.includes('Error parsing workspace'));
    });

    test('getDashboardHtml: Renders stats correctly', () => {
        const dummyStats: GherkinStats = {
            totalFiles: 1,
            totalFeatures: 1,
            totalRules: 0,
            totalScenarios: 2,
            totalScenarioOutlines: 1,
            totalBackgrounds: 1,
            totalTags: 5,
            totalSteps: 10,
            totalGiven: 2,
            totalWhen: 4,
            totalThen: 2,
            totalAnd: 1,
            totalBut: 1,
            totalExampleRows: 3,
            totalDataTableRows: 2,
            totalComments: 2,
            totalLines: 50,
            totalEmptyLines: 5,
            tagFrequencies: [['@smoke', 3], ['@regression', 2]],
            uiSteps: 2,
            apiSteps: 1,
            dbSteps: 0,
            uniqueStepsCount: 8,
            topRepeatedSteps: [['I login', 2]],
            totalWordsInSteps: 40,
            longestScenarioName: "Very long scenario name with <script>",
            maxStepsInScenario: 5
        };

        const html = getDashboardHtml(dummyStats, '1.8.0');
        
        assert.ok(html.includes('Very long scenario name with &lt;script&gt;'));
        assert.ok(html.includes('Score Breakdown'));
        assert.ok(html.includes('@smoke'));
        assert.ok(html.includes('I login'));
        
        const emptyStats: GherkinStats = { ...dummyStats, totalSteps: 0, uniqueStepsCount: 0, tagFrequencies: [], topRepeatedSteps: [] };
        const emptyHtml = getDashboardHtml(emptyStats, '1.8.0');
        assert.ok(emptyHtml.includes('No tags found'));
        assert.ok(emptyHtml.includes('No repeated steps'));
    });

    test('calculateStatistics: Analyzes AST precisely from document', async () => {
        const docContent = `
        @ui @regression
        Feature: Coverage Test
        
        # This is a comment
        Background: Setup
          Given I click the button
          And I navigate to the url
        
        Rule: A simple rule
        
        @api
        Scenario: API Request
          When I send an api request
          Then the status code is 200
          But the response json is valid
        
        Scenario Outline: DB Query
          Given I query the database table
          | id |
          | 1  |
          | 2  |
          
          Examples:
          | data |
          | a    |
          | b    |
        `;
        
        const doc = await vscode.workspace.openTextDocument({ language: 'feature', content: docContent });
        
        // Isolate this test from other tests' open documents and workspace files
        const originalTextDocuments = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');
        Object.defineProperty(vscode.workspace, 'textDocuments', { get: () => [doc], configurable: true });
        
        const originalFindFiles = vscode.workspace.findFiles;
        vscode.workspace.findFiles = async () => [];
        
        const stats = await calculateStatistics();
        
        if (originalTextDocuments) {
            Object.defineProperty(vscode.workspace, 'textDocuments', originalTextDocuments);
        }
        vscode.workspace.findFiles = originalFindFiles;
        assert.ok(stats);
        if (stats) {
            assert.ok(stats.totalFeatures >= 1, 'Should find at least 1 Feature');
            assert.ok(stats.totalRules >= 1, 'Should find at least 1 Rule');
            assert.ok(stats.totalBackgrounds >= 1, 'Should find at least 1 Background');
            assert.ok(stats.totalScenarios >= 1, 'Should find at least 1 Scenario');
            assert.ok(stats.totalScenarioOutlines >= 1, 'Should find at least 1 Scenario Outline');
            assert.ok(stats.totalComments >= 1, 'Should find at least 1 Comment');
            assert.ok(stats.totalDataTableRows >= 3, 'Should find at least 3 Data Table rows (including header)');
            assert.ok(stats.totalExampleRows >= 2, 'Should find at least 2 Example Rows');
            assert.ok(stats.totalTags >= 3, 'Should find at least 3 Tags (@ui, @regression, @api)');
            assert.ok(stats.uiSteps >= 2, 'Should find UI steps');
            assert.ok(stats.apiSteps >= 2, 'Should find API steps');
            assert.ok(stats.dbSteps >= 1, 'Should find DB steps');
            assert.ok(stats.totalGiven >= 2, 'Should find Given steps');
            assert.ok(stats.totalWhen >= 1, 'Should find When steps');
            assert.ok(stats.totalThen >= 1, 'Should find Then steps');
            assert.ok(stats.totalAnd >= 1, 'Should find And steps');
            assert.ok(stats.totalBut >= 1, 'Should find But steps');
        }
    });

    test('calculateStatistics: Handles CancellationToken gracefully', async () => {
        // Mock token
        const token: vscode.CancellationToken = {
            isCancellationRequested: true,
            onCancellationRequested: new vscode.EventEmitter<any>().event
        };

        const stats = await calculateStatistics(undefined, token);
        // It returns undefined or partially empty if canceled before doing work
        // For our implementation, if token is set right away, it exits early or returns partial stats 
        // We just assert it doesn't throw and returns gracefully.
        if (stats) {
            assert.strictEqual(stats.totalFeatures, 0); // Because it cancels processing
        }
    });

    test('calculateStatistics: Handles fallback keyword counting (e.g., * wildcard or missing type)', async () => {
        const docContent = `
        Feature: Fallback Keyword Test
        Scenario: Asterisk
          * I do something undefined
        `;
        
        const doc = await vscode.workspace.openTextDocument({ language: 'feature', content: docContent });
        
        const originalTextDocuments = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');
        Object.defineProperty(vscode.workspace, 'textDocuments', { get: () => [doc], configurable: true });
        
        const originalFindFiles = vscode.workspace.findFiles;
        vscode.workspace.findFiles = async () => [];
        
        const stats = await calculateStatistics();
        
        if (originalTextDocuments) {
            Object.defineProperty(vscode.workspace, 'textDocuments', originalTextDocuments);
        }
        vscode.workspace.findFiles = originalFindFiles;
        assert.ok(stats);
        if (stats) {
            assert.ok(stats.totalAnd > 0, 'Should fall back to totalAnd for * or unknown keywords');
        }
    });
    test('showStatisticsDashboard: creates webview and calculates stats', async () => {
        let webviewHtml = '';
        let webviewDisposed = false;
        
        const mockContext = {
            extension: {
                packageJSON: { version: '2.0.0' }
            }
        } as any;
        
        const originalCreateWebviewPanel = vscode.window.createWebviewPanel;
        const originalWithProgress = vscode.window.withProgress;
        
        vscode.window.createWebviewPanel = () => ({
            webview: {
                set html(value: string) { webviewHtml = value; }
            },
            dispose: () => { webviewDisposed = true; }
        } as any);
        
        vscode.window.withProgress = async (_options, task) => {
            return task({ report: () => {} } as any, { isCancellationRequested: false } as any);
        };
        
        await showStatisticsDashboard(mockContext);
        
        assert.ok(webviewHtml.includes('Score Breakdown') || webviewHtml.includes('No tags found'), 'Dashboard HTML should be set');
        assert.ok(!webviewDisposed, 'Panel should not be disposed');
        
        vscode.window.createWebviewPanel = originalCreateWebviewPanel;
        vscode.window.withProgress = originalWithProgress;
    });

    test('showStatisticsDashboard: handles error gracefully', async () => {
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
                set html(value: string) { webviewHtml = value; }
            },
            dispose: () => {}
        } as any);
        
        vscode.window.withProgress = async () => {
            throw new Error('Simulation of an error');
        };
        
        await showStatisticsDashboard(mockContext);
        
        assert.ok(webviewHtml.includes('Error parsing workspace'), 'Error HTML should be shown');
        
        vscode.window.createWebviewPanel = originalCreateWebviewPanel;
        vscode.window.withProgress = originalWithProgress;
    });
});
