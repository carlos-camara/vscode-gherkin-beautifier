import * as vscode from 'vscode';
import { SymbolCache } from './cache';
import { dialectService } from './dialect';
import type { Dialect } from '@cucumber/gherkin';
import { CompletionRankingService, RankingContext } from './completionRanking';

export class GherkinCompletionProvider implements vscode.CompletionItemProvider {
    private symbolCache: SymbolCache;
    private rankingService: CompletionRankingService;

    constructor(symbolCache: SymbolCache, rankingService: CompletionRankingService) {
        this.symbolCache = symbolCache;
        this.rankingService = rankingService;
    }

    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
        
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const dialect = dialectService.getDialect(document);
        
        // Check if we are inside a parameter typing state: e.g. "Given I do <fo"
        const paramMatch = linePrefix.match(/<([^>]*)$/);
        
        if (paramMatch) {
            const typedParamText = paramMatch[1];
            const headers = this.getOutlineHeaders(document, position.line, dialect);
            
            if (headers.length > 0) {
                const replaceRange = new vscode.Range(
                    position.line,
                    position.character - typedParamText.length,
                    position.line,
                    position.character
                );

                const items = headers.map(header => {
                    const item = new vscode.CompletionItem(header, vscode.CompletionItemKind.Variable);
                    // Add the closing bracket. The SnippetString allows putting the cursor after it.
                    item.insertText = new vscode.SnippetString(`${header}>$0`);
                    item.range = replaceRange;
                    item.detail = 'Examples Table Column';
                    item.sortText = '0_' + header; // Force to the top of the completion list
                    return item;
                });
                return items;
            }
        }
        
        // Ensure we only autocomplete when a valid step keyword is present
        const stepKeywords = dialectService.getStepKeywords(dialect);
        if (!stepKeywords.includes('* ')) stepKeywords.push('* ');
        stepKeywords.sort((a, b) => b.length - a.length);
        const escapedSteps = stepKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const stepRegex = new RegExp(`^(\\s*(?:${escapedSteps.join('|')}))`);
        
        const match = linePrefix.match(stepRegex);
        if (!match) {
            return undefined;
        }

        const keywordPrefix = match[1];
        const typedText = linePrefix.substring(keywordPrefix.length);

        // Range to replace (everything after the keyword up to the cursor)
        const replaceRange = new vscode.Range(
            position.line,
            keywordPrefix.length,
            position.line,
            position.character
        );

        // Determine semantic type of the current step
        const kw = keywordPrefix.trim();
        let semanticType: 'given' | 'when' | 'then' | 'step' = 'step';
        
        if (dialect.given.includes(kw) || dialect.given.includes(kw + ' ')) semanticType = 'given';
        else if (dialect.when.includes(kw) || dialect.when.includes(kw + ' ')) semanticType = 'when';
        else if (dialect.then.includes(kw) || dialect.then.includes(kw + ' ')) semanticType = 'then';
        else if (dialect.and.includes(kw) || dialect.and.includes(kw + ' ') || 
                 dialect.but.includes(kw) || dialect.but.includes(kw + ' ') || 
                 kw === '*') {
            semanticType = dialectService.resolveAndBut(document, position.line);
        }

        const definitions = await this.symbolCache.getAllStepDefinitions(semanticType);
        const completionItems: vscode.CompletionItem[] = [];
        const seenPatterns = new Set<string>();

        // Fast extraction of current document context for ranking
        const currentText = document.getText();
        const currentTags = Array.from(currentText.matchAll(/@[\w-]+/g)).map(m => m[0]);
        const currentFeatureStepTexts: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();
            const stepMatch = line.match(stepRegex);
            if (stepMatch) {
                currentFeatureStepTexts.push(line.substring(stepMatch[1].length).trim());
            }
        }

        const rankingContext: RankingContext = {
            semanticType,
            typedText,
            currentTags,
            currentFeatureStepTexts
        };

        for (const def of definitions) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            const pattern = def.rawPattern;

            // Avoid duplicates
            if (seenPatterns.has(pattern)) {
                continue;
            }
            seenPatterns.add(pattern);

            const item = new vscode.CompletionItem(pattern, vscode.CompletionItemKind.Snippet);
            
            // Convert Behave parameters {param} or {param:d} and regex (?P<param>.*) to Snippets ${1:param}
            let snippetString = pattern;
            let counter = 1;

            // Replace {param} or {param:type} -> ${1:param}
            snippetString = snippetString.replace(/\{([^}:]+)(?::[^}]+)?\}/g, (_match, paramName) => {
                return `\${${counter++}:${paramName}}`;
            });

            // Replace (?P<param>.*) -> ${1:param}
            snippetString = snippetString.replace(/\(\?P<([^>]+)>.*?\)/g, (_match, paramName) => {
                return `\${${counter++}:${paramName}}`;
            });

            item.insertText = new vscode.SnippetString(snippetString);
            item.detail = `Python @${def.type} Definition`;
            
            // Set the range to replace the entire typed text after the keyword
            item.range = replaceRange;
            
            // Allow VS Code to filter by matching what the user typed against the full pattern
            item.filterText = pattern;
            
            // Apply contextual ranking
            const score = this.rankingService.scoreItem(def, rankingContext);
            item.sortText = this.rankingService.getSortText(score, pattern);
            
            // Attach internal command to track when this completion is accepted
            item.command = {
                title: 'Record Completion',
                command: 'gherkinPowerTools.internal.recordCompletion',
                arguments: [pattern]
            };
            
            completionItems.push(item);
        }

        return completionItems;
    }

    private getOutlineHeaders(document: vscode.TextDocument, currentLine: number, dialect: Dialect): string[] {
        const outlineKeywords = dialect.scenarioOutline.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const scenarioKeywords = dialect.scenario.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const rootKeywords = [...dialect.feature, ...dialect.rule, ...dialect.background]
            .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const examplesKeywords = dialect.examples.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        
        const outlineRegex = new RegExp(`^\\s*(?:${outlineKeywords})\\s*:`);
        const scenarioRegex = new RegExp(`^\\s*(?:${scenarioKeywords})\\s*:`);
        const rootRegex = new RegExp(`^\\s*(?:${rootKeywords})\\s*:`);
        const examplesRegex = new RegExp(`^\\s*(?:${examplesKeywords})\\s*:`);
        const blockRegex = dialectService.getStructureRegex(dialect);

        let outlineStartLine = -1;
        for (let i = currentLine; i >= 0; i--) {
            const line = document.lineAt(i).text.trim();
            if (outlineRegex.test(line)) {
                outlineStartLine = i;
                break;
            }
            if (scenarioRegex.test(line)) {
                return []; // Not in an outline
            }
            if (rootRegex.test(line)) {
                return []; // Hit the top boundaries
            }
        }

        if (outlineStartLine === -1) return [];

        let inExamples = false;
        for (let i = outlineStartLine + 1; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();
            if (examplesRegex.test(line)) {
                inExamples = true;
                continue;
            }
            if (inExamples && line.startsWith('|')) {
                // Return the cells of the first table row
                return line.split('|')
                    .filter(c => c.trim() !== '')
                    .map(c => c.trim());
            }
            if (blockRegex.test(line)) {
                break; // hit the next block
            }
        }
        return [];
    }
}
