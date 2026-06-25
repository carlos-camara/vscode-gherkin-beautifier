import * as vscode from 'vscode';
import { GherkinFormattingEditProvider } from './formatter';
import { GherkinDocumentSymbolProvider } from './outline';
import { GherkinLinter } from './linter';
import { GherkinHighlighter } from './highlighter';
import { showStatisticsDashboard } from './statistics';
import { GherkinDefinitionProvider } from './definition';

const GHERKIN_LANGUAGES = ['feature', 'gherkin'];

/**
 * Activates the Gherkin Beautifier extension.
 * This method is called when the extension is activated by VS Code.
 * 
 * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "vscode-gherkin-beautifier" is now active.');

    const formatter = new GherkinFormattingEditProvider();
    const symbolProvider = new GherkinDocumentSymbolProvider();
    
    // Register the context menu command to format the document
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinBeautifier.format', () => {
            vscode.commands.executeCommand('editor.action.formatDocument');
        })
    );

    // Register the statistics dashboard command
    context.subscriptions.push(
        vscode.commands.registerCommand('gherkinBeautifier.showStatistics', () => {
            showStatisticsDashboard(context);
        })
    );
    
    const linter = new GherkinLinter();
    context.subscriptions.push(linter);

    const highlighter = new GherkinHighlighter();
    context.subscriptions.push(highlighter);

    // Initial lint & highlight for all open feature files
    vscode.workspace.textDocuments.forEach(doc => {
        linter.lint(doc);
    });
    if (vscode.window.activeTextEditor) {
        highlighter.highlight(vscode.window.activeTextEditor);
    }

    // On file open or active editor change
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                highlighter.highlight(editor);
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            linter.lint(doc);
        })
    );

    // On text change
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
            linter.lint(e.document);
            if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
                highlighter.highlight(vscode.window.activeTextEditor);
            }
        })
    );

    // Clear on close
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(doc => linter.clear(doc))
    );

    // Register the formatter for both full documents and selections/ranges
    // We register for both 'feature' and 'gherkin' language identifiers to ensure maximum compatibility
    GHERKIN_LANGUAGES.forEach(language => {
        context.subscriptions.push(
            vscode.languages.registerDocumentFormattingEditProvider(
                { language }, 
                formatter
            ),
            vscode.languages.registerDocumentRangeFormattingEditProvider(
                { language }, 
                formatter
            ),
            vscode.languages.registerDocumentSymbolProvider(
                { language },
                symbolProvider
            ),
            vscode.languages.registerDefinitionProvider(
                { language },
                new GherkinDefinitionProvider()
            )
        );
    });
}

/**
 * Deactivates the Gherkin Beautifier extension.
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
    // Currently no specific cleanup is required beyond what is handled by context.subscriptions
}
