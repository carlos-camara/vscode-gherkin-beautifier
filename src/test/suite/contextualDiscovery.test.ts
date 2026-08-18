import * as assert from 'assert';
import * as vscode from 'vscode';
import { ContextualFeatureDiscoveryService } from '../../contextualDiscovery';
import { WorkspaceGraph } from '../../graph';

suite('Contextual Feature Discovery Test Suite', () => {
    let mockContext: vscode.ExtensionContext;
    let mockGraph: WorkspaceGraph;
    let mockGlobalState: any;
    let service: ContextualFeatureDiscoveryService;
    let commandsExecuted: string[] = [];
    let informationMessagesShown: { message: string, items: string[] }[] = [];
    let mockDiagnostics: vscode.Diagnostic[] = [];

    setup(() => {
        commandsExecuted = [];
        informationMessagesShown = [];
        mockDiagnostics = [];

        mockGlobalState = {
            state: {} as Record<string, any>,
            get: function(key: string, defaultValue?: any) {
                return this.state[key] !== undefined ? this.state[key] : defaultValue;
            },
            update: async function(key: string, value: any) {
                this.state[key] = value;
            }
        };

        mockContext = {
            subscriptions: [],
            globalState: mockGlobalState
        } as unknown as vscode.ExtensionContext;

        mockGraph = {
            getAllNodes: () => []
        } as unknown as WorkspaceGraph;

        const originalGetDiagnostics = vscode.languages.getDiagnostics;
        (vscode.languages as any).getDiagnostics = (_uri: vscode.Uri) => {
            return mockDiagnostics;
        };

        const originalShowInformationMessage = vscode.window.showInformationMessage;
        (vscode.window as any).showInformationMessage = async (message: string, ...items: string[]) => {
            informationMessagesShown.push({ message, items });
            // Always click "Try it" for tests unless specified otherwise
            return items[0];
        };

        const originalExecuteCommand = vscode.commands.executeCommand;
        (vscode.commands as any).executeCommand = async (command: string, ..._rest: any[]) => {
            commandsExecuted.push(command);
        };

        service = new ContextualFeatureDiscoveryService(mockContext, mockGraph);

        // Store originals to restore later
        (service as any)._originals = {
            getDiagnostics: originalGetDiagnostics,
            showInformationMessage: originalShowInformationMessage,
            executeCommand: originalExecuteCommand
        };
    });

    teardown(() => {
        service.dispose();
        const originals = (service as any)._originals;
        if (originals) {
            (vscode.languages as any).getDiagnostics = originals.getDiagnostics;
            (vscode.window as any).showInformationMessage = originals.showInformationMessage;
            (vscode.commands as any).executeCommand = originals.executeCommand;
        }
    });

    test('Formatter Rule triggers when there are many formatting diagnostics', async () => {
        mockDiagnostics = [
            { message: 'Trailing spaces not allowed' } as vscode.Diagnostic,
            { message: 'Wrong indentation' } as vscode.Diagnostic,
            { message: 'Multiple empty lines' } as vscode.Diagnostic,
        ];

        const mockDocument = { languageId: 'feature', uri: vscode.Uri.file('test.feature') } as vscode.TextDocument;
        (service as any).onDidSaveTextDocument(mockDocument);

        // Allow async message to process
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(informationMessagesShown.length, 1);
        assert.ok(informationMessagesShown[0].message.includes('format Gherkin files'));
        assert.strictEqual(commandsExecuted.length, 1);
        assert.strictEqual(commandsExecuted[0], 'editor.action.formatDocument');
    });

    test('Formatter Rule respects "Don\'t show again" state', async () => {
        mockGlobalState.state['discovery.formatterRule.dismissed'] = true;
        
        mockDiagnostics = [
            { message: 'Trailing spaces not allowed' } as vscode.Diagnostic,
            { message: 'Wrong indentation' } as vscode.Diagnostic,
            { message: 'Multiple empty lines' } as vscode.Diagnostic,
        ];

        const mockDocument = { languageId: 'feature', uri: vscode.Uri.file('test.feature') } as vscode.TextDocument;
        (service as any).onDidSaveTextDocument(mockDocument);

        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(informationMessagesShown.length, 0);
    });

    test('Generate Step Rule triggers when there are undefined steps', async () => {
        mockDiagnostics = [
            { message: 'Undefined step: Given something' } as vscode.Diagnostic,
            { message: 'Undefined step: When I do something' } as vscode.Diagnostic,
        ];

        const mockDocument = { languageId: 'feature', uri: vscode.Uri.file('test.feature') } as vscode.TextDocument;
        (service as any).onDidSaveTextDocument(mockDocument);

        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(informationMessagesShown.length, 1);
        assert.ok(informationMessagesShown[0].message.includes('generate Python step definitions'));
        assert.strictEqual(commandsExecuted[0], 'gherkinPowerTools.createStepDefinition');
    });

    test('Dashboard Rule triggers when there are 5 or more features', async () => {
        // Mock 5 features
        mockGraph.getAllNodes = () => [
            { type: 'Feature' } as any, { type: 'Feature' } as any, 
            { type: 'Feature' } as any, { type: 'Feature' } as any, 
            { type: 'Feature' } as any
        ];

        const mockEditor = { document: { languageId: 'feature' } } as vscode.TextEditor;
        (service as any).onDidChangeActiveTextEditor(mockEditor);

        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(informationMessagesShown.length, 2); // Includes command center rule
        const dashboardMsg = informationMessagesShown.find(m => m.message.includes('View metrics'));
        assert.ok(dashboardMsg);
        assert.ok(commandsExecuted.includes('gherkinPowerTools.showDashboard'));
    });

    test('Command Center Rule triggers on active editor change', async () => {
        const mockEditor = { document: { languageId: 'feature' } } as vscode.TextEditor;
        (service as any).onDidChangeActiveTextEditor(mockEditor);

        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(informationMessagesShown.length, 1);
        assert.ok(informationMessagesShown[0].message.includes('Command Center'));
        assert.strictEqual(commandsExecuted[0], 'gherkinPowerTools.commandCenter');
    });

    test('Does not trigger for non-gherkin files', async () => {
        mockDiagnostics = [
            { message: 'Undefined step: Given something' } as vscode.Diagnostic,
            { message: 'Undefined step: When I do something' } as vscode.Diagnostic,
        ];

        const mockDocument = { languageId: 'python', uri: vscode.Uri.file('test.py') } as vscode.TextDocument;
        (service as any).onDidSaveTextDocument(mockDocument);

        const mockEditor = { document: mockDocument } as vscode.TextEditor;
        (service as any).onDidChangeActiveTextEditor(mockEditor);

        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(informationMessagesShown.length, 0);
    });

    test('Reset clears all session and global state keys', async () => {
        // Setup state indicating dismissed
        mockGlobalState.state['discovery.formatterRule.dismissed'] = true;
        (service as any).sessionDismissed.add('formatterRule');
        
        await service.reset();

        assert.strictEqual(mockGlobalState.state['discovery.formatterRule.dismissed'], undefined);
        assert.strictEqual((service as any).sessionDismissed.has('formatterRule'), false);
    });

    test('Cancellation during dispose aborts asynchronous actions', async () => {
        let resolveMessage: (value: any) => void;
        const promiseMessage = new Promise(resolve => { resolveMessage = resolve; });
        
        (vscode.window as any).showInformationMessage = async (message: string, ...items: string[]) => {
            informationMessagesShown.push({ message, items });
            await promiseMessage; // Blocks the async operation
            return items[0]; // Resolves to 'Try it'
        };

        mockDiagnostics = [
            { message: 'Trailing spaces not allowed' } as vscode.Diagnostic,
            { message: 'Wrong indentation' } as vscode.Diagnostic,
            { message: 'Multiple empty lines' } as vscode.Diagnostic,
        ];
        const mockDocument = { languageId: 'feature', uri: vscode.Uri.file('test.feature') } as vscode.TextDocument;
        
        // Trigger it (does not await)
        (service as any).onDidSaveTextDocument(mockDocument);

        // Wait a tick to let it reach showInformationMessage
        await new Promise(resolve => setTimeout(resolve, 0));

        assert.strictEqual(informationMessagesShown.length, 1);
        
        // Dispose the service (which cancels the token)
        service.dispose();

        // Now resolve the message prompt
        resolveMessage!('Try it');
        
        // Let promises flush
        await new Promise(resolve => setTimeout(resolve, 0));

        // It should NOT have executed the command because it was cancelled
        assert.strictEqual(commandsExecuted.length, 0);
    });
});
