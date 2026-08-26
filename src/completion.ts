import * as vscode from 'vscode';
import { SymbolCache, StepDefinition } from './cache';
import { dialectService } from './dialect';
import type { Dialect } from '@cucumber/gherkin';
import { CompletionRankingService, RankingContext, RankingScore } from './completionRanking';
import { astRepository } from './ast';
import { SourceLocationPresenter } from './utils/sourceLocationPresenter';

export interface CompletionContextSnapshot {
    version: number;
    tags: string[];
    featureStepTexts: string[];
}

export class CompletionContextCache {
    private cache = new Map<string, CompletionContextSnapshot>();

    public async getSnapshot(document: vscode.TextDocument, stepRegex: RegExp): Promise<CompletionContextSnapshot> {
        const uriStr = document.uri.toString();
        const cached = this.cache.get(uriStr);

        if (cached && cached.version === document.version) {
            return cached;
        }

        let gherkinDocument = null;
        try {
            const result = await astRepository.getAST(document);
            gherkinDocument = result.document;
        } catch (e) {
            // Ignored, will fallback to regex
        }

        const tags = new Set<string>();
        const featureStepTexts: string[] = [];

        if (gherkinDocument && gherkinDocument.feature) {
            const feature = gherkinDocument.feature;
            feature.tags?.forEach((t: any) => tags.add(t.name));

            for (const child of feature.children || []) {
                if (child.background?.steps) {
                    child.background.steps.forEach((s: any) => featureStepTexts.push(s.text.trim()));
                }
                if (child.scenario) {
                    child.scenario.tags?.forEach((t: any) => tags.add(t.name));
                    child.scenario.steps?.forEach((s: any) => featureStepTexts.push(s.text.trim()));
                }
                if (child.rule) {
                    child.rule.tags?.forEach((t: any) => tags.add(t.name));
                    child.rule.children?.forEach((rc: any) => {
                        if (rc.background?.steps) {
                            rc.background.steps.forEach((s: any) => featureStepTexts.push(s.text.trim()));
                        }
                        if (rc.scenario) {
                            rc.scenario.tags?.forEach((t: any) => tags.add(t.name));
                            rc.scenario.steps?.forEach((s: any) => featureStepTexts.push(s.text.trim()));
                        }
                    });
                }
            }
        } else {
            // Text Fallback: If AST failed severely, fallback to regex
            const currentText = document.getText();
            const matches = currentText.matchAll(/@[\w-]+/g);
            for (const m of matches) tags.add(m[0]);

            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i).text.trim();
                const stepMatch = line.match(stepRegex);
                if (stepMatch) {
                    featureStepTexts.push(line.substring(stepMatch[1].length).trim());
                }
            }
        }

        const snapshot: CompletionContextSnapshot = {
            version: document.version,
            tags: Array.from(tags),
            featureStepTexts
        };

        this.cache.set(uriStr, snapshot);

        // Bound memory to max 10 open documents
        if (this.cache.size > 10) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }

        return snapshot;
    }

    public invalidate(uri: vscode.Uri) {
        this.cache.delete(uri.toString());
    }
}

export function validateSnippetAgainstRegex(snippet: string, regex: RegExp): boolean {
    let concrete = snippet.replace(/\$\{\d+:([^}]+)\}/g, '$1');
    const result = regex.test(concrete);
    return result;
}

/**
 * Generates a safe, human-readable snippet from a regex pattern.
 * If validation fails (e.g. complex lookarounds or failing classes), returns null.
 */
export function generateSafeRegexSnippet(pattern: string, regex?: RegExp): string | null {
    let clean = pattern;
    let counter = 1;

    // Resolve alternations ANYWHERE inside parentheses: e.g. (first|second) -> pick first
    let prev;
    do {
        prev = clean;
        clean = clean.replace(/\(([^()|]*?)\|[^()]*\)/g, '($1)');
    } while (clean !== prev);

    // Resolve non-capturing groups (?:a) -> a
    do {
        prev = clean;
        clean = clean.replace(/\(\?:([^()]*)\)/g, '$1');
    } while (clean !== prev);

    // Character classes FIRST
    clean = clean.replace(/\\d\+/g, '123');
    clean = clean.replace(/\\d\*/g, '123');
    clean = clean.replace(/\\w\+/g, 'text');
    clean = clean.replace(/\\w\*/g, 'text');
    clean = clean.replace(/\.\*/g, '...');
    clean = clean.replace(/\.\+/g, '...');

    // Then named groups
    clean = clean.replace(/\(\?P<([^>]+)>[^()]*\)/g, (_match, name) => {
        return `\${${counter++}:${name}}`;
    });

    // Then unnamed groups
    clean = clean.replace(/\([^()?P][^()]*\)/g, (match) => {
        let inner = match.substring(1, match.length - 1);
        if (!inner || inner.includes('\\') || inner.includes('[')) {
            inner = 'val';
        }
        return `\${${counter++}:${inner}}`;
    });

    clean = clean.replace(/\?/g, '');
    clean = clean.replace(/[()]/g, '');
    clean = clean.replace(/\\s[*+]/g, ' ');

    clean = clean.replace(/\\([a-zA-Z0-9.])/g, '$1');
    clean = clean.replace(/\\\$/g, '$');
    clean = clean.replace(/^\^/, '').replace(/\$$/, '');
    clean = clean.replace(/\s+/g, ' ').trim();

    if (regex) {
        if (!validateSnippetAgainstRegex(clean, regex)) {
            return null;
        }
    }

    return clean;
}
export class GherkinCompletionProvider implements vscode.CompletionItemProvider {
    private symbolCache: SymbolCache;
    private rankingService: CompletionRankingService;
    private contextCache: CompletionContextCache;

    constructor(symbolCache: SymbolCache, rankingService: CompletionRankingService, contextCache: CompletionContextCache) {
        this.symbolCache = symbolCache;
        this.rankingService = rankingService;
        this.contextCache = contextCache;
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
            const headers = await this.getOutlineHeaders(document, position.line, dialect);

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
        const semanticType = dialectService.resolveDocumentLineSemanticType(document, position.line);

        const definitions = await this.symbolCache.getAllStepDefinitions(semanticType);
        const completionItems: vscode.CompletionItem[] = [];
        const seenPatterns = new Set<string>();

        interface GroupedCompletion {
            readableLabel: string;
            finalInsertText: string | vscode.SnippetString;
            kind: vscode.CompletionItemKind;
            highestScore: RankingScore;
            defs: StepDefinition[];
        }
        const groups = new Map<string, GroupedCompletion>();

        // Fast extraction of current document context for ranking via Snapshot Cache
        const snapshot = await this.contextCache.getSnapshot(document, stepRegex);

        const rankingContext: RankingContext = {
            semanticType,
            typedText,
            currentTags: snapshot.tags,
            currentFeatureStepTexts: snapshot.featureStepTexts
        };

        for (const def of definitions) {
            if (token.isCancellationRequested) {
                return undefined;
            }

            const pattern = def.rawPattern;
            const defId = def.id;

            // Avoid duplicates
            if (seenPatterns.has(defId)) {
                continue;
            }
            seenPatterns.add(defId);

            let kind = vscode.CompletionItemKind.Function;
            if (def.type === 'given') kind = vscode.CompletionItemKind.Event;
            else if (def.type === 'when') kind = vscode.CompletionItemKind.Method;
            else if (def.type === 'then') kind = vscode.CompletionItemKind.Value;

            let snippetString = pattern;
            let readableLabel = pattern;
            let finalInsertText: string | vscode.SnippetString = pattern;

            if (def.matcherType === 're') {
                const safeSnippet = generateSafeRegexSnippet(pattern, def.regex);
                if (safeSnippet !== null) {
                    finalInsertText = new vscode.SnippetString(safeSnippet);
                    readableLabel = safeSnippet.replace(/\$\{\d+:([^}]+)\}/g, '<$1>');
                } else {
                    // Fallback UX for unsupported or unsafe regex
                    finalInsertText = def.rawPattern;
                    readableLabel = def.rawPattern + ' [Regex]';
                }
            } else {
                let counter = 1;
                // Replace {param} or {param:type} -> ${1:param}
                snippetString = snippetString.replace(/\{([^}:]+)(?::[^}]+)?\}/g, (_match, paramName) => {
                    return `\${${counter++}:${paramName}}`;
                });
                finalInsertText = new vscode.SnippetString(snippetString);
                readableLabel = snippetString.replace(/\$\{\d+:([^}]+)\}/g, '<$1>');
            }

            const item = new vscode.CompletionItem(readableLabel, kind);
            item.insertText = finalInsertText;
            item.detail = `(behave) @${def.type}`;

            const doc = new vscode.MarkdownString();
            doc.appendMarkdown(`**${def.functionName || 'step_impl'}**\n\n`);
            if (def.documentation) {
                doc.appendMarkdown(`---\n${def.documentation}\n\n`);
            }
            doc.appendMarkdown(`---\n`);

            // Add Regex and Source File exactly as required by the test plan
            const exactPattern = def.regex ? def.regex.toString() : def.rawPattern;
            doc.appendMarkdown(`**Regex:** \`${exactPattern}\`\n\n`);

            const relativePath = SourceLocationPresenter.formatPath(def.uri);
            doc.appendMarkdown(`**Source:** \`${relativePath}\``);

            item.documentation = doc;

            // Set the range to replace the entire typed text after the keyword
            item.range = replaceRange;

            // Allow VS Code to filter by matching what the user typed against the human-readable pattern
            item.filterText = readableLabel;

            const score = this.rankingService.scoreItem(def, rankingContext);
            const insertTextStr = typeof finalInsertText === 'string' ? finalInsertText : finalInsertText.value;
            const groupKey = `${readableLabel}::${insertTextStr}`;

            const existingGroup = groups.get(groupKey);
            if (!existingGroup) {
                groups.set(groupKey, {
                    readableLabel,
                    finalInsertText,
                    kind,
                    highestScore: score,
                    defs: [def]
                });
            } else {
                const kindRank: Record<vscode.CompletionItemKind, number> = {
                    [vscode.CompletionItemKind.Function]: 1,
                    [vscode.CompletionItemKind.Value]: 2, // then
                    [vscode.CompletionItemKind.Method]: 3, // when
                    [vscode.CompletionItemKind.Event]: 4, // given
                } as any;

                const existingKindRank = kindRank[existingGroup.kind] || 0;
                const currentKindRank = kindRank[kind] || 0;
                if (currentKindRank > existingKindRank) {
                    existingGroup.kind = kind;
                }

                const existingSort = this.rankingService.getSortText(existingGroup.highestScore);
                const currentSort = this.rankingService.getSortText(score);
                if (currentSort < existingSort) { // Lower string is better
                    existingGroup.highestScore = score;
                }

                existingGroup.defs.push(def);
            }
        }

        for (const group of groups.values()) {
            const item = new vscode.CompletionItem(group.readableLabel, group.kind);
            item.insertText = group.finalInsertText;

            const defCount = group.defs.length;
            const types = Array.from(new Set(group.defs.map(d => d.type))).join('/');

            if (defCount === 1) {
                item.detail = `(behave) @${types}`;
            } else {
                item.detail = `(behave) @${types} (${defCount} matching definitions)`;
            }

            const doc = new vscode.MarkdownString();

            if (defCount > 1) {
                doc.appendMarkdown(`**Ambiguous Definitions (${defCount})**\n\n`);
                for (const def of group.defs) {
                    doc.appendMarkdown(`---\n**${def.functionName || 'step_impl'}**\n\n`);
                    const relativePath = SourceLocationPresenter.formatPath(def.uri);
                    doc.appendMarkdown(`**Source:** \`${relativePath}\`\n\n`);
                }
            } else {
                const def = group.defs[0];
                doc.appendMarkdown(`**${def.functionName || 'step_impl'}**\n\n`);
                if (def.documentation) {
                    doc.appendMarkdown(`---\n${def.documentation}\n\n`);
                }
            }

            doc.appendMarkdown(`---\n`);
            const exactPattern = group.defs[0].regex ? group.defs[0].regex.toString() : group.defs[0].rawPattern;
            doc.appendMarkdown(`**Regex:** \`${exactPattern}\`\n\n`);

            if (defCount === 1) {
                const relativePath = SourceLocationPresenter.formatPath(group.defs[0].uri);
                doc.appendMarkdown(`**Source:** \`${relativePath}\``);
            }

            item.documentation = doc;
            item.range = replaceRange;
            item.filterText = group.readableLabel;
            item.sortText = this.rankingService.getSortText(group.highestScore);

            const defIds = group.defs.map(d => d.id);
            item.command = {
                title: 'Record Completion',
                command: 'gherkinPowerTools.internal.recordCompletion',
                arguments: [defIds]
            };

            completionItems.push(item);
        }

        return completionItems;
    }

    private async getOutlineHeaders(document: vscode.TextDocument, currentLine: number, dialect: Dialect): Promise<string[]> {
        let gherkinDocument = null;
        try {
            const result = await astRepository.getAST(document);
            gherkinDocument = result.document;
        } catch (e) {
            // Ignored, will fallback to regex
        }

        if (gherkinDocument && gherkinDocument.feature) {
            const scenarios: any[] = [];
            for (const child of gherkinDocument.feature.children || []) {
                if (child.scenario) scenarios.push(child.scenario);
                if (child.rule && child.rule.children) {
                    child.rule.children.forEach(rc => {
                        if (rc.scenario) scenarios.push(rc.scenario);
                    });
                }
            }

            const targetLine = currentLine + 1; // AST is 1-indexed, VSCode is 0-indexed
            let activeScenario: any = null;
            let maxLine = -1;

            for (const scenario of scenarios) {
                if (scenario.location.line <= targetLine && scenario.location.line > maxLine) {
                    maxLine = scenario.location.line;
                    activeScenario = scenario;
                }
            }

            if (activeScenario && activeScenario.examples && activeScenario.examples.length > 0) {
                const headersSet = new Set<string>();
                for (const example of activeScenario.examples) {
                    if (example.tableHeader && example.tableHeader.cells) {
                        for (const cell of example.tableHeader.cells) {
                            if (cell.value && cell.value.trim() !== '') {
                                headersSet.add(cell.value); // AST parser automatically resolves escaped pipes
                            }
                        }
                    }
                }
                if (headersSet.size > 0) {
                    return Array.from(headersSet);
                }
            }
        }

        // Narrow Text Fallback: If AST failed or is incomplete while typing, fallback to regex
        return this.getOutlineHeadersRegex(document, currentLine, dialect);
    }

    private getOutlineHeadersRegex(document: vscode.TextDocument, currentLine: number, dialect: Dialect): string[] {
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
