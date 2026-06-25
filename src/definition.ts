import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class GherkinDefinitionProvider implements vscode.DefinitionProvider {

    public async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Location | null> {

        const lineText = document.lineAt(position.line).text.trim();
        
        // Extract the step text by removing the keyword (Given, When, Then, And, But, *)
        const match = lineText.match(/^(?:Given|When|Then|And|But|\*|Dado|Cuando|Entonces|Y|Pero|Soit|Quand|Alors|Et|Mais|Angenommen|Wenn|Dann|Und|Aber)\s+(.*)/i);
        
        if (!match) {
            return null; // Not a valid step
        }

        const stepText = match[1].trim();

        // Search for Python files in any 'steps' folder
        const stepFiles = await vscode.workspace.findFiles('**/steps/**/*.py', '**/node_modules/**');

        for (const file of stepFiles) {
            if (token.isCancellationRequested) {
                return null;
            }

            const content = fs.readFileSync(file.fsPath, 'utf8');
            const lines = content.split(/\r?\n/);

            for (let i = 0; i < lines.length; i++) {
                const pyLine = lines[i].trim();

                // Look for Behave decorators: @given('...'), @when("..."), @then('...'), @step('...')
                const decoratorMatch = pyLine.match(/^@(given|when|then|step)\s*\(\s*['"](.+)['"]\s*\)/i);
                if (decoratorMatch) {
                    const patternText = decoratorMatch[2];
                    
                    // Convert Behave pattern to JS RegExp
                    // Replace {variable} or (?P<variable>...) with .*
                    let regexPattern = patternText
                        .replace(/\{[^}]*\}/g, '.*')
                        .replace(/\(\?P<[^>]+>.*\)/g, '.*');

                    // Escape special regex characters except .*
                    regexPattern = regexPattern.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\\\.\\\*/g, '.*');

                    try {
                        const regex = new RegExp('^' + regexPattern + '$', 'i');
                        if (regex.test(stepText)) {
                            return new vscode.Location(
                                vscode.Uri.file(file.fsPath),
                                new vscode.Position(i, pyLine.indexOf(decoratorMatch[1]) - 1)
                            );
                        }
                    } catch (e) {
                        // Ignore invalid regex generated from python string
                    }
                }
            }
        }

        return null; // No definition found
    }
}
