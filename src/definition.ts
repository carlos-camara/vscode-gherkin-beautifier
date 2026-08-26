import * as vscode from 'vscode';
import { SymbolCache } from './cache';
import { dialectService } from './dialect';

export class GherkinDefinitionProvider implements vscode.DefinitionProvider {
    private cache: SymbolCache;

    constructor(cache: SymbolCache) {
        this.cache = cache;
    }

    public async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Location | vscode.Location[] | null> {

        const lineText = document.lineAt(position.line).text.trim();
        const dialect = dialectService.getDialect(document);
        
        // Extract the step text by removing the keyword
        const match = lineText.match(dialectService.getStepRegex(dialect));
        
        if (!match) {
            return null; // Not a valid step
        }

        const stepText = match[2].trim();

        if (token.isCancellationRequested) {
            return null;
        }

        const semanticType = dialectService.resolveDocumentLineSemanticType(document, position.line);
        const matches = await this.cache.getStepDefinitions(stepText, semanticType);
        
        if (token.isCancellationRequested || matches.length === 0) {
            return null;
        }

        return matches.map(def => new vscode.Location(def.uri, def.decoratorRange.start));
    }
}
