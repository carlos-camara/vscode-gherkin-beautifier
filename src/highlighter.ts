import * as vscode from 'vscode';
import { dialectService } from './dialect';
import { WorkspaceEventBus } from './eventBus';

/**
 * Custom Syntax Highlighter for Gherkin documents.
 * Dynamically detects the language and highlights keywords with custom colors.
 */
export class GherkinHighlighter {
    private eventBus?: WorkspaceEventBus;

    public setEventBus(eventBus: WorkspaceEventBus) {
        this.eventBus = eventBus;
        this.eventBus.onEvent(e => {
            if (e.type === 'activeEditorChanged' && e.editor) {
                this.highlight(e.editor);
            } else if (e.type === 'textDocumentChanged') {
                if (vscode.window.activeTextEditor && e.event.document === vscode.window.activeTextEditor.document) {
                    this.highlight(vscode.window.activeTextEditor);
                }
            }
        });
    }

    private structureDecoration: vscode.TextEditorDecorationType;
    private actionDecoration: vscode.TextEditorDecorationType;
    private tagDecoration: vscode.TextEditorDecorationType;

    constructor() {
        // Professional VS Code Native Purple for Structure
        this.structureDecoration = vscode.window.createTextEditorDecorationType({
            color: '#C586C0',
            fontWeight: 'bold'
        });

        // Professional VS Code Native Blue for Actions
        this.actionDecoration = vscode.window.createTextEditorDecorationType({
            color: '#569CD6', 
            fontWeight: 'bold'
        });

        // Professional VS Code Native Cyan for Tags
        this.tagDecoration = vscode.window.createTextEditorDecorationType({
            color: '#4EC9B0', 
            fontStyle: 'italic'
        });
    }

    /**
     * Highlights the active text editor.
     * @param editor The VS Code text editor to highlight.
     */
    public highlight(editor: vscode.TextEditor | undefined) {
        if (!editor || !editor.document) {
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'feature' && document.languageId !== 'gherkin') {
            return;
        }

        const dialect = dialectService.getDialect(document);
        const structureRegex = dialectService.getStructureRegex(dialect);
        const actionRegex = dialectService.getStepRegex(dialect);

        const structureRanges: vscode.Range[] = [];
        const actionRanges: vscode.Range[] = [];
        const tagRanges: vscode.Range[] = [];

        const text = document.getText();
        const lines = text.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            if (trimmedLine === '') continue;

            // Check Tags
            if (trimmedLine.startsWith('@')) {
                const words = line.split(/\s+/);
                let currentPos = 0;
                for (const word of words) {
                    if (word.startsWith('@')) {
                        const start = line.indexOf(word, currentPos);
                        const end = start + word.length;
                        tagRanges.push(new vscode.Range(i, start, i, end));
                        currentPos = end;
                    }
                }
                continue; // Tags line won't have keywords
            }

            // Check Structure Keywords
            const structureMatch = trimmedLine.match(structureRegex);
            if (structureMatch) {
                const keyword = structureMatch[1];
                const start = line.indexOf(keyword);
                const end = start + keyword.length;
                structureRanges.push(new vscode.Range(i, start, i, end));
                continue;
            }

            // Check Action Keywords
            const actionMatch = trimmedLine.match(actionRegex);
            if (actionMatch) {
                const keyword = actionMatch[1]; // Just the word, not the space
                const start = line.indexOf(keyword);
                const end = start + keyword.length;
                actionRanges.push(new vscode.Range(i, start, i, end));
            }
        }

        editor.setDecorations(this.structureDecoration, structureRanges);
        editor.setDecorations(this.actionDecoration, actionRanges);
        editor.setDecorations(this.tagDecoration, tagRanges);
    }

    /**
     * Disposes the decorations to prevent memory leaks.
     */
    public dispose() {
        this.structureDecoration.dispose();
        this.actionDecoration.dispose();
        this.tagDecoration.dispose();
    }
}
