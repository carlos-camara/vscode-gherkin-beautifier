import * as assert from 'assert';
import * as vscode from 'vscode';
import { GherkinCodeActionProvider, createStepDefinition, serializeToPythonString, generateStepFunctionName } from '../../codeAction';
import { discoveryService } from '../../discovery';
import { RuleDiagnostic, diagnosticRegistry } from '../../rules';

function createMockDocument(text: string, uriStr: string): vscode.TextDocument {
    const lines = text.split('\n');
    return {
        languageId: 'feature',
        getText: () => text,
        lineAt: (line: number) => ({ text: lines[line] }),
        lineCount: lines.length,
        uri: vscode.Uri.parse(uriStr),
        save: async () => true
    } as any as vscode.TextDocument;
}

suite('Code Action Helper Functions Test Suite', () => {
    test('serializeToPythonString safely handles edge cases', () => {
        assert.strictEqual(serializeToPythonString("I'm logged in"), "u'I\\'m logged in'");
        assert.strictEqual(serializeToPythonString("the path is C:\\temp"), "u'the path is C:\\\\temp'");
        assert.strictEqual(serializeToPythonString('the value is "quoted"'), "u'the value is \"quoted\"'");
        assert.strictEqual(serializeToPythonString("café is available"), "u'café is available'");
        assert.strictEqual(serializeToPythonString("line one\nline two"), "u'line one\\nline two'");
        assert.strictEqual(serializeToPythonString("emoji 😀"), "u'emoji 😀'");
        assert.strictEqual(serializeToPythonString("tabs\tand\x00control"), "u'tabs\\tand\\x00control'");
    });

    test('generateStepFunctionName generates valid deterministic python identifiers', () => {
        assert.strictEqual(generateStepFunctionName("I'm logged in"), "i_m_logged_in");
        assert.strictEqual(generateStepFunctionName("the path is C:\\temp"), "the_path_is_c_temp");
        assert.strictEqual(generateStepFunctionName('the value is "quoted"'), "the_value_is_quoted");
        assert.strictEqual(generateStepFunctionName("café is available"), "caf_is_available");
        assert.strictEqual(generateStepFunctionName("123 starts with number"), "step_123_starts_with_number");
        assert.strictEqual(generateStepFunctionName("emoji 😀 test"), "emoji_test");
        assert.strictEqual(generateStepFunctionName("___lots_of__underscores___"), "lots_of_underscores");
        assert.strictEqual(generateStepFunctionName(""), "step_impl");
    });
});

suite('Code Action Provider Test Suite', () => {
    let provider: GherkinCodeActionProvider;

    setup(() => {
        provider = new GherkinCodeActionProvider();
        diagnosticRegistry.clear();
    });

    test('Provides Code Actions for misspelled keywords', () => {
        const doc = createMockDocument('Givn misspelled', 'file:///code-actions.feature');
        (doc as any).version = 1;
        const diagnostic = new RuleDiagnostic(
            new vscode.Range(0,0,0,4),
            "Misspelled keyword",
            vscode.DiagnosticSeverity.Error,
            'invalid-keyword',
            1,
            { replacementText: 'Given' }
        );
        diagnosticRegistry.set(doc.uri.toString(), [diagnostic]);

        const actions = provider.provideCodeActions(doc, new vscode.Range(0,0,0,0), { diagnostics: [] } as any, {} as any);
        assert.ok(actions);
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].title, "Replace with 'Given'");
    });

    test('Provides Code Actions for undefined steps', () => {
        const doc = createMockDocument('Then undefined step', 'file:///code-actions.feature');
        (doc as any).version = 1;
        const diagnostic = new RuleDiagnostic(
            new vscode.Range(0,0,0,19),
            "Undefined step: \"undefined step\"",
            vscode.DiagnosticSeverity.Warning,
            'undefined-step',
            1,
            { stepText: 'undefined step', stepKeyword: 'Then' }
        );
        diagnosticRegistry.set(doc.uri.toString(), [diagnostic]);

        const actions = provider.provideCodeActions(doc, new vscode.Range(0,0,0,0), { diagnostics: [] } as any, {} as any);
        assert.ok(actions);
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].title, "Create empty step definition");
        assert.strictEqual(actions[0].command?.command, 'gherkinPowerTools.createStepDefinition');
        assert.deepStrictEqual(actions[0].command?.arguments, ['undefined step', 'then', doc.uri]);
    });

    test('Resolves previous keyword for And/But steps', () => {
        const doc = createMockDocument('Given some setup\nAnd undefined step', 'file:///code-actions.feature');
        (doc as any).version = 1;
        const diagnostic = new RuleDiagnostic(
            new vscode.Range(1,0,1,18),
            "Undefined step: \"undefined step\"",
            vscode.DiagnosticSeverity.Warning,
            'undefined-step',
            1,
            { stepText: 'undefined step', stepKeyword: 'And' }
        );
        diagnosticRegistry.set(doc.uri.toString(), [diagnostic]);

        const actions = provider.provideCodeActions(doc, new vscode.Range(1,0,1,0), { diagnostics: [] } as any, {} as any);
        assert.ok(actions);
        assert.strictEqual(actions.length, 1);
        // It should resolve 'And' to 'given' because line 0 starts with 'Given'
        assert.deepStrictEqual(actions[0].command?.arguments, ['undefined step', 'given', doc.uri]);
    });

    test('Provides Code Actions for MISSING_COLON', () => {
        const doc = createMockDocument('Feature Feature name', 'file:///code-actions.feature');
        (doc as any).version = 1;
        const diagnostic = new RuleDiagnostic(
            new vscode.Range(0, 0, 0, 7),
            "Missing colon",
            vscode.DiagnosticSeverity.Error,
            'missing-colon',
            1,
            { replacementText: 'Feature:' }
        );
        diagnosticRegistry.set(doc.uri.toString(), [diagnostic]);

        const actions = provider.provideCodeActions(doc, new vscode.Range(0, 0, 0, 0), { diagnostics: [] } as any, {} as any);
        assert.ok(actions);
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].title, "Insert missing ':'");
    });

    test('Provides Code Actions for SCENARIO_WITH_EXAMPLES', () => {
        const doc = createMockDocument('Scenario: Test', 'file:///code-actions.feature');
        (doc as any).version = 1;
        const diagnostic = new RuleDiagnostic(
            new vscode.Range(0, 0, 0, 8),
            "Scenario with Examples should be Scenario Outline",
            vscode.DiagnosticSeverity.Warning,
            'scenario-with-examples',
            1
        );
        diagnosticRegistry.set(doc.uri.toString(), [diagnostic]);

        const actions = provider.provideCodeActions(doc, new vscode.Range(0, 0, 0, 0), { diagnostics: [] } as any, {} as any);
        assert.ok(actions);
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].title, "Convert to 'Scenario Outline'");
    });

    test('Provides Code Actions for INCONSISTENT_CELL_COUNT', () => {
        const doc = createMockDocument('| col1 | col2', 'file:///code-actions.feature');
        (doc as any).version = 1;
        const diagnostic = new RuleDiagnostic(
            new vscode.Range(0, 0, 0, 11),
            "Inconsistent cell count",
            vscode.DiagnosticSeverity.Warning,
            'table-inconsistency',
            1
        );
        diagnosticRegistry.set(doc.uri.toString(), [diagnostic]);

        const actions = provider.provideCodeActions(doc, new vscode.Range(0, 0, 0, 0), { diagnostics: [] } as any, {} as any);
        assert.ok(actions);
        assert.strictEqual(actions.length, 0);
    });

    test('Ignores stale diagnostics when document version changed', () => {
        const doc = createMockDocument('Givn misspelled', 'file:///code-actions-stale.feature');
        (doc as any).version = 2; // Document is newer!
        
        const diagnostic = new RuleDiagnostic(
            new vscode.Range(0,0,0,4),
            "Misspelled keyword",
            vscode.DiagnosticSeverity.Error,
            'invalid-keyword',
            1, // Stale diagnostic version!
            { replacementText: 'Given' }
        );
        diagnosticRegistry.set(doc.uri.toString(), [diagnostic]);

        const actions = provider.provideCodeActions(doc, new vscode.Range(0,0,0,0), { diagnostics: [] } as any, {} as any);
        // Should not provide actions because it is stale
        assert.strictEqual(actions.length, 0);
    });
});

suite('Safe Batch Fix All Test Suite', () => {
    let provider: GherkinCodeActionProvider;

    setup(() => {
        provider = new GherkinCodeActionProvider();
        diagnosticRegistry.clear();
    });

    test('Filters out unsafe and stale diagnostics', () => {
        const doc = createMockDocument('Feature\nScenario: Test\nThen undefined step', 'file:///fix-all-unsafe.feature');
        (doc as any).version = 1;
        
        // 1. Unsafe diagnostic (Category B/C/D)
        const d1 = new RuleDiagnostic(new vscode.Range(2,0,2,19), "Undefined step", vscode.DiagnosticSeverity.Warning, 'undefined-step', 1, { stepText: 'undefined step', stepKeyword: 'Then' });
        // 2. Stale diagnostic
        const d2 = new RuleDiagnostic(new vscode.Range(0,0,0,7), "Missing colon", vscode.DiagnosticSeverity.Error, 'missing-colon', 0, { replacementText: 'Feature:' }); // version 0 != 1
        // 3. Safe diagnostic
        const d3 = new RuleDiagnostic(new vscode.Range(1,0,1,8), "Scenario with Examples should be Scenario Outline", vscode.DiagnosticSeverity.Warning, 'scenario-with-examples', 1);

        diagnosticRegistry.set(doc.uri.toString(), [d1, d2, d3]);

        const actions = provider.provideCodeActions(doc, new vscode.Range(0,0,0,0), { only: { contains: (kind: vscode.CodeActionKind) => kind === vscode.CodeActionKind.SourceFixAll }, diagnostics: [] } as any, {} as any);
        
        assert.ok(actions);
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].title, "Fix All Safe Gherkin Issues");
        
        // Ensure the edit only contains the safe diagnostic (d3)
        const edits = actions[0].edit?.entries();
        assert.strictEqual(edits?.length, 1);
        assert.strictEqual(edits[0][1].length, 1);
        assert.strictEqual(edits[0][1][0].newText, 'Scenario Outline');
    });

    test('Conflict resolution drops overlapping edits', () => {
        const doc = createMockDocument('Givn missing colon', 'file:///fix-all-conflicts.feature');
        (doc as any).version = 1;
        
        // Two diagnostics on the exact same line that overlap.
        // D1: Missing colon (0,0 to 0,18 -> replacementText)
        const d1 = new RuleDiagnostic(new vscode.Range(0,0,0,18), "Missing colon", vscode.DiagnosticSeverity.Error, 'missing-colon', 1, { replacementText: 'Given missing colon:' });
        
        // D2: Invalid keyword (0,0 to 0,4 -> replacementText)
        const d2 = new RuleDiagnostic(new vscode.Range(0,0,0,4), "Misspelled keyword", vscode.DiagnosticSeverity.Error, 'invalid-keyword', 1, { replacementText: 'Given' });

        diagnosticRegistry.set(doc.uri.toString(), [d1, d2]);

        const actions = provider.provideCodeActions(doc, new vscode.Range(0,0,0,0), { only: { contains: (kind: vscode.CodeActionKind) => kind === vscode.CodeActionKind.SourceFixAll }, diagnostics: [] } as any, {} as any);
        
        // Only one edit should survive conflict resolution since they overlap on line 0
        const edits = actions[0].edit?.entries();
        assert.strictEqual(edits?.[0]?.[1]?.length, 1, "Should drop overlapping edit");
    });

    test('Conflict resolution applies multiple non-overlapping edits', () => {
        const doc = createMockDocument('Featur\nScenario: Test', 'file:///fix-all-no-conflicts.feature');
        (doc as any).version = 1;
        
        // Non-overlapping edits on different lines
        const d1 = new RuleDiagnostic(new vscode.Range(0,0,0,6), "Misspelled keyword", vscode.DiagnosticSeverity.Error, 'invalid-keyword', 1, { replacementText: 'Feature' });
        const d2 = new RuleDiagnostic(new vscode.Range(1,0,1,8), "Scenario with Examples", vscode.DiagnosticSeverity.Warning, 'scenario-with-examples', 1);

        diagnosticRegistry.set(doc.uri.toString(), [d1, d2]);

        const actions = provider.provideCodeActions(doc, new vscode.Range(0,0,0,0), { only: { contains: (kind: vscode.CodeActionKind) => kind === vscode.CodeActionKind.SourceFixAll }, diagnostics: [] } as any, {} as any);
        
        const edits = actions[0].edit?.entries();
        assert.strictEqual(edits?.[0]?.[1]?.length, 2, "Should apply both non-overlapping edits");
    });
});

suite('createStepDefinition Test Suite', () => {
    let originalShowInformationMessage: any;
    let originalShowQuickPick: any;
    let originalShowErrorMessage: any;
    let originalWorkspaceFolders: any;
    let originalFs: any;
    let originalApplyEdit: any;
    let originalShowTextDocument: any;
    let originalOpenTextDocument: any;

    let originalGetStepFiles: any;
    let originalGetBestWorkspaceFolder: any;

    setup(() => {
        originalGetStepFiles = discoveryService.getStepFiles.bind(discoveryService);
        originalGetBestWorkspaceFolder = discoveryService.getBestWorkspaceFolder.bind(discoveryService);
        originalShowInformationMessage = vscode.window.showInformationMessage;
        originalShowQuickPick = vscode.window.showQuickPick;
        originalShowErrorMessage = vscode.window.showErrorMessage;
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        originalFs = vscode.workspace.fs;
        originalApplyEdit = vscode.workspace.applyEdit;
        originalShowTextDocument = vscode.window.showTextDocument;
        originalOpenTextDocument = vscode.workspace.openTextDocument;
    });

    teardown(() => {
        discoveryService.getStepFiles = originalGetStepFiles;
        discoveryService.getBestWorkspaceFolder = originalGetBestWorkspaceFolder;
        (vscode.window as any).showInformationMessage = originalShowInformationMessage;
        (vscode.window as any).showQuickPick = originalShowQuickPick;
        (vscode.window as any).showErrorMessage = originalShowErrorMessage;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => originalWorkspaceFolders });
        Object.defineProperty(vscode.workspace, 'fs', { get: () => originalFs });
        (vscode.workspace as any).applyEdit = originalApplyEdit;
        (vscode.window as any).showTextDocument = originalShowTextDocument;
        (vscode.workspace as any).openTextDocument = originalOpenTextDocument;
    });

    test('Shows error message if no workspace is opened', async () => {
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => undefined });
        let errorMessage = '';
        discoveryService.getStepFiles = async () => [];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];
        (vscode.window as any).showErrorMessage = async (msg: string) => { errorMessage = msg; };
        discoveryService.getBestWorkspaceFolder = () => undefined;

        await createStepDefinition('step', 'Given');

        assert.strictEqual(errorMessage, 'Open a workspace to create step definitions.');
    });


    test('Shows QuickPick for ambiguous URI in multi-root workspace and aborts if cancelled', async () => {
        let quickPickShown = false;
        discoveryService.getStepFiles = async () => [];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => [{ uri: vscode.Uri.file('/folder1'), name: 'folder1', index: 0 }, { uri: vscode.Uri.file('/folder2'), name: 'folder2', index: 1 }] });
        discoveryService.getBestWorkspaceFolder = () => undefined;

        (vscode.window as any).showQuickPick = async (_items: any[]) => {
            quickPickShown = true;
            return undefined; // simulate cancel
        };

        const result = await createStepDefinition('step', 'Given');
        assert.strictEqual(quickPickShown, true);
        assert.strictEqual(result, undefined);
    });

    test('Shows QuickPick for ambiguous URI in multi-root workspace and uses selected folder', async () => {
        let quickPickShown = false;
        let infoMessage = '';
        discoveryService.getStepFiles = async () => [];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];

        const folder1 = { uri: vscode.Uri.file('/folder1'), name: 'folder1', index: 0 };
        const folder2 = { uri: vscode.Uri.file('/folder2'), name: 'folder2', index: 1 };
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => [folder1, folder2] });
        discoveryService.getBestWorkspaceFolder = () => undefined;

        (vscode.window as any).showQuickPick = async (items: any[]) => {
            quickPickShown = true;
            return items[1]; // select folder2
        };

        (vscode.window as any).showInformationMessage = async (msg: string, _action: string) => {
            infoMessage = msg;
            return undefined; // simulate cancel on 'Would you like to create one?'
        };

        await createStepDefinition('step', 'Given');
        assert.strictEqual(quickPickShown, true);
        assert.strictEqual(infoMessage.includes('Would you like to create one?'), true);
    });

    test('Creates a new file if none exists and user confirms', async () => {
        let infoMessage = '';
        let directoryCreated = false;
        let editApplied = false;

        discoveryService.getStepFiles = async () => [];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];
        (vscode.window as any).showInformationMessage = async (msg: string, action: string) => {
            infoMessage = msg;
            return action;
        };
        discoveryService.getBestWorkspaceFolder = () => ({ uri: vscode.Uri.file('/tmp'), name: 'tmp', index: 0 });

        Object.defineProperty(vscode.workspace, 'fs', { get: () => ({
            createDirectory: async () => { directoryCreated = true; },
            readFile: async () => { throw new Error('Not found'); },
            stat: async () => { throw new Error('Not found'); }
        })});

        (vscode.workspace as any).applyEdit = async () => { editApplied = true; return true; };
        (vscode.workspace as any).openTextDocument = async () => createMockDocument('', 'file:///tmp/features/steps/step_definitions.py');
        (vscode.window as any).showTextDocument = async () => ({
            document: { lineCount: 1, lineAt: () => ({text: ''}) },
            revealRange: () => {}
        } as any);

        await createStepDefinition('I test new file', 'Given');

        assert.ok(infoMessage.includes('Would you like to create one?'));
        assert.ok(directoryCreated, "Should have created directory");
        assert.ok(editApplied, "Should have applied workspace edit without saving");
    });

    test('Appends without collision to an existing file', async () => {
        let editApplied = false;

        discoveryService.getStepFiles = async () => [vscode.Uri.file('/tmp/file1.py')];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];

        Object.defineProperty(vscode.workspace, 'fs', { get: () => ({
            readFile: async () => Buffer.from("def i_test_collision(context):\n    pass\n"),
            stat: async () => { throw new Error('Not found'); }
        })});

        let insertedText = '';
        (vscode.workspace as any).applyEdit = async (edit: vscode.WorkspaceEdit) => {
            editApplied = true;
            insertedText = edit.entries()[0][1][0].newText;
            return true;
        };
        (vscode.workspace as any).openTextDocument = async () => createMockDocument('', 'file:///tmp/file1.py');
        (vscode.window as any).showTextDocument = async () => ({
            document: { lineCount: 1, lineAt: () => ({text: ''}) },
            revealRange: () => {}
        } as any);

        await createStepDefinition('I test collision', 'Given');

        assert.ok(editApplied);
        // Because i_test_collision exists, it should generate i_test_collision_1
        assert.ok(insertedText.includes('def i_test_collision_1(context):'));
    });

    test('Shows quick pick when multiple files exist and user selects one', async () => {
        let editApplied = false;
        discoveryService.getStepFiles = async () => [
            vscode.Uri.file('/tmp/file1.py'),
            vscode.Uri.file('/tmp/file2.py')
        ];

        let quickPickItems: any[] = [];
        (vscode.window as any).showQuickPick = async (items: any[]) => {
            quickPickItems = items;
            return items[1]; // Select the second one
        };

        Object.defineProperty(vscode.workspace, 'fs', { get: () => ({
            readFile: async () => Buffer.from("")
        })});

        let targetFileStr = '';
        (vscode.workspace as any).applyEdit = async (edit: vscode.WorkspaceEdit) => {
            editApplied = true;
            targetFileStr = edit.entries()[0][0].toString();
            return true;
        };
        (vscode.workspace as any).openTextDocument = async () => createMockDocument('', 'file:///tmp/file2.py');
        (vscode.window as any).showTextDocument = async () => ({
            document: { lineCount: 1, lineAt: () => ({text: ''}) },
            revealRange: () => {}
        } as any);

        await createStepDefinition('I test multiple files', 'Given');

        assert.strictEqual(quickPickItems.length, 2);
        assert.ok(editApplied);
        assert.ok(targetFileStr.endsWith('file2.py'));
    });

    test('Cancels step creation if user cancels quick pick', async () => {
        let editApplied = false;
        discoveryService.getStepFiles = async () => [
            vscode.Uri.file('/tmp/file1.py'),
            vscode.Uri.file('/tmp/file2.py')
        ];

        (vscode.window as any).showQuickPick = async () => undefined; // Cancel
        (vscode.workspace as any).applyEdit = async () => { editApplied = true; return true; };

        await createStepDefinition('I test cancel quick pick', 'Given');

        assert.strictEqual(editApplied, false);
    });

    test('Cancels step creation if user cancels creation prompt', async () => {
        let editApplied = false;
        discoveryService.getStepFiles = async () => [];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py']; // No files
        (vscode.window as any).showInformationMessage = async () => undefined; // Cancel prompt
        (vscode.workspace as any).applyEdit = async () => { editApplied = true; return true; };
        discoveryService.getBestWorkspaceFolder = () => ({ uri: vscode.Uri.file('/tmp'), name: 'tmp', index: 0 });

        await createStepDefinition('I test cancel prompt', 'Given');

        assert.strictEqual(editApplied, false);
    });



    test('createStepDefinition aborts safely if target is unreadable', async () => {
        discoveryService.getStepFiles = async () => [vscode.Uri.file('/tmp/file1.py')];
        let errorShown = false;
        const originalShowErrorMessage = (vscode.window as any).showErrorMessage;
        (vscode.window as any).showErrorMessage = async () => {
            errorShown = true;
        };

        const originalFs = vscode.workspace.fs;
        Object.defineProperty(vscode.workspace, 'fs', {
            get: () => ({
                readFile: async () => { throw new Error('Permission denied'); },
                stat: async () => { throw new Error('Not found'); },
                readDirectory: originalFs.readDirectory,
                writeFile: originalFs.writeFile,
                createDirectory: originalFs.createDirectory,
                delete: originalFs.delete,
                rename: originalFs.rename,
                copy: originalFs.copy
            }),
            configurable: true
        });

        const result = await createStepDefinition('I test unreadable file', 'Given');

        Object.defineProperty(vscode.workspace, 'fs', { get: () => originalFs, configurable: true });
        (vscode.window as any).showErrorMessage = originalShowErrorMessage;

        assert.strictEqual(result, undefined, 'Should return undefined if read fails');
        assert.ok(errorShown, 'Should display an error message');
    });

    test('createStepDefinition prioritizes unsaved editor content over disk', async () => {
        discoveryService.getStepFiles = async () => [vscode.Uri.file('/tmp/file1.py')];
        let editApplied = false;
        let insertedText = '';

        const originalTextDocuments = vscode.workspace.textDocuments;
        Object.defineProperty(vscode.workspace, 'textDocuments', {
            get: () => [{
                uri: vscode.Uri.file('/tmp/file1.py'),
                getText: () => 'from behave import *\n\n@given("existing")\ndef existing(context):\n    pass\n',
                lineCount: 5,
                lineAt: () => ({text: '    pass'}),
                save: async () => true
            }],
            configurable: true
        });

        const originalFs = vscode.workspace.fs;
        Object.defineProperty(vscode.workspace, 'fs', {
            get: () => ({
                readFile: async () => { throw new Error('Should not be called because open doc exists'); },
                stat: async () => ({}),
                readDirectory: originalFs.readDirectory,
                writeFile: originalFs.writeFile,
                createDirectory: originalFs.createDirectory,
                delete: originalFs.delete,
                rename: originalFs.rename,
                copy: originalFs.copy
            }),
            configurable: true
        });

        const originalApplyEdit = vscode.workspace.applyEdit;
        (vscode.workspace as any).applyEdit = async (edit: vscode.WorkspaceEdit) => {
            editApplied = true;
            for (const [, edits] of (edit as any).entries()) {
                insertedText = edits[0].newText;
            }
            return true;
        };

        const originalOpenTextDocument = vscode.workspace.openTextDocument;
        (vscode.workspace as any).openTextDocument = async () => ({
            lineCount: 1,
            lineAt: () => ({text: ''}),
            save: async () => true,
        });

        const originalShowTextDocument = vscode.window.showTextDocument;
        (vscode.window as any).showTextDocument = async () => ({
            document: { lineCount: 1, lineAt: () => ({text: ''}) },
            revealRange: () => {}
        });

        await createStepDefinition('I test unsaved content', 'Given');

        Object.defineProperty(vscode.workspace, 'textDocuments', { get: () => originalTextDocuments, configurable: true });
        Object.defineProperty(vscode.workspace, 'fs', { get: () => originalFs, configurable: true });
        (vscode.workspace as any).applyEdit = originalApplyEdit;
        (vscode.workspace as any).openTextDocument = originalOpenTextDocument;
        (vscode.window as any).showTextDocument = originalShowTextDocument;

        assert.ok(editApplied);
        assert.ok(insertedText.includes('def i_test_unsaved_content(context):'));
        assert.strictEqual(insertedText.startsWith('\n@given('), true, 'Should append with correct newline based on open document text');
    });
});

suite('batchCreateStepDefinitions Test Suite', () => {
    let originalShowInformationMessage: any;
    let originalShowQuickPick: any;
    let originalShowErrorMessage: any;
    let originalWorkspaceFolders: any;
    let originalFs: any;
    let originalApplyEdit: any;
    let originalShowTextDocument: any;
    let originalOpenTextDocument: any;

    let originalGetStepFiles: any;
    let originalGetBestWorkspaceFolder: any;

    setup(() => {
        originalGetStepFiles = discoveryService.getStepFiles.bind(discoveryService);
        originalGetBestWorkspaceFolder = discoveryService.getBestWorkspaceFolder.bind(discoveryService);
        originalShowInformationMessage = vscode.window.showInformationMessage;
        originalShowQuickPick = vscode.window.showQuickPick;
        originalShowErrorMessage = vscode.window.showErrorMessage;
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        originalFs = vscode.workspace.fs;
        originalApplyEdit = vscode.workspace.applyEdit;
        originalShowTextDocument = vscode.window.showTextDocument;
        originalOpenTextDocument = vscode.workspace.openTextDocument;
    });

    teardown(() => {
        discoveryService.getStepFiles = originalGetStepFiles;
        discoveryService.getBestWorkspaceFolder = originalGetBestWorkspaceFolder;
        (vscode.window as any).showInformationMessage = originalShowInformationMessage;
        (vscode.window as any).showQuickPick = originalShowQuickPick;
        (vscode.window as any).showErrorMessage = originalShowErrorMessage;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => originalWorkspaceFolders });
        Object.defineProperty(vscode.workspace, 'fs', { get: () => originalFs });
        (vscode.workspace as any).applyEdit = originalApplyEdit;
        (vscode.workspace as any).showTextDocument = originalShowTextDocument;
        (vscode.workspace as any).openTextDocument = originalOpenTextDocument;
    });

    test('Returns undefined if steps array is empty', async () => {
        const { batchCreateStepDefinitions } = require('../../codeAction');
        const res = await batchCreateStepDefinitions([]);
        assert.strictEqual(res, undefined);
    });

    test('Shows error if no workspace is opened (batch)', async () => {
        const { batchCreateStepDefinitions } = require('../../codeAction');
        let errorMessage = '';
        discoveryService.getStepFiles = async () => [];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];
        (vscode.window as any).showErrorMessage = async (msg: string) => { errorMessage = msg; };
        discoveryService.getBestWorkspaceFolder = () => undefined;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { get: () => undefined });

        await batchCreateStepDefinitions([{text: 'step', keyword: 'Given'}]);
        assert.strictEqual(errorMessage, 'Open a workspace to create step definitions.');
    });

    test('Cancels batch creation if user cancels new file prompt', async () => {
        const { batchCreateStepDefinitions } = require('../../codeAction');
        let editApplied = false;
        discoveryService.getStepFiles = async () => [];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];
        (vscode.window as any).showInformationMessage = async () => undefined;
        discoveryService.getBestWorkspaceFolder = () => ({ uri: vscode.Uri.file('/tmp'), name: 'tmp', index: 0 });
        (vscode.workspace as any).applyEdit = async () => { editApplied = true; return true; };

        await batchCreateStepDefinitions([{text: 'step', keyword: 'Given'}]);
        assert.strictEqual(editApplied, false);
    });

    test('Cancels batch creation if user cancels quick pick', async () => {
        const { batchCreateStepDefinitions } = require('../../codeAction');
        let editApplied = false;
        discoveryService.getStepFiles = async () => [
            vscode.Uri.file('/tmp/file1.py'),
            vscode.Uri.file('/tmp/file2.py')
        ];
        (vscode.window as any).showQuickPick = async () => undefined;
        (vscode.workspace as any).applyEdit = async () => { editApplied = true; return true; };

        await batchCreateStepDefinitions([{text: 'step', keyword: 'Given'}]);
        assert.strictEqual(editApplied, false);
    });

    test('Appends multiple unique steps to selected file', async () => {
        const { batchCreateStepDefinitions } = require('../../codeAction');
        let editApplied = false;
        discoveryService.getStepFiles = async () => [
            vscode.Uri.file('/tmp/file1.py'),
            vscode.Uri.file('/tmp/file2.py')
        ];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];
        (vscode.window as any).showQuickPick = async (items: any[]) => items[0]; // Select first file

        Object.defineProperty(vscode.workspace, 'fs', { get: () => ({
            readFile: async () => Buffer.from("def dummy():\n    pass\n"),
            stat: async () => ({})
        })});

        let insertedText = '';
        (vscode.workspace as any).applyEdit = async (edit: vscode.WorkspaceEdit) => {
            editApplied = true;
            insertedText = edit.entries()[0][1][0].newText;
            return true;
        };

        (vscode.workspace as any).openTextDocument = async () => createMockDocument('', 'file:///tmp/file1.py');
        (vscode.window as any).showTextDocument = async () => ({
            document: { lineCount: 1, lineAt: () => ({text: ''}) },
            revealRange: () => {}
        } as any);
        (vscode.window as any).showInformationMessage = async () => {};

        await batchCreateStepDefinitions([
            {text: 'first step', keyword: 'Given'},
            {text: 'second step', keyword: 'When'},
            {text: 'first step', keyword: 'Given'} // Duplicate should be ignored
        ]);

        assert.ok(editApplied);
        assert.ok(insertedText.includes('def first_step(context):'));
        assert.ok(insertedText.includes('def second_step(context):'));
        // Count how many times @given(u'first step') appears
        const occurrences = (insertedText.match(/@given\(u'first step'\)/g) || []).length;
        assert.strictEqual(occurrences, 1, "Duplicate steps should not generate duplicate definitions");
    });

    test('Batch creation with new file', async () => {
        const { batchCreateStepDefinitions } = require('../../codeAction');
        let directoryCreated = false;
        let editApplied = false;
        let insertedText = '';

        discoveryService.getStepFiles = async () => [];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];
        discoveryService.getStepGlobs = () => ['**/features/steps/**/*.py'];
        (vscode.window as any).showInformationMessage = async (_msg: string, action: string) => {
            if (action) return action; // Return the create action
            return undefined;
        };
        discoveryService.getBestWorkspaceFolder = () => ({ uri: vscode.Uri.file('/tmp'), name: 'tmp', index: 0 });

        Object.defineProperty(vscode.workspace, 'fs', { get: () => ({
            createDirectory: async () => { directoryCreated = true; },
            readFile: async () => { throw new Error('Not found'); },
            stat: async () => { throw new Error('Not found'); }
        })});

        (vscode.workspace as any).applyEdit = async (edit: vscode.WorkspaceEdit) => {
            editApplied = true;
            insertedText = edit.entries()[0][1][0].newText;
            return true;
        };
        (vscode.workspace as any).openTextDocument = async () => createMockDocument('', 'file:///tmp/features/steps/step_definitions.py');
        (vscode.window as any).showTextDocument = async () => ({
            document: { lineCount: 1, lineAt: () => ({text: ''}) },
            revealRange: () => {}
        } as any);

        await batchCreateStepDefinitions([
            {text: 'some step', keyword: 'Then'}
        ]);

        assert.ok(directoryCreated);
        assert.ok(editApplied);
        assert.ok(insertedText.includes('from behave import given, when, then, step'));
        assert.ok(insertedText.includes("@then(u'some step')"));
    });
});
