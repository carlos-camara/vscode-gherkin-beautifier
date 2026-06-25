import * as vscode from 'vscode';
import { GherkinFormattingEditProvider } from './formatter';
import { GherkinDocumentSymbolProvider } from './outline';

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
