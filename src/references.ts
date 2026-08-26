import * as vscode from 'vscode';
import { WorkspaceGraph } from './graph';
import { SymbolCache, StepDefinition } from './cache';
import { dialectService } from './dialect';
import { ResourceIdentity } from './utils/resourceIdentity';

export class GherkinReferenceProvider implements vscode.ReferenceProvider {
    private workspaceGraph: WorkspaceGraph;
    private symbolCache: SymbolCache;

    constructor(workspaceGraph: WorkspaceGraph, symbolCache: SymbolCache) {
        this.workspaceGraph = workspaceGraph;
        this.symbolCache = symbolCache;
    }

    public async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): Promise<vscode.Location[] | null> {

        const isPython = document.languageId === 'python';
        
        let matchingDefIds: string[] = [];
        let matchingDefinitions: StepDefinition[] = [];

        if (isPython) {
            // Check if cursor is on a step definition decorator or function
            const uriStr = ResourceIdentity.getCanonicalUriString(document.uri);
            const allDefs = await this.symbolCache.getAllStepDefinitions();
            const fileDefs = allDefs.filter(d => ResourceIdentity.getCanonicalUriString(d.uri) === uriStr);

            for (const def of fileDefs) {
                if (
                    def.decoratorRange.contains(position) || 
                    (def.functionRange && def.functionRange.contains(position))
                ) {
                    matchingDefinitions.push(def);
                    // Match the ID format used in WorkspaceGraph
                    matchingDefIds.push(`${uriStr}:${def.decoratorRange.start.line}`);
                }
            }
        } else {
            // Feature file step
            const lineText = document.lineAt(position.line).text.trim();
            const dialect = dialectService.getDialect(document);
            
            const match = lineText.match(dialectService.getStepRegex(dialect));
            if (!match) {
                return null;
            }

            const stepText = match[2].trim();
            const semanticType = dialectService.resolveDocumentLineSemanticType(document, position.line);
            
            const defs = await this.symbolCache.getStepDefinitions(stepText, semanticType);
            matchingDefinitions = defs;
            
            for (const def of defs) {
                const defUriStr = ResourceIdentity.getCanonicalUriString(def.uri);
                matchingDefIds.push(`${defUriStr}:${def.decoratorRange.start.line}`);
            }
        }

        if (token.isCancellationRequested || matchingDefIds.length === 0) {
            return null;
        }

        const locations: vscode.Location[] = [];
        const seenLocations = new Set<string>();

        const addLocation = (uri: vscode.Uri, line: number) => {
            const locKey = `${uri.toString()}:${line}`;
            if (!seenLocations.has(locKey)) {
                seenLocations.add(locKey);
                locations.push(new vscode.Location(uri, new vscode.Position(line, 0)));
            }
        };

        // If includeDeclaration is true, include the Step Definitions themselves
        if (context.includeDeclaration) {
            for (const def of matchingDefinitions) {
                addLocation(def.uri, def.decoratorRange.start.line);
            }
        }

        // Add all usages of the matched definitions
        for (const defId of matchingDefIds) {
            const usages = this.workspaceGraph.currentGeneration.getUsages(defId);
            for (const usage of usages) {
                // StepNode line from Gherkin AST is 1-indexed, we need 0-indexed Position
                // Python execute_steps StepNode line is 0-indexed.
                // We can determine by checking if uri ends with .py
                const isUsagePython = usage.uri.endsWith('.py');
                const lineIndex = isUsagePython ? usage.line : usage.line - 1;
                addLocation(vscode.Uri.parse(usage.uri), lineIndex);
            }
        }

        return locations;
    }
}
