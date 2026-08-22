import * as vscode from 'vscode';
import { SymbolCache } from './cache';
import { dialectService } from './dialect';
import { astRepository } from './ast';
import type { Step } from '@cucumber/messages';
import { ConfigurationService } from './configuration';
import { WorkspaceEventBus } from './eventBus';
import { WorkspaceGraph } from './graph';

export type InvalidationReason = 
    | { type: 'documentOpened', document: vscode.TextDocument }
    | { type: 'documentChanged', document: vscode.TextDocument }
    | { type: 'configurationChanged', affectsLinter: boolean }
    | { type: 'stepDefinitionsUpdated', affectedFeatureUris?: vscode.Uri[] };

export interface LinterMetrics {
    candidateDocs: number;
    lintedDocs: number;
    skippedDocs: number;
    elapsedTimeMs: number;
}
/**
 * Diagnostic Provider that acts as a realtime Linter for Gherkin files.
 * It uses the official @cucumber/gherkin AST parser to catch syntax errors instantly.
 */
export class GherkinLinter {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private symbolCache: SymbolCache;
    private pendingRequests: Map<string, { timer?: NodeJS.Timeout, requestId: number }> = new Map();
    private nextRequestId: number = 0;
    private eventBus?: WorkspaceEventBus;
    private eventBusDisposable?: vscode.Disposable;
    private workspaceGraph?: WorkspaceGraph;
    
    private invalidationQueue: Map<string, InvalidationReason> = new Map();
    private flushDebounceTimer?: NodeJS.Timeout;
    private isFlushing = false;

    constructor(symbolCache: SymbolCache, private configService: ConfigurationService) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('gherkin');
        this.symbolCache = symbolCache;
    }

    public setWorkspaceGraph(graph: WorkspaceGraph) {
        this.workspaceGraph = graph;
    }

    public setEventBus(eventBus: WorkspaceEventBus) {
        this.eventBus = eventBus;
        this.eventBusDisposable?.dispose();
        this.eventBusDisposable = this.eventBus.onEvent(e => {
            if (e.type === 'textDocumentOpened') {
                this.immediateInvalidation({ type: 'documentOpened', document: e.document });
            } else if (e.type === 'textDocumentChanged') {
                this.queueInvalidation({ type: 'documentChanged', document: e.event.document });
            } else if (e.type === 'configurationChanged') {
                // A quick check if it affects linter could be done here, but for simplicity we assume it might.
                this.queueInvalidation({ type: 'configurationChanged', affectsLinter: true });
            } else if (e.type === 'stepDefinitionsUpdated' || e.type === 'stepFileDeleted') {
                let affected: vscode.Uri[] | undefined = undefined;
                if (this.workspaceGraph) {
                    // Correctness-first: if definitions change, any unresolved step might now be resolved, 
                    // and any resolved step might become ambiguous.
                    // For now, we consider all open feature files as candidates to be safe, but we let the queue batch it.
                    affected = vscode.workspace.textDocuments.map(d => d.uri);
                }
                this.queueInvalidation({ type: 'stepDefinitionsUpdated', affectedFeatureUris: affected });
            }
        });
    }

    private queueInvalidation(reason: InvalidationReason) {
        if (reason.type === 'documentOpened' || reason.type === 'documentChanged') {
            this.invalidationQueue.set(reason.document.uri.toString(), reason);
        } else if (reason.type === 'configurationChanged') {
            this.invalidationQueue.set(`config:global`, reason);
        } else if (reason.type === 'stepDefinitionsUpdated') {
            this.invalidationQueue.set('stepDefs', reason);
        }
        
        if (this.flushDebounceTimer) {
            clearTimeout(this.flushDebounceTimer);
        }
        this.flushDebounceTimer = setTimeout(() => this.flush(), 250);
    }
    
    private immediateInvalidation(reason: InvalidationReason) {
        this.queueInvalidation(reason);
        if (this.flushDebounceTimer) clearTimeout(this.flushDebounceTimer);
        this.flush();
    }
    
    private async flush(): Promise<LinterMetrics | undefined> {
        if (this.isFlushing || this.invalidationQueue.size === 0) return;
        this.isFlushing = true;
        const startTime = Date.now();
        
        const reasons = Array.from(this.invalidationQueue.values());
        this.invalidationQueue.clear();
        
        let candidates = new Map<string, vscode.TextDocument>();
        let globalConfigChanged = false;
        let stepDefsChanged = false;
        
        for (const reason of reasons) {
            if (reason.type === 'documentOpened' || reason.type === 'documentChanged') {
                candidates.set(reason.document.uri.toString(), reason.document);
            } else if (reason.type === 'configurationChanged') {
                globalConfigChanged = true;
            } else if (reason.type === 'stepDefinitionsUpdated') {
                stepDefsChanged = true;
            }
        }
        
        if (globalConfigChanged || stepDefsChanged) {
            // Add all open feature documents as candidates
            vscode.workspace.textDocuments.forEach(doc => {
                if (doc.languageId === 'feature' || doc.languageId === 'gherkin') {
                    candidates.set(doc.uri.toString(), doc);
                }
            });
        }
        
        const metrics: LinterMetrics = {
            candidateDocs: candidates.size,
            lintedDocs: 0,
            skippedDocs: 0,
            elapsedTimeMs: 0
        };
        
        // Limit concurrency to 5
        const limit = 5;
        const activePromises = new Set<Promise<void>>();
        
        for (const doc of candidates.values()) {
            const config = this.configService.getConfiguration(doc.uri);
            if (!config.linter.enabled) {
                this.clear(doc);
                metrics.skippedDocs++;
                continue;
            }
            
            const p = this.lint(doc, ++this.nextRequestId, doc.version).then(() => {
                metrics.lintedDocs++;
            }).finally(() => {
                activePromises.delete(p);
            });
            activePromises.add(p);
            
            if (activePromises.size >= limit) {
                await Promise.race(activePromises);
            }
        }
        
        await Promise.all(activePromises);
        
        metrics.elapsedTimeMs = Date.now() - startTime;
        this.isFlushing = false;
        
        // Output metrics for observability
        process.stdout.write(`\n--- LINTER FLUSH METRICS: candidates=${metrics.candidateDocs}, linted=${metrics.lintedDocs}, skipped=${metrics.skippedDocs}, time=${metrics.elapsedTimeMs}ms ---\n`);
        return metrics;
    }

    public scheduleLint(document: vscode.TextDocument) {
        this.queueInvalidation({ type: 'documentChanged', document });
    }

    public immediateLint(document: vscode.TextDocument) {
        this.immediateInvalidation({ type: 'documentChanged', document });
    }

    /**
     * Lints the document and applies diagnostics.
     * @param document The VS Code text document to lint.
     * @param requestId The execution request ID to track stale runs.
     * @param version The document version at the time of the request.
     */
    public async lint(document: vscode.TextDocument, requestId: number = ++this.nextRequestId, version: number = document.version, isExplicitCommand: boolean = false) {
        if (document.languageId !== 'feature' && document.languageId !== 'gherkin') {
            return;
        }

        const config = this.configService.getConfiguration(document.uri);
        if (!config.linter.enabled) {
            this.clear(document);
            if (isExplicitCommand) {
                vscode.window.showInformationMessage("Linter is currently DISABLED by configuration.");
            }
            return;
        }

        const dialect = dialectService.getDialect(document);
        const { document: gherkinDocument, errors } = await astRepository.getAST(document);

        if (errors && errors.length > 0) {
            // Error handling below
        }

        const diagnostics: vscode.Diagnostic[] = [];
        let hasFatalSyntaxError = false;

        for (const error of errors) {
            if (typeof error.line === 'number') {
                // AST locations are 1-indexed, VS Code positions are 0-indexed
                const lineIndex = Math.min(Math.max(0, error.line - 1), document.lineCount > 0 ? document.lineCount - 1 : 0);
                const lineText = document.lineCount > 0 ? document.lineAt(lineIndex).text : '';

                // Column from AST is 1-indexed. If not present or 0, default to first non-whitespace char.
                let startChar = error.column ? Math.max(0, error.column - 1) : 0;
                if (startChar === 0) {
                    const firstWordMatch = lineText.match(/\S+/);
                    startChar = firstWordMatch ? lineText.indexOf(firstWordMatch[0]) : 0;
                }

                    // Highlight the whole line to ensure the lightbulb is easily accessible
                    let endChar = lineText.length;

                    // Format the error message cleanly
                    let message = error.message;
                    let code = 'syntax-error';
                    let suggestedEdit = '';

                    const gotMatch = message.match(/got '(.*?)'/);
                    if (gotMatch) {
                        const gotText = gotMatch[1];

                        // Suppress cascading errors from broken AST state
                        const bKeywords = dialectService.getBlockKeywords(dialect).map(k => k.trim());
                        const sKeywords = dialectService.getStepKeywords(dialect).map(k => k.trim());
                        let isLocallyValid = false;

                        if (bKeywords.some(kw => gotText.startsWith(kw + ':'))) {
                            isLocallyValid = true;
                        } else if (sKeywords.some(kw => gotText.startsWith(kw + ' ') || gotText === kw)) {
                            isLocallyValid = true;
                        } else if (gotText.trim().startsWith('|') || gotText.trim().startsWith('"""') || gotText.trim().startsWith("'''") || gotText.trim().startsWith('@') || gotText.trim().startsWith('#')) {
                            isLocallyValid = true;
                        }

                        if (hasFatalSyntaxError && isLocallyValid) {
                            continue;
                        }

                        const blockKeywords = dialectService.getBlockKeywords(dialect);
                        const startsWithBlockKeyword = [...blockKeywords]
                            .sort((a, b) => b.length - a.length)
                            .find(k => gotText.startsWith(k));

                        if (startsWithBlockKeyword && !gotText.startsWith(startsWithBlockKeyword + ':')) {
                            code = 'missing-colon';
                            message = `Missing colon (':') after ${startsWithBlockKeyword}`;
                            suggestedEdit = ':';
                            // Point diagnostic exactly at the end of the keyword where colon is missing
                            startChar = startChar + startsWithBlockKeyword.length;
                            endChar = startChar;
                        } else {
                            const firstWord = gotText.split(/\s+/)[0];
                            const stepKeywords = dialectService.getStepKeywords(dialect);
                            const validKeywords = [...blockKeywords, ...stepKeywords];

                            let bestMatch = '';
                            let lowestDistance = 999;
                            const normalizedFirst = firstWord.toLowerCase();

                            let prefixMatch = '';

                            for (const kw of validKeywords) {
                                const normalizedKw = kw.toLowerCase();

                                // Direct prefix match (e.g. 'whe' -> 'When', 'give' -> 'Given')
                                if (normalizedFirst.length >= 2 && normalizedKw.startsWith(normalizedFirst)) {
                                    if (!prefixMatch || kw.length < prefixMatch.length) {
                                        prefixMatch = kw;
                                    }
                                }

                                // Typo match (e.g. 'Givn' -> 'Given')
                                const dist = getLevenshteinDistance(normalizedFirst, normalizedKw);
                                // Allow up to 2 typos for longer words, 1 typo for short words
                                const threshold = normalizedKw.length <= 4 ? 1 : 2;
                                if (dist < lowestDistance && dist <= threshold) {
                                    lowestDistance = dist;
                                    bestMatch = kw;
                                }
                            }

                            if (prefixMatch) {
                                bestMatch = prefixMatch;
                            }

                            if (bestMatch) {
                                code = 'invalid-keyword';

                                const isBlockKeyword = blockKeywords.includes(bestMatch);

                                if (isBlockKeyword) {
                                    message = `Misspelled or incomplete block keyword: '${firstWord}'. Did you mean '${bestMatch}:'?`;
                                    suggestedEdit = bestMatch + ':';
                                } else {
                                    message = `Misspelled or incomplete keyword: '${firstWord}'. Did you mean '${bestMatch.trim()}'?`;
                                    suggestedEdit = bestMatch.trim();
                                }
                                // Adjust endChar to cover only the misspelled word
                                endChar = startChar + firstWord.length;
                            } else {
                                if (message.includes('expected:')) {
                                    message = `Syntax Error\nInvalid Gherkin syntax. Expected a valid keyword in ${dialect.name} (${validKeywords.slice(0, 5).join(', ')}, etc.)`;
                                } else {
                                    message = `Syntax Error\n${message.replace(/^(\d+:\d+):\s*/, '')}`;
                                }
                            }
                        }
                    } else if (message.includes('inconsistent cell count')) {
                        code = 'table-inconsistency';
                        const tLine = document.lineAt(lineIndex).text.trim();
                        if (tLine.startsWith('|') && !tLine.endsWith('|')) {
                            message = "Table row is missing a closing pipe ('|'). All rows must begin and end with a pipe.";
                        } else {
                            message = "Inconsistent table row: The number of cells (separated by '|') doesn't match the header. Check for missing or extra cells.";
                        }
                    } else {
                        if (message.includes('expected:')) {
                            const validKeywords = [...dialectService.getBlockKeywords(dialect), ...dialectService.getStepKeywords(dialect)];
                            message = `Invalid Gherkin syntax. Expected a valid keyword in ${dialect.name} (${validKeywords.slice(0, 5).join(', ')}, etc.)`;
                        } else {
                            message = message.replace(/^(\d+:\d+):\s*/, '');
                        }
                    }

                    let severity = vscode.DiagnosticSeverity.Error;
                    message = `❌ ${message}`;

                    // Ensure startChar and endChar are bounded properly
                    startChar = Math.max(0, Math.min(startChar, lineText.length));
                    endChar = Math.max(startChar, Math.min(endChar, lineText.length));
                    const range = new vscode.Range(lineIndex, startChar, lineIndex, endChar);

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        message,
                        severity
                    );
                    diagnostic.source = 'Gherkin Parser';
                    diagnostic.code = code;

                    if (suggestedEdit) {
                        diagnostic.relatedInformation = [
                            new vscode.DiagnosticRelatedInformation(
                                new vscode.Location(document.uri, range),
                                suggestedEdit
                            )
                        ];
                    }

                    diagnostics.push(diagnostic);

                    if (code !== 'table-inconsistency') {
                        hasFatalSyntaxError = true;
                    }
                }
            }


        // If parsed successfully, check for undefined steps and semantic issues
        if (gherkinDocument && gherkinDocument.feature) {
            const dialect = dialectService.getDialect(document);
            const allExpectedKeywords = Array.from(new Set([
                ...dialect.feature, ...dialect.background, ...dialect.rule, ...dialect.scenario, ...dialect.scenarioOutline,
                ...dialect.given, ...dialect.when, ...dialect.then, ...dialect.and, ...dialect.but, ...dialect.examples
            ].map(k => k.trim())));

            const blockKeywords = dialectService.getBlockKeywords(dialect);

            this.checkDescription(gherkinDocument.feature, diagnostics, document, allExpectedKeywords, blockKeywords);
            if (gherkinDocument.feature.children) {
                for (const child of gherkinDocument.feature.children) {
                    if (child.rule) {
                        this.checkDescription(child.rule, diagnostics, document, allExpectedKeywords, blockKeywords);
                        if (child.rule.children) {
                            for (const ruleChild of child.rule.children) {
                                const ruleScenario = ruleChild.scenario || ruleChild.background;
                                if (ruleScenario) {
                                    await this.checkSteps(ruleScenario.steps || [], diagnostics, document);
                                    this.checkScenarioExamples(ruleChild.scenario, diagnostics, document);
                                    this.checkDescription(ruleScenario, diagnostics, document, allExpectedKeywords, blockKeywords);
                                }
                            }
                        }
                    } else {
                        const scenario = child.scenario || child.background;
                        if (scenario) {
                            await this.checkSteps(scenario.steps || [], diagnostics, document);
                            this.checkScenarioExamples(child.scenario, diagnostics, document);
                            this.checkDescription(scenario, diagnostics, document, allExpectedKeywords, blockKeywords);
                        }
                    }
                }
            }
        } else {
            // If the document failed to parse (e.g. because of a syntax error like 'Whe'),
            // the AST is null and we can't detect scenario-with-examples via AST.
            // Let's do a fallback text scan just for this specific semantic error.
            this.fallbackCheckScenarioExamples(document, diagnostics, dialect);
        }

        // Always run the fallback misspelled keyword check because Gherkin's forgiving parser
        // often swallows misspelled keywords (like 'Whn') into scenario descriptions without throwing a parse error.
        this.fallbackCheckMisspelledKeywords(document, diagnostics, dialect);

        // Before publishing, verify we are still the most recent request for this document,
        // and the document hasn't been modified or closed during our async parse.
        if (document.isClosed || document.version !== version) {
            process.stdout.write(`\n--- LINTER ABORT: version mismatch or closed. doc=${document.uri.toString()} ---\n`);
            return;
        }

        const uriStr = document.uri.toString();
        const pending = this.pendingRequests.get(uriStr);
        if (pending && pending.requestId !== requestId) {
            process.stdout.write(`\n--- LINTER ABORT: pending request mismatch. doc=${document.uri.toString()} ---\n`);
            return;
        }
        let finalDiagnostics: vscode.Diagnostic[] = [];

        for (const d of diagnostics) {
            const ruleCode = d.code as string;

            // syntax-error is always an error, cannot be disabled
            if (ruleCode === 'syntax-error') {
                finalDiagnostics.push(d);
                continue;
            }

            const severityStr = config.rules[ruleCode];
            if (severityStr === 'off') {
                continue;
            }

            if (severityStr === 'warning') {
                d.severity = vscode.DiagnosticSeverity.Warning;
            } else if (severityStr === 'info') {
                d.severity = vscode.DiagnosticSeverity.Information;
            } else if (severityStr === 'hint') {
                d.severity = vscode.DiagnosticSeverity.Hint;
            } else {
                d.severity = vscode.DiagnosticSeverity.Error;
            }

            finalDiagnostics.push(d);
        }

        this.diagnosticCollection.set(document.uri, finalDiagnostics);
    }

    private fallbackCheckScenarioExamples(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[], dialect: any) {
        let currentScenarioLine = -1;
        let currentScenarioStartChar = -1;

        const scenarioKeywords = dialect.scenario.map((k: string) => k.trim());
        const scenarioOutlineKeywords = dialect.scenarioOutline.map((k: string) => k.trim());
        const examplesKeywords = dialect.examples.map((k: string) => k.trim());
        const otherBlockKeywords = [...dialect.feature, ...dialect.background, ...dialect.rule].map((k: string) => k.trim());

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            const trimmed = line.trim();

            if (trimmed.startsWith('#')) continue;

            // Check if line starts with any Scenario keyword + ':'
            const isScenario = scenarioKeywords.some((k: string) => trimmed.startsWith(k + ':'));
            const isScenarioOutline = scenarioOutlineKeywords.some((k: string) => trimmed.startsWith(k + ':'));
            const isExamples = examplesKeywords.some((k: string) => trimmed.startsWith(k + ':'));
            const isOtherBlock = otherBlockKeywords.some((k: string) => trimmed.startsWith(k + ':'));

            if (isScenario) {
                currentScenarioLine = i;
                const matchKeyword = scenarioKeywords.find((k: string) => trimmed.startsWith(k + ':')) || 'Scenario';
                currentScenarioStartChar = line.indexOf(matchKeyword + ':');
            } else if (isScenarioOutline) {
                currentScenarioLine = -1;
            } else if (isOtherBlock) {
                currentScenarioLine = -1;
            } else if (isExamples) {
                if (currentScenarioLine !== -1) {
                    const matchKeyword = scenarioKeywords.find((k: string) => document.lineAt(currentScenarioLine).text.trim().startsWith(k + ':')) || scenarioKeywords[0] || 'Scenario';
                    const examplesKeyword = examplesKeywords.find((k: string) => trimmed.startsWith(k + ':')) || examplesKeywords[0] || 'Examples';
                    const outlineKeyword = scenarioOutlineKeywords[0] || 'Scenario Outline';

                    const range = new vscode.Range(
                        currentScenarioLine,
                        currentScenarioStartChar,
                        currentScenarioLine,
                        currentScenarioStartChar + matchKeyword.length
                    );
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `A '${matchKeyword}' cannot have '${examplesKeyword}'. Use '${outlineKeyword}' instead.`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.source = 'Gherkin Semantic';
                    diagnostic.code = 'scenario-with-examples';
                    diagnostics.push(diagnostic);

                    currentScenarioLine = -1;
                }
            }
        }
    }

    private fallbackCheckMisspelledKeywords(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[], dialect: any) {
        const expectedKeywords = [...dialect.given, ...dialect.when, ...dialect.then, ...dialect.and, ...dialect.but, ...dialect.examples, ...dialect.scenario, ...dialect.scenarioOutline, ...dialect.background, ...dialect.feature, ...dialect.rule].map((k: string) => k.trim());
        const blockKeywords = dialectService.getBlockKeywords(dialect);

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            if (trimmed.startsWith('|') || trimmed.startsWith('@') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) continue;

            const firstWord = trimmed.split(/\s+/)[0];

            // If it already exactly matches a valid keyword (with or without colon for blocks), it's either correct or will be flagged by syntax parser.
            if (expectedKeywords.includes(firstWord) || expectedKeywords.some((k: string) => firstWord === k + ':')) {
                continue;
            }

            let bestMatch = '';
            let lowestDistance = 999;
            const normalizedFirst = firstWord.toLowerCase();
            const normalizedTrimmed = trimmed.toLowerCase();

            const sortedKeywords = [...expectedKeywords].sort((a, b) => b.length - a.length);

            for (const kw of sortedKeywords) {
                if (normalizedTrimmed.startsWith(kw.toLowerCase())) {
                    bestMatch = kw;
                    break;
                }
            }

            if (!bestMatch) {
                let prefixMatch = '';
                for (const kw of sortedKeywords) {
                    const normalizedKw = kw.toLowerCase();
                    if (normalizedFirst.length >= 2 && normalizedKw.startsWith(normalizedFirst)) {
                        if (!prefixMatch || kw.length < prefixMatch.length) {
                            prefixMatch = kw;
                        }
                    }
                    const dist = getLevenshteinDistance(normalizedFirst, normalizedKw);
                    const threshold = normalizedKw.length <= 4 ? 1 : 2;
                    if (dist < lowestDistance && dist <= threshold) {
                        lowestDistance = dist;
                        bestMatch = kw;
                    }
                }

                if (prefixMatch) {
                    bestMatch = prefixMatch;
                }
            }

            if (bestMatch) {
                const firstNonWhitespace = line.search(/\S/);
                const startChar = firstNonWhitespace !== -1 ? firstNonWhitespace : 0;
                const endChar = startChar + firstWord.length;
                const range = new vscode.Range(i, startChar, i, endChar);
                const isBlockKeyword = blockKeywords.includes(bestMatch);

                let code = 'invalid-keyword';
                let message = '';
                let suggestedEdit = '';

                const isExactMatch = normalizedTrimmed.startsWith(bestMatch.toLowerCase());

                if (isExactMatch || normalizedFirst === bestMatch.toLowerCase()) {
                    if (isBlockKeyword) {
                        code = 'missing-colon';
                        message = `Missing colon (':') after ${bestMatch}`;
                        suggestedEdit = bestMatch + ':';
                    } else {
                        message = `Incorrect casing: '${isExactMatch ? bestMatch.toLowerCase() : firstWord}'. Did you mean '${bestMatch}'?`;
                        suggestedEdit = bestMatch;
                    }
                } else {
                    if (isBlockKeyword) {
                        message = `Misspelled or incomplete block keyword: '${firstWord}'. Did you mean '${bestMatch}:'?`;
                        suggestedEdit = bestMatch + ':';
                    } else {
                        message = `Misspelled or incomplete keyword: '${firstWord}'. Did you mean '${bestMatch}'?`;
                        suggestedEdit = bestMatch;
                    }
                }

                // Check if the syntax error loop ALREADY added an error overlapping this exact range
                const alreadyHasError = diagnostics.some((d: vscode.Diagnostic) => d.range.intersection(range));
                if (!alreadyHasError) {
                    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
                    diagnostic.source = 'Gherkin Semantic';
                    diagnostic.code = code;
                    diagnostic.relatedInformation = [
                        new vscode.DiagnosticRelatedInformation(new vscode.Location(document.uri, range), suggestedEdit)
                    ];
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    private checkDescription(node: any, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument, expectedKeywords: string[], blockKeywords: string[]) {
        if (!node || !node.description) return;

        const descLines = node.description.split('\n');
        // node.location.line is 1-indexed. The description usually starts on the next line (0-indexed).
        let currentLineIdx = node.location.line;

        for (const line of descLines) {
            const trimmed = line.trim();
            if (trimmed) {
                // Find the actual line in the document that matches this line
                while (currentLineIdx < document.lineCount) {
                    if (document.lineAt(currentLineIdx).text.includes(trimmed)) {
                        break;
                    }
                    currentLineIdx++;
                }

                if (currentLineIdx >= document.lineCount) {
                    break; // Failsafe
                }

                const firstWord = trimmed.split(/\s+/)[0];

                let bestMatch = '';
                let lowestDistance = 999;
                const normalizedFirst = firstWord.toLowerCase();
                const normalizedTrimmed = trimmed.toLowerCase();

                const sortedKeywords = [...expectedKeywords].sort((a, b) => b.length - a.length);

                for (const kw of sortedKeywords) {
                    if (normalizedTrimmed.startsWith(kw.toLowerCase())) {
                        bestMatch = kw;
                        break;
                    }
                }

                if (!bestMatch) {
                    let prefixMatch = '';
                    for (const kw of sortedKeywords) {
                        const normalizedKw = kw.toLowerCase();
                        if (normalizedFirst.length >= 2 && normalizedKw.startsWith(normalizedFirst)) {
                            if (!prefixMatch || kw.length < prefixMatch.length) {
                                prefixMatch = kw;
                            }
                        }
                        const dist = getLevenshteinDistance(normalizedFirst, normalizedKw);
                        const threshold = normalizedKw.length <= 4 ? 1 : 2;
                        if (dist < lowestDistance && dist <= threshold) {
                            lowestDistance = dist;
                            bestMatch = kw;
                        }
                    }
                }

                if (bestMatch) {
                    const documentLineText = document.lineAt(currentLineIdx).text;
                    const firstNonWhitespace = documentLineText.search(/\S/);
                    let startChar = firstNonWhitespace !== -1 ? firstNonWhitespace : 0;
                    let endChar = startChar + firstWord.length;

                    let code = 'invalid-keyword';
                    let message = `Misspelled or incomplete keyword: '${firstWord}'. Did you mean '${bestMatch}'?`;
                    let suggestedEdit = bestMatch;

                    const isExactMatch = normalizedTrimmed.startsWith(bestMatch.toLowerCase());
                    const isBlockKeyword = blockKeywords.includes(bestMatch);

                    if (isExactMatch || normalizedFirst === bestMatch.toLowerCase()) {
                        if (isBlockKeyword) {
                            code = 'missing-colon';
                            message = `Missing colon (':') after ${bestMatch}`;
                            suggestedEdit = ':';
                            startChar = endChar;
                        } else {
                            if (isExactMatch && trimmed.startsWith(bestMatch)) {
                                currentLineIdx++;
                                continue;
                            } else {
                                code = 'invalid-keyword';
                                message = `Incorrect casing: '${isExactMatch ? bestMatch.toLowerCase() : firstWord}'. Did you mean '${bestMatch}'?`;
                                suggestedEdit = bestMatch;
                            }
                        }
                    } else {
                        // Typo or prefix
                        if (isBlockKeyword) {
                            // Since it's in the description and a block keyword, it's missing a colon too!
                            code = 'invalid-keyword';
                            message = `Misspelled or incomplete block keyword: '${firstWord}'. Did you mean '${bestMatch}:'?`;
                            suggestedEdit = bestMatch + ':';
                        } else {
                            code = 'invalid-keyword';
                            message = `Misspelled or incomplete step keyword: '${firstWord}'. Did you mean '${bestMatch}'?`;
                            suggestedEdit = bestMatch;
                        }
                    }

                    const range = new vscode.Range(currentLineIdx, startChar, currentLineIdx, endChar);
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        message,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.source = 'Gherkin Semantic';
                    diagnostic.code = code;
                    diagnostic.relatedInformation = [
                        new vscode.DiagnosticRelatedInformation(
                            new vscode.Location(document.uri, range),
                            suggestedEdit
                        )
                    ];
                    diagnostics.push(diagnostic);
                }
            }
            currentLineIdx++;
        }
    }

    private checkScenarioExamples(scenario: any, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        const dialect = dialectService.getDialect(document);
        const scenarioKeywords = dialect.scenario.map(k => k.trim());
        const examplesKeywords = dialect.examples.map(k => k.trim());

        if (scenario && scenario.keyword && scenarioKeywords.includes(scenario.keyword.trim()) && scenario.examples && scenario.examples.length > 0) {
            const lineIndex = Math.max(0, scenario.location.line - 1);
            const startChar = Math.max(0, scenario.location.column - 1);
            const endChar = startChar + scenario.keyword.length;

            const matchKeyword = scenario.keyword.trim();
            const examplesKeyword = examplesKeywords[0] || 'Examples';
            const outlineKeyword = dialect.scenarioOutline[0]?.trim() || 'Scenario Outline';

            const range = new vscode.Range(lineIndex, startChar, lineIndex, endChar);
            const diagnostic = new vscode.Diagnostic(
                range,
                `A '${matchKeyword}' cannot have '${examplesKeyword}'. Use '${outlineKeyword}' instead.`,
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'Gherkin Semantic';
            diagnostic.code = 'scenario-with-examples';
            diagnostics.push(diagnostic);
        }
    }

    private async checkSteps(steps: readonly Step[], diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        if (this.symbolCache.state !== 'ready') {
            return;
        }
        for (const step of steps) {
            const stepText = step.text.trim();
            const keyword = step.keyword ? step.keyword.trim() : '';

            let semanticType: 'given' | 'when' | 'then' | 'step' = 'step';
            const dialect = dialectService.getDialect(document);

            if (dialect.given.map(k => k.trim()).includes(keyword)) {
                semanticType = 'given';
            } else if (dialect.when.map(k => k.trim()).includes(keyword)) {
                semanticType = 'when';
            } else if (dialect.then.map(k => k.trim()).includes(keyword)) {
                semanticType = 'then';
            } else {
                // For And, But, or * we resolve the context from previous steps
                semanticType = dialectService.resolveAndBut(document, Math.max(0, step.location.line - 1));
            }

            const defs = await this.symbolCache.getStepDefinitions(stepText, semanticType);
            if (defs.length !== 1) {
                const lineIndex = Math.max(0, step.location.line - 1);
                const lineText = document.lineAt(lineIndex).text;

                // Highlight just the step text (after the keyword)
                let startChar = step.location.column ? Math.max(0, step.location.column - 1) : 0;

                // Adjust start character to skip keyword and following space if possible
                const textIndex = lineText.indexOf(stepText, startChar);
                if (textIndex !== -1) {
                    startChar = textIndex;
                }

                const endChar = startChar + stepText.length;
                const range = new vscode.Range(lineIndex, startChar, lineIndex, Math.max(startChar + 1, endChar));

                if (defs.length === 0) {
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `⚠️ Undefined step: "${stepText}"`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'Gherkin Definition';
                    diagnostic.code = 'undefined-step';

                    // Attach the keyword as related information string for the code action to use
                    diagnostic.relatedInformation = [
                        new vscode.DiagnosticRelatedInformation(
                            new vscode.Location(document.uri, range),
                            step.keyword.trim()
                        )
                    ];

                    diagnostics.push(diagnostic);
                } else if (defs.length > 1) {
                    const patterns = defs.map(d => `'${d.rawPattern}'`).join(', ');
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `⚠️ Ambiguous step: matches multiple definitions (${patterns})`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'Gherkin Definition';
                    diagnostic.code = 'ambiguous-step';
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    /**
     * Clears diagnostics for a specific document.
     */
    public clear(document: vscode.TextDocument) {
        const uriStr = document.uri.toString();
        this.invalidationQueue.delete(uriStr);
        const pending = this.pendingRequests.get(uriStr);
        if (pending?.timer) {
            clearTimeout(pending.timer);
        }
        this.pendingRequests.delete(uriStr);
        this.diagnosticCollection.delete(document.uri);
    }

    /**
     * Disposes the diagnostic collection.
     */
    public dispose() {
        for (const [_, pending] of this.pendingRequests) {
            if (pending.timer) {
                clearTimeout(pending.timer);
            }
        }
        this.pendingRequests.clear();
        this.eventBusDisposable?.dispose();
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
    }
}

function getLevenshteinDistance(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}
