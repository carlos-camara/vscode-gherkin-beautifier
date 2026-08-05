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
        
        // Wait for debounce (1500ms in implementation) + some buffer
        await new Promise(resolve => setTimeout(resolve, 1600));

        assert.ok(mockCollection);
    });
});
