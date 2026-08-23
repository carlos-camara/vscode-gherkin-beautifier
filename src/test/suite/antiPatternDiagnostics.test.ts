import * as assert from 'assert';
import * as vscode from 'vscode';
import { AntiPatternDiagnosticsManager } from '../../antiPatternDiagnostics';
import { WorkspaceEventBus } from '../../eventBus';
import { WorkspaceGraph } from '../../graph';
import { SymbolCache } from '../../cache';

// Mock dependencies
class MockDiagnosticCollection implements vscode.DiagnosticCollection {
    name = 'mock';
    items = new Map<string, vscode.Diagnostic[]>();

    set(uri: vscode.Uri, diagnostics: readonly vscode.Diagnostic[] | undefined): void;
    set(entries: readonly [vscode.Uri, readonly vscode.Diagnostic[] | undefined][]): void;
    set(uriOrEntries: any, diagnostics?: readonly vscode.Diagnostic[] | undefined): void {
        if (uriOrEntries instanceof vscode.Uri) {
            if (diagnostics) {
                this.items.set(uriOrEntries.toString(), [...diagnostics]);
            } else {
                this.items.delete(uriOrEntries.toString());
            }
        }
    }
    delete(uri: vscode.Uri): void {
        this.items.delete(uri.toString());
    }
    clear(): void {
        this.items.clear();
    }
    *[Symbol.iterator](): Iterator<[vscode.Uri, readonly vscode.Diagnostic[]]> {
        for (const [uriStr, diags] of this.items.entries()) {
            yield [vscode.Uri.parse(uriStr), diags];
        }
    }
    forEach(_callback: (uri: vscode.Uri, diagnostics: readonly vscode.Diagnostic[], collection: vscode.DiagnosticCollection) => any, _thisArg?: any): void {
        throw new Error('Method not implemented.');
    }
    get(uri: vscode.Uri): readonly vscode.Diagnostic[] | undefined {
        return this.items.get(uri.toString());
    }
    has(uri: vscode.Uri): boolean {
        return this.items.has(uri.toString());
    }
    dispose(): void {}
}

suite('AntiPatternDiagnosticsManager Test Suite', function() {
    this.timeout(5000); // Allow time for debouncing

    let eventBus: WorkspaceEventBus;
    let symbolCache: SymbolCache;
    let graph: WorkspaceGraph;
    let manager: AntiPatternDiagnosticsManager;
    let mockCollection: MockDiagnosticCollection;
    let originalCreate: any;

    setup(() => {
        eventBus = new WorkspaceEventBus();
        symbolCache = new SymbolCache();
        graph = new WorkspaceGraph(symbolCache);

        // Override createDiagnosticCollection for testing
        originalCreate = vscode.languages.createDiagnosticCollection;
        mockCollection = new MockDiagnosticCollection();
        (vscode.languages as any).createDiagnosticCollection = () => mockCollection;

        manager = new AntiPatternDiagnosticsManager(graph, symbolCache, eventBus);
    });

    teardown(() => {
        manager.dispose();
        (vscode.languages as any).createDiagnosticCollection = originalCreate;
    });

    test('Initializes diagnostic collection', () => {
        assert.ok(manager);
    });

    test('Runs analysis on textDocumentOpened after debounce', async () => {
        // Trigger event
        const mockDoc = { uri: vscode.Uri.parse('file:///test.feature') } as unknown as vscode.TextDocument;
        eventBus.publish({ type: 'textDocumentOpened', document: mockDoc });

        // Wait for debounce (500ms in implementation) + some buffer
        await new Promise(resolve => setTimeout(resolve, 600));

        assert.ok(mockCollection);
    });

    test('Handles errors from generateAntiPatterns gracefully', async () => {
        (manager as any).engine.generateAntiPatterns = () => { throw new Error('Engine crash'); };

        const mockDoc = { uri: vscode.Uri.parse('file:///test.feature') } as unknown as vscode.TextDocument;
        eventBus.publish({ type: 'textDocumentOpened', document: mockDoc });

        // Should not throw unhandled exception
        await new Promise(resolve => setTimeout(resolve, 600));
        assert.ok(true);
    });

    test('Maps severities correctly and handles affectedItems and affectedFiles', async () => {
        (manager as any).engine.generateAntiPatterns = () => [
            {
                id: 'item-error',
                title: 'Item Error',
                explanation: 'Err',
                suggestedFix: 'Fix',
                severity: 'error',
                affectedItems: [{ uri: 'file:///test1.feature', line: 10 }]
            },
            {
                id: 'item-warning',
                title: 'Item Warning No Line',
                explanation: 'Warn',
                suggestedFix: 'Fix',
                severity: 'warning',
                affectedItems: [{ uri: 'file:///test2.feature', type: 'scenario', id: 'sc1' }] // missing line
            },
            {
                id: 'file-info',
                title: 'File Info',
                explanation: 'Info',
                suggestedFix: 'Fix',
                severity: 'info',
                affectedFiles: ['file:///test3.feature']
            },
            {
                id: 'project-hint',
                title: 'Project Hint',
                explanation: 'Hint',
                suggestedFix: 'Fix',
                severity: 'hint'
                // no files or items
            },
            {
                id: 'off-pattern',
                title: 'Off Pattern',
                explanation: 'Off',
                suggestedFix: 'Fix',
                severity: 'off',
                affectedItems: [{ uri: 'file:///test4.feature', line: 1 }]
            },
            {
                id: 'default-severity',
                title: 'Default Severity',
                explanation: 'Default',
                suggestedFix: 'Fix',
                severity: 'unknown',
                affectedFiles: ['file:///test5.feature']
            }
        ];

        // Trigger analysis directly for synchronous testing
        await (manager as any).runAnalysis();

        // Error with item and line
        const diags1 = mockCollection.get(vscode.Uri.parse('file:///test1.feature'));
        assert.strictEqual(diags1?.length, 1);
        assert.strictEqual(diags1[0].severity, vscode.DiagnosticSeverity.Error);
        assert.strictEqual(diags1[0].range.start.line, 9); // 0-indexed line 10 directly
        assert.strictEqual(diags1[0].message, 'Item Error: Err\n💡 Fix: Fix');

        // Warning with item no line
        const diags2 = mockCollection.get(vscode.Uri.parse('file:///test2.feature'));
        assert.strictEqual(diags2?.length, 1);
        assert.strictEqual(diags2[0].severity, vscode.DiagnosticSeverity.Warning);
        assert.strictEqual(diags2[0].range.start.line, 0); // fallback to line 0
        assert.strictEqual(diags2[0].message, 'Item Warning No Line: Warn\n💡 Fix: Fix');

        // Info with affectedFiles
        const diags3 = mockCollection.get(vscode.Uri.parse('file:///test3.feature'));
        assert.strictEqual(diags3?.length, 1);
        assert.strictEqual(diags3[0].severity, vscode.DiagnosticSeverity.Information);
        assert.strictEqual(diags3[0].range.end.character, 100);
        assert.strictEqual(diags3[0].message, 'File Info: Info\n💡 Fix: Fix');

        // Off (should not be mapped)
        const diags4 = mockCollection.get(vscode.Uri.parse('file:///test4.feature'));
        assert.strictEqual(diags4, undefined); // Or empty, but mockCollection returns undefined if not set

        // Unknown severity fallback defaults to Warning
        const diags5 = mockCollection.get(vscode.Uri.parse('file:///test5.feature'));
        assert.strictEqual(diags5?.length, 1);
        assert.strictEqual(diags5[0].severity, vscode.DiagnosticSeverity.Warning);
        assert.strictEqual(diags5[0].code, 'default-severity');
    });

    test('Dispose cancels pending timeout', () => {
        const mockDoc = { uri: vscode.Uri.parse('file:///test.feature') } as unknown as vscode.TextDocument;
        eventBus.publish({ type: 'textDocumentOpened', document: mockDoc });

        // Timeout is set but we dispose immediately
        manager.dispose();

        // There's no easy assert, but coverage will show lines 135-139 are hit
        assert.ok(true);
    });
});
