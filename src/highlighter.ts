import * as vscode from 'vscode';

/**
 * Custom Syntax Highlighter for Gherkin documents.
 * Dynamically detects the language and highlights keywords with custom colors.
 */
export class GherkinHighlighter {
    private structureDecoration: vscode.TextEditorDecorationType;
    private actionDecoration: vscode.TextEditorDecorationType;
    private tagDecoration: vscode.TextEditorDecorationType;

    // Regex for structural keywords (Feature, Scenario, Rule, etc.)
    private structureRegex = /^(Feature|Característica|Fonction|Funktionalität|Scenario Outline|Esquema del escenario|Plan du scénario|Szenariogrundriss|Scenario|Escenario|Scénario|Szenario|Background|Antecedentes|Contexte|Hintergrund|Rule|Regla|Règle|Regel|Examples|Ejemplos|Exemples|Beispiele):?/im;

    // Regex for action keywords (Given, When, Then, And, But, *)
    private actionRegex = /^(Given|Dado|Soit|Angenommen|When|Cuando|Quand|Wenn|Then|Entonces|Alors|Dann|And|Y|Et|Und|But|Pero|Mais|Aber|\*)\s/im;

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
            const structureMatch = trimmedLine.match(this.structureRegex);
            if (structureMatch) {
                const keyword = structureMatch[0];
                const start = line.indexOf(keyword);
                const end = start + keyword.length;
                structureRanges.push(new vscode.Range(i, start, i, end));
                continue;
            }

            // Check Action Keywords
            const actionMatch = trimmedLine.match(this.actionRegex);
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
