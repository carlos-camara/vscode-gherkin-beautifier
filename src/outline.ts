import * as vscode from 'vscode';

/**
 * Provides a Document Symbol tree (Outline) for Gherkin feature files.
 */
export class GherkinDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        const symbols: vscode.DocumentSymbol[] = [];
        let currentFeature: vscode.DocumentSymbol | null = null;
        let currentRule: vscode.DocumentSymbol | null = null;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trimStart();
            const lowerText = text.toLowerCase();

            // Match Feature
            if (lowerText.match(/^(feature|característica|fonction|funktionalität):/)) {
                const featureSymbol = new vscode.DocumentSymbol(
                    text,
                    '',
                    vscode.SymbolKind.Class,
                    line.range,
                    line.range
                );
                symbols.push(featureSymbol);
                currentFeature = featureSymbol;
                currentRule = null;
            }
            // Match Rule
            else if (lowerText.match(/^(rule|regla|règle|regel):/)) {
                const ruleSymbol = new vscode.DocumentSymbol(
                    text,
                    '',
                    vscode.SymbolKind.Namespace,
                    line.range,
                    line.range
                );
                if (currentFeature) {
                    currentFeature.children.push(ruleSymbol);
                } else {
                    symbols.push(ruleSymbol);
                }
                currentRule = ruleSymbol;
            }
            // Match Scenario / Background
            else if (lowerText.match(/^(scenario|scenario outline|background|escenario|antecedentes|esquema del escenario|scénario|contexte|szenario|hintergrund):/)) {
                const scenarioSymbol = new vscode.DocumentSymbol(
                    text,
                    '',
                    vscode.SymbolKind.Method,
                    line.range,
                    line.range
                );
                
                if (currentRule) {
                    currentRule.children.push(scenarioSymbol);
                } else if (currentFeature) {
                    currentFeature.children.push(scenarioSymbol);
                } else {
                    symbols.push(scenarioSymbol);
                }
            }
        }

        return symbols;
    }
}
