import * as vscode from 'vscode';

import { dialectService } from './dialect';
import { discoveryService } from './discovery';

export class GherkinCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.RefactorExtract
    ];

    public provideCodeActions(document: vscode.TextDocument, _range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, _token: vscode.CancellationToken): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        // Instead of only using context.diagnostics (which strictly intersect the cursor),
        // fetch all diagnostics for the file and include any that are on the same line.
        // This ensures the lightbulb appears anywhere on the line, even if a whole-line 
        // diagnostic (like Syntax Error) shadows a more precise word-level diagnostic.
        const allDiagnostics = vscode.languages.getDiagnostics(document.uri);
        const lineDiagnostics = allDiagnostics.filter(d => 
            d.range.start.line <= _range.end.line && d.range.end.line >= _range.start.line
        );
        
        // Merge context diagnostics with line diagnostics to ensure we don't miss any,
        // then deduplicate by object reference.
        const relevantDiagnostics = Array.from(new Set([...context.diagnostics, ...lineDiagnostics]));

        for (const diagnostic of relevantDiagnostics) {
            if (diagnostic.code === 'missing-colon') {
                const action = new vscode.CodeAction("Insert missing ':'", vscode.CodeActionKind.QuickFix);
                action.edit = new vscode.WorkspaceEdit();
                const replacement = diagnostic.relatedInformation?.[0]?.message || '';
                if (replacement) {
                    action.edit.replace(document.uri, diagnostic.range, replacement);
                    action.diagnostics = [diagnostic];
                    action.isPreferred = true;
                    actions.push(action);
                }
            } else if (diagnostic.code === 'invalid-keyword') {
                const replacement = diagnostic.relatedInformation?.[0]?.message || '';
                if (replacement) {
                    const action = new vscode.CodeAction(`Replace with '${replacement}'`, vscode.CodeActionKind.QuickFix);
                    action.edit = new vscode.WorkspaceEdit();
                    action.edit.replace(document.uri, diagnostic.range, replacement);
                    action.diagnostics = [diagnostic];
                    action.isPreferred = true;
                    actions.push(action);
                }
            } else if (diagnostic.code === 'scenario-with-examples') {
                const action = new vscode.CodeAction("Convert to 'Scenario Outline'", vscode.CodeActionKind.QuickFix);
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, diagnostic.range, 'Scenario Outline');
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                actions.push(action);
            } else if (diagnostic.code === 'table-inconsistency') {
                const lineIndex = diagnostic.range.start.line;
                const line = document.lineAt(lineIndex);
                const lineText = line.text;

                // Find the header row to determine expected cell count
                let headerLineIndex = lineIndex;
                while (headerLineIndex > 0) {
                    const prevLineText = document.lineAt(headerLineIndex - 1).text.trim();
                    if (!prevLineText.startsWith('|')) {
                        break;
                    }
                    headerLineIndex--;
                }

                if (headerLineIndex !== lineIndex) {
                    const headerText = document.lineAt(headerLineIndex).text;
                    const expectedCells = (headerText.match(/\|/g) || []).length;
                    const currentCells = (lineText.match(/\|/g) || []).length;
                    
                    if (currentCells > expectedCells) {
                        // Extra columns: find the Nth pipe and truncate
                        let pipeCount = 0;
                        let truncateIndex = -1;
                        for (let i = 0; i < lineText.length; i++) {
                            if (lineText[i] === '|') {
                                pipeCount++;
                                if (pipeCount === expectedCells) {
                                    truncateIndex = i;
                                    break;
                                }
                            }
                        }
                        
                        if (truncateIndex !== -1) {
                            const action = new vscode.CodeAction("Remove extra cells", vscode.CodeActionKind.QuickFix);
                            action.edit = new vscode.WorkspaceEdit();
                            const fixedText = lineText.substring(0, truncateIndex + 1);
                            action.edit.replace(document.uri, line.range, fixedText);
                            action.diagnostics = [diagnostic];
                            action.isPreferred = true;
                            actions.push(action);
                        }
                    } else if (currentCells < expectedCells) {
                        // Missing columns
                        const action = new vscode.CodeAction("Add missing cells", vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        
                        const missingPipes = expectedCells - currentCells;
                        let fixedText = lineText;
                        
                        if (!fixedText.trim().endsWith('|')) {
                            fixedText += ' |';
                            for (let i = 0; i < missingPipes - 1; i++) {
                                fixedText += '   |';
                            }
                        } else {
                            for (let i = 0; i < missingPipes; i++) {
                                fixedText += '   |';
                            }
                        }
                        
                        action.edit.replace(document.uri, line.range, fixedText);
                        action.diagnostics = [diagnostic];
                        action.isPreferred = true;
                        actions.push(action);
                    }
                }
            } else if (diagnostic.code === 'undefined-step') {
                const action = new vscode.CodeAction('Create empty step definition', vscode.CodeActionKind.QuickFix);

                // Retrieve the keyword from relatedInformation
                const keyword = diagnostic.relatedInformation && diagnostic.relatedInformation.length > 0
                    ? diagnostic.relatedInformation[0].message
                    : 'step';

                let pyKeyword = keyword.toLowerCase().trim();
                const dialect = dialectService.getDialect(document);

                const andKeywords = dialect.and.map(k => k.trim().toLowerCase());
                const butKeywords = dialect.but.map(k => k.trim().toLowerCase());
                const isContinuation = andKeywords.includes(pyKeyword) || butKeywords.includes(pyKeyword) || pyKeyword === '*';

                // Resolve semantic keyword if it's a continuation
                if (isContinuation) {
                    pyKeyword = dialectService.resolveAndBut(document, diagnostic.range.start.line);
                } else {
                    const givenKeywords = dialect.given.map(k => k.trim().toLowerCase());
                    const whenKeywords = dialect.when.map(k => k.trim().toLowerCase());
                    const thenKeywords = dialect.then.map(k => k.trim().toLowerCase());
                    if (givenKeywords.includes(pyKeyword)) pyKeyword = 'given';
                    else if (whenKeywords.includes(pyKeyword)) pyKeyword = 'when';
                    else if (thenKeywords.includes(pyKeyword)) pyKeyword = 'then';
                    else pyKeyword = 'step';
                }

                // Extract step text
                const stepTextMatch = diagnostic.message.match(/Undefined step: "(.*)"/);
                const stepText = stepTextMatch ? stepTextMatch[1] : '';

                action.command = {
                    command: 'gherkinPowerTools.createStepDefinition',
                    title: 'Create empty step definition',
                    arguments: [stepText, pyKeyword, document.uri]
                };
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                actions.push(action);
            }
        }

        // Add Refactoring actions if the user selects multiple lines in a feature file
        if (!_range.isEmpty && _range.start.line !== _range.end.line && document.uri.toString().endsWith('.feature')) {
            const extractAction = new vscode.CodeAction('Extract Steps to new definition', vscode.CodeActionKind.RefactorExtract);
            extractAction.command = {
                command: 'gherkinPowerTools.refactor.extractStep',
                title: 'Extract Step'
            };
            actions.push(extractAction);
        }

        return actions;
    }
}

/**
 * Serializes arbitrary text to a safe Python string literal (e.g. u'Hello').
 */
export function serializeToPythonString(text: string): string {
    let escaped = text.replace(/\\/g, '\\\\');
    escaped = escaped.replace(/'/g, "\\'");
    escaped = escaped.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    escaped = escaped.replace(/[\x00-\x1F\x7F-\x9F]/g, char => '\\x' + ('00' + char.charCodeAt(0).toString(16)).slice(-2));
    return `u'${escaped}'`;
}

/**
 * Extracts parameters (quoted strings, standalone numbers) from step text.
 * Returns the modified pattern string and the list of parameter names.
 */
function extractStepParameters(text: string): { pattern: string, funcArgs: string[] } {
    let pattern = text;
    const funcArgs: string[] = [];
    let paramIndex = 1;

    // 1. Extract double-quoted strings
    pattern = pattern.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, () => {
        const argName = `arg${paramIndex++}`;
        funcArgs.push(argName);
        return `"{${argName}}"`;
    });

    // 2. Extract integers/decimals (only if they are standalone)
    // Avoid replacing numbers inside `{arg1}` markers
    pattern = pattern.replace(/(^|[^a-zA-Z0-9_{])(\d+(?:\.\d+)?)(?=[^a-zA-Z0-9_}]|$)/g, (_match, p1) => {
        const argName = `arg${paramIndex++}`;
        funcArgs.push(argName);
        return `${p1}{${argName}}`;
    });

    return { pattern, funcArgs };
}

/**
 * Generates a deterministic, valid, non-colliding Python function name.
 */
export function generateStepFunctionName(text: string): string {
    // Replace non-alphanumeric chars (including unicode emojis) with underscore
    let name = text.replace(/[^a-zA-Z0-9]/g, '_');
    // Collapse multiple underscores
    name = name.replace(/_+/g, '_');
    // Trim underscores from start and end
    name = name.replace(/^_|_$/g, '');
    name = name.toLowerCase();

    // Must start with a letter or underscore
    if (!name || /^[0-9]/.test(name)) {
        name = 'step_' + (name || 'impl');
    }
    return name;
}

/**
 * Handles the creation of a new Python step definition.
 */
export async function createStepDefinition(stepText: string, keyword: string, documentUri?: vscode.Uri): Promise<vscode.Uri | undefined> {
    if (!stepText) return undefined;

    let pyKeyword = keyword.toLowerCase().trim();
    if (!['given', 'when', 'then', 'step'].includes(pyKeyword)) {
        pyKeyword = 'step';
    }

    const pyFiles = await discoveryService.getStepFiles();

    let targetUri: vscode.Uri | undefined;
    let isNewFile = false;

    if (pyFiles.length === 0) {
        // Find workspace folder
        let workspaceFolder = documentUri ? discoveryService.getBestWorkspaceFolder(documentUri) : undefined;

        if (!workspaceFolder && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            if (vscode.workspace.workspaceFolders.length === 1) {
                workspaceFolder = vscode.workspace.workspaceFolders[0];
            } else {
                const items = vscode.workspace.workspaceFolders.map(folder => ({
                    label: folder.name,
                    description: folder.uri.fsPath,
                    folder: folder
                }));
                const selection = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select a workspace folder to create step definitions in'
                });
                if (selection) {
                    workspaceFolder = selection.folder;
                } else {
                    return undefined;
                }
            }
        }

        if (!workspaceFolder) {
            vscode.window.showErrorMessage("Open a workspace to create step definitions.");
            return undefined;
        }

        const defaultStepsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'features', 'steps');
        targetUri = vscode.Uri.joinPath(defaultStepsDir, 'step_definitions.py');

        const createAction = "Create features/steps/step_definitions.py";
        const selection = await vscode.window.showInformationMessage(
            "No Python step files found. Would you like to create one?",
            createAction
        );

        if (selection === createAction) {
            await vscode.workspace.fs.createDirectory(defaultStepsDir);
            // We'll write the initial content below using WorkspaceEdit
            isNewFile = true;
        } else {
            return;
        }
    } else if (pyFiles.length === 1) {
        targetUri = pyFiles[0];
    } else {
        const items = pyFiles.map(uri => ({
            label: vscode.workspace.asRelativePath(uri),
            uri: uri
        }));

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a Python file to append the step definition to'
        });

        if (selection) {
            targetUri = selection.uri;
        } else {
            return;
        }
    }

    if (targetUri) {
        let fileContent = '';
        if (!isNewFile) {
            try {
                const data = await vscode.workspace.fs.readFile(targetUri);
                fileContent = Buffer.from(data).toString('utf8');
            } catch(e) {}
        }

        const { pattern, funcArgs } = extractStepParameters(stepText);
        const safeString = serializeToPythonString(pattern);
        const baseFuncName = generateStepFunctionName(stepText);

        let funcName = baseFuncName;
        let suffix = 1;
        while (new RegExp(`^def\\s+${funcName}\\s*\\(`, 'm').test(fileContent)) {
            funcName = `${baseFuncName}_${suffix}`;
            suffix++;
        }

        let snippet = '';
        if (isNewFile) {
            snippet = `from behave import given, when, then, step\n\n`;
        } else {
            snippet = fileContent.length === 0 || fileContent.endsWith('\n') ? '\n' : '\n\n';
        }

        const argsString = ['context', ...funcArgs].join(', ');
        snippet += `@${pyKeyword}(${safeString})\ndef ${funcName}(${argsString}):\n    raise NotImplementedError(${safeString})\n`;

        const edit = new vscode.WorkspaceEdit();
        if (isNewFile) {
            edit.createFile(targetUri, { ignoreIfExists: true });
            edit.insert(targetUri, new vscode.Position(0, 0), snippet);
        } else {
            // Document might be open, calculate end position
            let lineCount = 0;
            let lastLineLength = 0;
            try {
                const openDoc = await vscode.workspace.openTextDocument(targetUri);
                lineCount = openDoc.lineCount;
                lastLineLength = lineCount > 0 ? openDoc.lineAt(lineCount - 1).text.length : 0;
            } catch(e) {
                const lines = fileContent.split('\n');
                lineCount = lines.length;
                lastLineLength = lines[lines.length - 1].length;
            }
            const lastLine = lineCount > 0 ? lineCount - 1 : 0;
            const endPos = new vscode.Position(lastLine, lastLineLength);
            edit.insert(targetUri, endPos, snippet);
        }

        await vscode.workspace.applyEdit(edit);

        // Intentionally DO NOT auto-save here (per user request).
        // Let the user review the unsaved file.
        const document = await vscode.workspace.openTextDocument(targetUri);
        const editor = await vscode.window.showTextDocument(document);

        const newEndPos = new vscode.Position(editor.document.lineCount - 1, editor.document.lineAt(editor.document.lineCount - 1).text.length);
        editor.selection = new vscode.Selection(newEndPos, newEndPos);
        editor.revealRange(new vscode.Range(newEndPos, newEndPos));

        return targetUri;
    }
    return undefined;
}

/**
 * Handles batch creation of missing Python step definitions.
 */
export async function batchCreateStepDefinitions(steps: {text: string, keyword: string}[], documentUri?: vscode.Uri): Promise<vscode.Uri | undefined> {
    if (!steps || steps.length === 0) return undefined;

    const pyFiles = await discoveryService.getStepFiles();
    let targetUri: vscode.Uri | undefined;
    let isNewFile = false;

    if (pyFiles.length === 0) {
        let workspaceFolder = documentUri ? discoveryService.getBestWorkspaceFolder(documentUri) : undefined;
        if (!workspaceFolder && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            if (vscode.workspace.workspaceFolders.length === 1) {
                workspaceFolder = vscode.workspace.workspaceFolders[0];
            } else {
                const items = vscode.workspace.workspaceFolders.map(folder => ({
                    label: folder.name,
                    description: folder.uri.fsPath,
                    folder: folder
                }));
                const selection = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select a workspace folder to create step definitions in'
                });
                if (selection) {
                    workspaceFolder = selection.folder;
                } else {
                    return undefined;
                }
            }
        }
        if (!workspaceFolder) {
            vscode.window.showErrorMessage("Open a workspace to create step definitions.");
            return undefined;
        }

        const defaultStepsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'features', 'steps');
        targetUri = vscode.Uri.joinPath(defaultStepsDir, 'step_definitions.py');

        const createAction = "Create features/steps/step_definitions.py";
        const selection = await vscode.window.showInformationMessage(
            "No Python step files found. Would you like to create one for all undefined steps?",
            createAction
        );

        if (selection === createAction) {
            await vscode.workspace.fs.createDirectory(defaultStepsDir);
            isNewFile = true;
        } else {
            return;
        }
    } else if (pyFiles.length === 1) {
        targetUri = pyFiles[0];
    } else {
        const items = pyFiles.map(uri => ({
            label: vscode.workspace.asRelativePath(uri),
            uri: uri
        }));

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a Python file to append the step definitions to'
        });

        if (selection) {
            targetUri = selection.uri;
        } else {
            return;
        }
    }

    if (targetUri) {
        let fileContent = '';
        if (!isNewFile) {
            try {
                const data = await vscode.workspace.fs.readFile(targetUri);
                fileContent = Buffer.from(data).toString('utf8');
            } catch(e) {}
        }

        let snippet = '';
        if (isNewFile) {
            snippet = `from behave import given, when, then, step\n\n`;
        } else {
            snippet = fileContent.length === 0 || fileContent.endsWith('\n') ? '\n' : '\n\n';
        }

        const generatedPatterns = new Set<string>();
        let addedCount = 0;

        for (const step of steps) {
            const { pattern, funcArgs } = extractStepParameters(step.text);

            // Avoid generating duplicate patterns in the same batch or if they already exist
            if (generatedPatterns.has(pattern)) continue;

            // Check if it already exists in the file (basic check)
            const safeString = serializeToPythonString(pattern);
            if (fileContent.includes(safeString)) {
                continue;
            }

            generatedPatterns.add(pattern);
            addedCount++;

            let pyKeyword = step.keyword.toLowerCase().trim();
            if (!['given', 'when', 'then', 'step'].includes(pyKeyword)) {
                pyKeyword = 'step';
            }

            const baseFuncName = generateStepFunctionName(step.text);
            let funcName = baseFuncName;
            let suffix = 1;
            while (new RegExp(`^def\\s+${funcName}\\s*\\(`, 'm').test(fileContent) || snippet.includes(`def ${funcName}(`)) {
                funcName = `${baseFuncName}_${suffix}`;
                suffix++;
            }

            const argsString = ['context', ...funcArgs].join(', ');
            snippet += `@${pyKeyword}(${safeString})\ndef ${funcName}(${argsString}):\n    raise NotImplementedError(${safeString})\n\n`;
        }

        if (addedCount === 0) {
            vscode.window.showInformationMessage("No new step definitions to generate.");
            return undefined;
        }

        const edit = new vscode.WorkspaceEdit();
        if (isNewFile) {
            edit.createFile(targetUri, { ignoreIfExists: true });
            edit.insert(targetUri, new vscode.Position(0, 0), snippet.trimEnd() + '\n');
        } else {
            let lineCount = 0;
            let lastLineLength = 0;
            try {
                const openDoc = await vscode.workspace.openTextDocument(targetUri);
                lineCount = openDoc.lineCount;
                lastLineLength = lineCount > 0 ? openDoc.lineAt(lineCount - 1).text.length : 0;
            } catch(e) {
                const lines = fileContent.split('\n');
                lineCount = lines.length;
                lastLineLength = lines[lines.length - 1].length;
            }
            const lastLine = lineCount > 0 ? lineCount - 1 : 0;
            const endPos = new vscode.Position(lastLine, lastLineLength);
            edit.insert(targetUri, endPos, snippet.trimEnd() + '\n');
        }

        await vscode.workspace.applyEdit(edit);

        const document = await vscode.workspace.openTextDocument(targetUri);
        const editor = await vscode.window.showTextDocument(document);

        const newEndPos = new vscode.Position(editor.document.lineCount - 1, editor.document.lineAt(editor.document.lineCount - 1).text.length);
        editor.selection = new vscode.Selection(newEndPos, newEndPos);
        editor.revealRange(new vscode.Range(newEndPos, newEndPos));

        vscode.window.showInformationMessage(`Generated ${addedCount} step definition(s).`);
        return targetUri;
    }
    return undefined;
}

