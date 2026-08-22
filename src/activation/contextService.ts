import * as vscode from 'vscode';

import { logger } from '../logger';

/**
 * Manages the state of VS Code context keys (e.g. for menu enablement).
 */
export class GherkinContextService implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                this.updateCursorContext(editor);
            }),
            vscode.window.onDidChangeTextEditorSelection(e => {
                this.updateCursorContext(e.textEditor);
            })
        );

        if (vscode.window.activeTextEditor) {
            this.updateCursorContext(vscode.window.activeTextEditor);
        }
    }

    private updateCursorContext(editor: vscode.TextEditor | undefined) {
        try {
            if (!editor || editor.document.languageId !== 'feature') {
                vscode.commands.executeCommand('setContext', 'gherkinPowerTools.isCursorOnStep', false);
                return;
            }
            if (!editor.selection || !editor.selection.active) return;
            const lineText = editor.document.lineAt(editor.selection.active.line).text.trimStart();
            // A simple regex to detect a Gherkin step keyword. It does not need full dialect 
            // awareness just to show/hide the menu, but covering English is a good baseline.
            const isStep = /^(?:Given|When|Then|And|But|\*)\s/.test(lineText);
            vscode.commands.executeCommand('setContext', 'gherkinPowerTools.isCursorOnStep', isStep);
        } catch (e) {
            logger.debug(`Error updating cursor context: ${e}`);
        }
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
