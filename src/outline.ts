import * as vscode from 'vscode';
import { astRepository } from './ast';
import type { Scenario, Background } from '@cucumber/messages';
import { dialectService } from './dialect';

/**
 * Provides a Document Symbol tree (Outline) for Gherkin feature files.
 * Uses the official @cucumber/gherkin AST for 100% accuracy.
 */
export class GherkinDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    public async provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.DocumentSymbol[]> {
        const { document: gherkinDocument } = await astRepository.getAST(document);

        if (!gherkinDocument || !gherkinDocument.feature) {
            return [];
        }

        const symbols: vscode.DocumentSymbol[] = [];
        const text = document.getText();
        const feature = gherkinDocument.feature;
        const dialect = dialectService.getDialect(document);

        const featureSymbol = this.createSymbol(
            feature.keyword + ': ' + feature.name,
            feature.description || '',
            vscode.SymbolKind.Class,
            this.getRange(feature.location, document, text),
            this.getRange(feature.location, document, text, true)
        );

        if (feature.children) {
            for (const child of feature.children) {
                if (child.rule) {
                    const ruleSymbol = this.createSymbol(
                        child.rule.keyword + ': ' + child.rule.name,
                        child.rule.description || '',
                        vscode.SymbolKind.Namespace,
                        this.getRange(child.rule.location, document, text),
                        this.getRange(child.rule.location, document, text, true)
                    );
                    
                    if (child.rule.children) {
                        for (const ruleChild of child.rule.children) {
                            if (ruleChild.background) {
                                ruleSymbol.children.push(this.buildScenarioSymbol(ruleChild.background, document, text, dialect));
                            } else if (ruleChild.scenario) {
                                ruleSymbol.children.push(this.buildScenarioSymbol(ruleChild.scenario, document, text, dialect));
                            }
                        }
                    }
                    featureSymbol.children.push(ruleSymbol);
                } else if (child.background) {
                    featureSymbol.children.push(this.buildScenarioSymbol(child.background, document, text, dialect));
                } else if (child.scenario) {
                    featureSymbol.children.push(this.buildScenarioSymbol(child.scenario, document, text, dialect));
                }
            }
        }

        symbols.push(featureSymbol);
        return symbols;
    }

    private buildScenarioSymbol(node: Scenario | Background, document: vscode.TextDocument, text: string, dialect: any): vscode.DocumentSymbol {
        const symbol = this.createSymbol(
            (node.keyword || 'Background') + ': ' + (node.name || ''),
            node.description || '',
            vscode.SymbolKind.Module,
            this.getRange(node.location, document, text),
            this.getRange(node.location, document, text, true)
        );

        if (node.steps) {
            let currentContext: 'given' | 'when' | 'then' | 'step' = 'step';
            for (const step of node.steps) {
                const kw = step.keyword.trim();
                currentContext = dialectService.resolveKeywordSemanticType(kw, dialect, currentContext);
                
                let kind = vscode.SymbolKind.String;
                if (currentContext === 'given') kind = vscode.SymbolKind.Event;
                else if (currentContext === 'when') kind = vscode.SymbolKind.Method;
                else if (currentContext === 'then') kind = vscode.SymbolKind.Constant;

                const stepSymbol = this.createSymbol(
                    step.keyword + step.text,
                    '',
                    kind,
                    this.getRange(step.location, document, text),
                    this.getRange(step.location, document, text, true)
                );
                symbol.children.push(stepSymbol);
            }
        }

        return symbol;
    }

    private createSymbol(name: string, detail: string, kind: vscode.SymbolKind, range: vscode.Range, selectionRange: vscode.Range): vscode.DocumentSymbol {
        return new vscode.DocumentSymbol(name.trim() || 'Unnamed', detail.trim(), kind, range, selectionRange);
    }

    private getRange(location: { line: number; column?: number }, document: vscode.TextDocument, _text: string, isSelection: boolean = false): vscode.Range {
        const line = Math.max(0, location.line - 1);
        const col = location.column ? Math.max(0, location.column - 1) : 0;
        
        // For simplicity, selection range is just the keyword/start.
        // Full range could span to the next element, but for Outline, a single line is often fine 
        // unless we want folding to work perfectly. VS Code has a default indentation-based folder anyway.
        const lineLength = document.lineAt(line).text.length;
        
        if (isSelection) {
            return new vscode.Range(line, col, line, lineLength);
        } else {
            // To make ranges wrap their children, we could calculate the end of the node by looking at the next node, 
            // but for Document Symbols, just using the single line often suffices to jump to it.
            return new vscode.Range(line, 0, line, lineLength);
        }
    }
}
