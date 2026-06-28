import * as vscode from 'vscode';

/**
 * Provides a Document Symbol tree (Outline) for Gherkin feature files.
 */
export class GherkinDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.DocumentSymbol[] {
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

        // Second pass: update ranges so parents contain their children correctly
        // We know a feature spans from its start line to the end of the document
        if (currentFeature) {
            currentFeature.range = new vscode.Range(
                currentFeature.range.start, 
                new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
            );
        }
        
        // Let's refine ranges: a rule spans until the next rule
        let previousRule: vscode.DocumentSymbol | null = null;
        if (currentFeature && currentFeature.children.length > 0) {
            for (const child of currentFeature.children) {
                if (child.kind === vscode.SymbolKind.Namespace) {
                    // It's a Rule
                    if (previousRule) {
                        previousRule.range = new vscode.Range(
                            previousRule.range.start,
                            new vscode.Position(child.range.start.line - 1, 0)
                        );
                    }
                    previousRule = child;
                    
                    // Also fix scenario ranges inside the rule
                    let previousScenario: vscode.DocumentSymbol | null = null;
                    for (const scenario of child.children) {
                        if (previousScenario) {
                            previousScenario.range = new vscode.Range(
                                previousScenario.range.start,
                                new vscode.Position(scenario.range.start.line - 1, 0)
                            );
                        }
                        previousScenario = scenario;
                    }
                    if (previousScenario) {
                        // The last scenario in a rule extends to the end of the rule (which we'll estimate as document end for now, or just leave it)
                    }
                } else {
                    // It's a Scenario directly under Feature
                    if (previousRule) {
                        previousRule.range = new vscode.Range(
                            previousRule.range.start,
                            new vscode.Position(child.range.start.line - 1, 0)
                        );
                        previousRule = null;
                    }
                }
            }
            if (previousRule) {
                previousRule.range = new vscode.Range(
                    previousRule.range.start,
                    new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
                );
            }
        }

        return symbols;
    }
}
