import * as assert from 'assert';
import * as vscode from 'vscode';
import { DiagnosticEngine, redactPath, redactReportText, showDiagnosticsReport } from '../../diagnostics';
import { SymbolCache } from '../../cache';

suite('DiagnosticEngine & Redaction Test Suite', () => {
    let engine: DiagnosticEngine;

    setup(() => {
        engine = new DiagnosticEngine();
    });

    test('redactPath handles empty inputs and edge cases', () => {
        assert.strictEqual(redactPath(''), '');
        assert.strictEqual(redactPath(undefined as unknown as string), undefined as unknown as string);

        const homePath = '/Users/johndoe/projects/my-project';
        const redacted = redactPath(homePath, '/Users/johndoe', 'johndoe');
        assert.ok(!redacted.includes('johndoe'));
        assert.ok(redacted.includes('<redacted>'));
    });

    test('redactPath handles Windows paths and custom usernames', () => {
        const winPath = 'C:\\Users\\alice\\documents\\project';
        const redacted = redactPath(winPath, 'C:\\Users\\alice', 'alice');
        assert.ok(!redacted.includes('alice'));
        assert.ok(redacted.includes('<redacted>'));
    });

    test('redactReportText sanitizes text output containing user paths', () => {
        const sampleOutput = 'Error opening /Users/alice/workspace/features/steps/login.py';
        const sanitized = redactReportText(redactPath(sampleOutput, '/Users/alice', 'alice'));
        assert.ok(!sanitized.includes('alice'));
        assert.ok(sanitized.includes('<redacted>'));
    });

    test('collectDiagnostics gathers metrics and produces report object', async () => {
        const report = await engine.collectDiagnostics();

        assert.ok(report.extensionVersion);
        assert.ok(report.vscodeVersion);
        assert.ok(report.operatingSystem);
        assert.ok(Array.isArray(report.stepGlobs));
        assert.ok(Array.isArray(report.ignoreGlobs));
        assert.ok(Array.isArray(report.warnings));
        assert.ok(Array.isArray(report.recommendations));
    });

    test('generateReportMarkdown formats report as readable text including interpreter path', async () => {
        const report = await engine.collectDiagnostics();
        report.pythonInterpreterPath = '/usr/bin/python3';
        report.warnings = ['Test warning'];
        report.recommendations = ['Test recommendation'];

        const markdown = engine.generateReportMarkdown(report);

        assert.ok(markdown.includes('=== GHERKIN POWERTOOLS DIAGNOSTIC REPORT ==='));
        assert.ok(markdown.includes('--- ENVIRONMENT ---'));
        assert.ok(markdown.includes('--- DISCOVERY & INDEXING ---'));
        assert.ok(markdown.includes('--- PYTHON & BEHAVE ENVIRONMENT ---'));
        assert.ok(markdown.includes('Interpreter Path        : /usr/bin/python3'));
        assert.ok(markdown.includes('⚠️ Test warning'));
        assert.ok(markdown.includes('💡 Test recommendation'));
        assert.ok(markdown.includes('=== END OF REPORT ==='));
    });

    test('collectDiagnostics generates warnings for empty workspace or missing files', async () => {
        const originalFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => [] });

        const report = await engine.collectDiagnostics();
        assert.ok(report.warnings.some(w => w.includes('No workspace folder')));

        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => originalFolders });
    });

    test('collectDiagnostics checks symbolCache and handles errors gracefully', async () => {
        const mockCache = {
            getAllStepDefinitions: async () => [{ type: 'given', stepText: 'test', uri: vscode.Uri.file('/test.py'), line: 1 }]
        } as unknown as SymbolCache;

        const report = await engine.collectDiagnostics(mockCache);
        assert.strictEqual(report.indexedDefinitionsCount, 1);
    });

    test('collectDiagnostics handles symbolCache throw gracefully', async () => {
        const mockCache = {
            getAllStepDefinitions: async () => { throw new Error('Cache error'); }
        } as unknown as SymbolCache;

        const report = await engine.collectDiagnostics(mockCache);
        assert.strictEqual(report.indexedDefinitionsCount, 0);
    });

    test('collectDiagnostics handles empty step cache but with step files', async () => {
        const mockCache = {
            getAllStepDefinitions: async () => []
        } as unknown as SymbolCache;

        const originalFindFiles = vscode.workspace.findFiles;
        vscode.workspace.findFiles = async (glob) => {
            if (glob === '**/steps/**/*.py' || glob === '**/features/steps/*.py') {
                return [vscode.Uri.file('/steps/test.py')];
            }
            return [];
        };

        try {
            const report = await engine.collectDiagnostics(mockCache);
            assert.strictEqual(report.indexedDefinitionsCount, 0);
            assert.ok(report.stepFilesCount > 0);
            assert.ok(report.warnings.some(w => w.includes('0 step definitions were indexed')));
            assert.ok(report.recommendations.some(r => r.includes('@given, @when, @then')));
        } finally {
            vscode.workspace.findFiles = originalFindFiles;
        }
    });

    test('showDiagnosticsReport creates OutputChannel and returns report markdown', async () => {
        const subscriptions: vscode.Disposable[] = [];
        const mockContext = { subscriptions } as unknown as vscode.ExtensionContext;

        const result = await showDiagnosticsReport(mockContext);
        assert.ok(result && typeof result === 'string');
        assert.ok(result.includes('GHERKIN POWERTOOLS DIAGNOSTIC REPORT'));
        assert.ok(subscriptions.length > 0, 'Should push OutputChannel to context subscriptions');
    });

    test('showDiagnosticsReport writes to clipboard if user selects Copy', async () => {
        const subscriptions: vscode.Disposable[] = [];
        const mockContext = { subscriptions } as unknown as vscode.ExtensionContext;

        const originalShowInfo = vscode.window.showInformationMessage;
        let clipboardText = '';
        const originalClipboard = vscode.env.clipboard;
        (vscode.env as any).clipboard = {
            writeText: async (text: string) => { clipboardText = text; }
        };

        try {
            // Mock showInformationMessage to return the Copy action button for the report and 'OK' for the info msg
            (vscode.window as any).showInformationMessage = async (msg: string, ..._items: string[]) => {
                if (msg.includes('Diagnostics gathered')) {
                    return '📋 Copy Sanitized Report';
                }
                return undefined;
            };

            await showDiagnosticsReport(mockContext);

            assert.ok(clipboardText.includes('GHERKIN POWERTOOLS DIAGNOSTIC REPORT'));
        } finally {
            vscode.window.showInformationMessage = originalShowInfo;
            (vscode.env as any).clipboard = originalClipboard;
        }
    });
});
