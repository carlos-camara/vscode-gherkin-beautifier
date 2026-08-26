import * as vscode from 'vscode';

import { dialectService } from './dialect';
import { discoveryService } from './discovery';
import { diagnosticRegistry, antiPatternRegistry, RULES_REGISTRY, RuleDiagnostic } from './rules';
import { SourceLocationPresenter } from './utils/sourceLocationPresenter';

export class GherkinCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.RefactorExtract,
        vscode.CodeActionKind.SourceFixAll
    ];

    public provideCodeActions(document: vscode.TextDocument, _range: vscode.Range | vscode.Selection, _context: vscode.CodeActionContext, _token: vscode.CancellationToken): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        // 1. Handle rich diagnostics from Linter (has actionPayload)
        const allRichDiagnostics = [
            ...(diagnosticRegistry.get(document.uri.toString()) || []),
            ...(antiPatternRegistry.get(document.uri.toString()) || [])
        ];

        // Fix All
        if (_context.only && _context.only.contains(vscode.CodeActionKind.SourceFixAll)) {
            const fixAllEdit = generateSafeFixAllEdit(document, allRichDiagnostics);
            if (fixAllEdit && fixAllEdit.size > 0) {
                const action = new vscode.CodeAction("Fix All Safe Gherkin Issues", vscode.CodeActionKind.SourceFixAll);
                action.edit = fixAllEdit;
                action.isPreferred = true;
                actions.push(action);
            }
            return actions;
        }

        const relevantRichDiagnostics = allRichDiagnostics.filter(d =>
            d.range.start.line <= _range.end.line && d.range.end.line >= _range.start.line
        );

        for (const diagnostic of relevantRichDiagnostics) {
            // Prevent applying Code Actions for stale diagnostics where line ranges or text may have shifted.
            if (diagnostic.documentVersion !== document.version) {
                continue;
            }

            if (diagnostic.ruleId === 'missing-colon') {
                const action = new vscode.CodeAction("Insert missing ':'", vscode.CodeActionKind.QuickFix);
                action.edit = new vscode.WorkspaceEdit();
                const replacement = diagnostic.actionPayload?.replacementText || '';
                if (replacement) {
                    action.edit.replace(document.uri, diagnostic.range, replacement);
                    action.diagnostics = [diagnostic];
                    action.isPreferred = true;
                    actions.push(action);
                }
            } else if (diagnostic.ruleId === 'invalid-keyword') {
                const replacement = diagnostic.actionPayload?.replacementText || '';
                if (replacement) {
                    const action = new vscode.CodeAction(`Replace with '${replacement}'`, vscode.CodeActionKind.QuickFix);
                    action.edit = new vscode.WorkspaceEdit();
                    action.edit.replace(document.uri, diagnostic.range, replacement);
                    action.diagnostics = [diagnostic];
                    action.isPreferred = true;
                    actions.push(action);
                }
            } else if (diagnostic.ruleId === 'scenario-with-examples') {
                const action = new vscode.CodeAction("Convert to 'Scenario Outline'", vscode.CodeActionKind.QuickFix);
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, diagnostic.range, 'Scenario Outline');
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                actions.push(action);
            } else if (diagnostic.ruleId === 'table-inconsistency') {
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
            } else if (diagnostic.ruleId === 'undefined-step') {
                const action = new vscode.CodeAction('Create empty step definition', vscode.CodeActionKind.QuickFix);


                let pyKeyword = dialectService.resolveDocumentLineSemanticType(document, diagnostic.range.start.line);

                // Extract step text securely without parsing the human-readable message
                const stepText = diagnostic.actionPayload?.stepText || '';

                action.command = {
                    command: 'gherkinPowerTools.createStepDefinition',
                    title: 'Create empty step definition',
                    arguments: [stepText, pyKeyword, document.uri]
                };
                if (!vscode.workspace.isTrusted) {
                    action.disabled = { reason: 'Workspace Trust is required to modify Python code' };
                }
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                actions.push(action);
            }
        }

        // 2. Handle ALL diagnostics in context (including AntiPatterns) for Suppression
        for (const diagnostic of _context.diagnostics) {
            const ruleId = typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code;
            if (ruleId && typeof ruleId === 'string' && !['syntax-errors', 'missing-colon', 'invalid-keyword'].includes(ruleId)) {
                // Determine scope if possible. We don't have payload here, so scope is undefined.
                // That's fine, the command handles undefined scope (file-level suppression or generic line match)
                // Actually, wait, if it's a rich diagnostic we might have scope.
                const richDiag = relevantRichDiagnostics.find(d => d.ruleId === ruleId && d.range.start.line === diagnostic.range.start.line);
                const scopeType = richDiag?.actionPayload?.scopeType;
                const scopeValue = richDiag?.actionPayload?.scopeValue;

                let title = `Suppress '${ruleId}'`;
                if (scopeType === 'scenario') {
                    title += ` for this Scenario`;
                } else if (scopeType === 'feature') {
                    title += ` for this Feature`;
                } else if (scopeType === 'step') {
                    title += ` for this Step`;
                }

                // Also check if we already pushed a suppress action for this ruleId
                if (!actions.some(a => a.command?.command === 'gherkinPowerTools.suppressFinding' && a.command.arguments?.[0] === ruleId)) {
                    const suppressAction = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
                    suppressAction.command = {
                        command: 'gherkinPowerTools.suppressFinding',
                        title: 'Suppress finding',
                        arguments: [ruleId, document.uri.toString(), scopeType, scopeValue]
                    };
                    suppressAction.diagnostics = [diagnostic];
                    actions.push(suppressAction);
                }
            }
        }

        // Add Refactoring actions if the user selects multiple lines in a feature file
        if (!_range.isEmpty && _range.start.line !== _range.end.line && document.uri.toString().endsWith('.feature')) {
            const extractAction = new vscode.CodeAction('Extract Steps to new definition', vscode.CodeActionKind.RefactorExtract);
            extractAction.command = {
                command: 'gherkinPowerTools.refactor.extractStep',
                title: 'Extract Step'
            };
            if (!vscode.workspace.isTrusted) {
                extractAction.disabled = { reason: 'Workspace Trust is required to modify Python code' };
            }
            actions.push(extractAction);
        }

        return actions;
    }
}

/**
 * Generates a WorkspaceEdit that fixes all safe, deterministic issues in the document.
 * Includes conflict resolution to prevent overlapping edits.
 */
export function generateSafeFixAllEdit(document: vscode.TextDocument, diagnostics: RuleDiagnostic[]): vscode.WorkspaceEdit | undefined {
    // 1. Filter for safe rules and current document version
    const safeDiagnostics = diagnostics.filter(d => {
        if (d.documentVersion !== document.version) return false;
        const ruleDef = RULES_REGISTRY[d.ruleId];
        return ruleDef && ruleDef.safeFix === true;
    });

    if (safeDiagnostics.length === 0) {
        return undefined;
    }

    // 2. Sort from bottom to top (by start line, descending) to handle overlaps
    safeDiagnostics.sort((a, b) => b.range.start.line - a.range.start.line);

    const edit = new vscode.WorkspaceEdit();
    let lastProcessedStartLine = Number.MAX_SAFE_INTEGER;

    for (const diagnostic of safeDiagnostics) {
        // 3. Detect overlapping edits
        // Since we go bottom-to-top, this diagnostic's END line must be BEFORE the last processed START line
        if (diagnostic.range.end.line >= lastProcessedStartLine) {
            continue; // Overlaps or conflicts, skip it
        }

        let applied = false;
        
        if (diagnostic.ruleId === 'missing-colon') {
            const replacement = diagnostic.actionPayload?.replacementText;
            if (replacement) {
                edit.replace(document.uri, diagnostic.range, replacement);
                applied = true;
            }
        } else if (diagnostic.ruleId === 'invalid-keyword') {
            const replacement = diagnostic.actionPayload?.replacementText;
            if (replacement) {
                edit.replace(document.uri, diagnostic.range, replacement);
                applied = true;
            }
        } else if (diagnostic.ruleId === 'scenario-with-examples') {
            edit.replace(document.uri, diagnostic.range, 'Scenario Outline');
            applied = true;
        }
        
        if (applied) {
            lastProcessedStartLine = diagnostic.range.start.line;
        }
    }

    return edit;
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
 * Resolves the destination for a newly generated step definition file,
 * respecting stepGlobs and workspace architecture.
 */
async function resolveNewStepDestination(documentUri: vscode.Uri | undefined, promptMessage: string): Promise<{ targetUri: vscode.Uri, isNewFile: boolean } | undefined> {
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

    const stepGlobs = discoveryService.getStepGlobs(workspaceFolder.uri);

    // Parse globs into concrete relative directories
    const concreteDirs = new Set<string>();
    for (let glob of stepGlobs) {
        let prefix = glob;
        if (prefix.startsWith('**/')) {
            prefix = prefix.substring(3);
        }

        const wildcardIndex = prefix.indexOf('*');
        if (wildcardIndex !== -1) {
            prefix = prefix.substring(0, wildcardIndex);
        }

        if (prefix.endsWith('/')) {
            prefix = prefix.substring(0, prefix.length - 1);
        }

        if (prefix.trim().length > 0) {
            concreteDirs.add(prefix);
        }
    }

    let possibleDirs = Array.from(concreteDirs);
    if (possibleDirs.length === 0) {
        possibleDirs = ['features/steps'];
    }

    let selectedDir = possibleDirs[0];

    if (possibleDirs.length > 1) {
        const items: vscode.QuickPickItem[] = [];
        for (const dir of possibleDirs) {
            const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, dir);
            let exists = false;
            try {
                const stat = await vscode.workspace.fs.stat(dirUri);
                if (stat.type === vscode.FileType.Directory) {
                    exists = true;
                }
            } catch (e) {
                // Doesn't exist
            }

            items.push({
                label: exists ? `$(folder) ${dir} (Recommended)` : `$(folder) ${dir}`,
                description: exists ? 'Existing directory matches configuration' : 'Will be created',
                dir: dir,
                exists: exists
            } as any);
        }

        // Sort so existing (recommended) are at the top
        items.sort((a: any, b: any) => {
            if (a.exists === b.exists) return 0;
            return a.exists ? -1 : 1;
        });

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select destination directory for new step definitions'
        });

        if (selection) {
            selectedDir = (selection as any).dir;
        } else {
            return undefined;
        }
    }

    const stepsDirUri = vscode.Uri.joinPath(workspaceFolder.uri, selectedDir);
    const targetUri = vscode.Uri.joinPath(stepsDirUri, 'step_definitions.py');

    let isNewFile = false;
    try {
        await vscode.workspace.fs.stat(targetUri);
    } catch {
        isNewFile = true;

        const createAction = `Create ${selectedDir}/step_definitions.py`;
        const selection = await vscode.window.showInformationMessage(
            promptMessage,
            createAction
        );

        if (selection === createAction) {
            try {
                await vscode.workspace.fs.stat(stepsDirUri);
            } catch {
                await vscode.workspace.fs.createDirectory(stepsDirUri);
            }
        } else {
            return undefined;
        }
    }

    return { targetUri, isNewFile };
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
        const resolution = await resolveNewStepDestination(documentUri, "No Python step files found. Would you like to create one?");
        if (!resolution) {
            return undefined;
        }
        targetUri = resolution.targetUri;
        isNewFile = resolution.isNewFile;
    } else if (pyFiles.length === 1) {
        targetUri = pyFiles[0];
    } else {
        const items = pyFiles.map(uri => ({
            label: SourceLocationPresenter.formatShort(uri),
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
            const openDocument = vscode.workspace.textDocuments.find(d => d.uri.toString() === targetUri!.toString());
            if (openDocument) {
                fileContent = openDocument.getText();
            } else {
                try {
                    const data = await vscode.workspace.fs.readFile(targetUri);
                    fileContent = Buffer.from(data).toString('utf8');
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to read target file for step generation: ${SourceLocationPresenter.formatPath(targetUri)}`);
                    return undefined;
                }
            }
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
            edit.createFile(targetUri, { overwrite: false, ignoreIfExists: false });
            edit.insert(targetUri, new vscode.Position(0, 0), snippet);
        } else {
            const lines = fileContent.split('\n');
            const lineCount = lines.length;
            const lastLineLength = lineCount > 0 ? lines[lineCount - 1].length : 0;
            const lastLine = lineCount > 0 ? lineCount - 1 : 0;
            const endPos = new vscode.Position(lastLine, lastLineLength);
            edit.insert(targetUri, endPos, snippet);
        }

        await vscode.workspace.applyEdit(edit);

        const document = await vscode.workspace.openTextDocument(targetUri);
        await document.save();
        
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
        const resolution = await resolveNewStepDestination(documentUri, "No Python step files found. Would you like to create one for all undefined steps?");
        if (!resolution) {
            return undefined;
        }
        targetUri = resolution.targetUri;
        isNewFile = resolution.isNewFile;
    } else if (pyFiles.length === 1) {
        targetUri = pyFiles[0];
    } else {
        const items = pyFiles.map(uri => ({
            label: SourceLocationPresenter.formatShort(uri),
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
            const openDocument = vscode.workspace.textDocuments.find(d => d.uri.toString() === targetUri!.toString());
            if (openDocument) {
                fileContent = openDocument.getText();
            } else {
                try {
                    const data = await vscode.workspace.fs.readFile(targetUri);
                    fileContent = Buffer.from(data).toString('utf8');
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to read target file for batch step generation: ${SourceLocationPresenter.formatPath(targetUri)}`);
                    return undefined;
                }
            }
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
            edit.createFile(targetUri, { overwrite: false, ignoreIfExists: false });
            edit.insert(targetUri, new vscode.Position(0, 0), snippet.trimEnd() + '\n');
        } else {
            const lines = fileContent.split('\n');
            const lineCount = lines.length;
            const lastLineLength = lineCount > 0 ? lines[lineCount - 1].length : 0;
            const lastLine = lineCount > 0 ? lineCount - 1 : 0;
            const endPos = new vscode.Position(lastLine, lastLineLength);
            edit.insert(targetUri, endPos, snippet.trimEnd() + '\n');
        }

        await vscode.workspace.applyEdit(edit);

        const document = await vscode.workspace.openTextDocument(targetUri);
        await document.save();
        
        const editor = await vscode.window.showTextDocument(document);

        const newEndPos = new vscode.Position(editor.document.lineCount - 1, editor.document.lineAt(editor.document.lineCount - 1).text.length);
        editor.selection = new vscode.Selection(newEndPos, newEndPos);
        editor.revealRange(new vscode.Range(newEndPos, newEndPos));

        vscode.window.showInformationMessage(`Generated ${addedCount} step definition(s).`);
        return targetUri;
    }
    return undefined;
}

