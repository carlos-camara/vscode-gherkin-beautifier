import * as vscode from 'vscode';

/**
 * Diagnostic Provider that acts as a realtime Linter for Gherkin files.
 * It checks for invalid starting keywords to catch syntax errors instantly.
 */
export class GherkinLinter {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('gherkin');
    }

    /**
     * Lints the document and applies diagnostics.
     * @param document The VS Code text document to lint.
     */
    public lint(document: vscode.TextDocument) {
        if (document.languageId !== 'feature' && document.languageId !== 'gherkin') {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        let inDocString = false;

        // Block keywords MUST end with a colon.
        // Step keywords MUST end with a space.
        // Also accepts Data Tables (|), Tags (@), Comments (#), and DocStrings (""")
        const validKeywordRegex = /^(?:(?:feature|característica|fonction|funktionalität|scenario outline|esquema del escenario|plan du scénario|szenariogrundriss|scenario|escenario|scénario|szenario|background|antecedentes|contexte|hintergrund|rule|regla|règle|regel|examples|ejemplos|exemples|beispiele):|(?:given|dado|soit|angenommen|when|cuando|quand|wenn|then|entonces|alors|dann|and|y|et|und|but|pero|mais|aber|\*)\s+|@|\||#|""")/i;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();

            if (text === '') {
                continue; // Skip empty lines
            }

            if (text.startsWith('"""')) {
                inDocString = !inDocString;
                continue;
            }

            if (inDocString) {
                continue; // Skip validation inside docstrings
            }

            if (!validKeywordRegex.test(text)) {
                // If the line is just a continuation of a table or text, it might be an error.
                // We'll mark the first word as an error.
                const firstWordMatch = line.text.match(/\S+/);
                const startChar = firstWordMatch ? line.text.indexOf(firstWordMatch[0]) : 0;
                const endChar = firstWordMatch ? startChar + firstWordMatch[0].length : line.text.length;

                const range = new vscode.Range(i, startChar, i, endChar);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Invalid Gherkin keyword or syntax. Expected a valid keyword (Feature, Scenario, Given, When, Then, etc.)`,
                    vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'Gherkin Linter';
                diagnostics.push(diagnostic);
            }
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    /**
     * Clears diagnostics for a specific document.
     */
    public clear(document: vscode.TextDocument) {
        this.diagnosticCollection.delete(document.uri);
    }

    /**
     * Disposes the diagnostic collection.
     */
    public dispose() {
        this.diagnosticCollection.dispose();
    }
}
