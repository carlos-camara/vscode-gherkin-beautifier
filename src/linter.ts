import * as vscode from 'vscode';
import { SymbolCache } from './cache';
import { dialectService } from './dialect';
import { parseGherkin } from './parser';
import type { GherkinDocument, Step } from '@cucumber/messages';
import { ConfigurationService } from './configuration';

/**
 * Diagnostic Provider that acts as a realtime Linter for Gherkin files.
 * It uses the official @cucumber/gherkin AST parser to catch syntax errors instantly.
 */
export class GherkinLinter {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private symbolCache: SymbolCache;
    private pendingRequests: Map<string, { timer?: NodeJS.Timeout, requestId: number }> = new Map();
    private nextRequestId: number = 0;

    constructor(symbolCache: SymbolCache, private configService: ConfigurationService) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('gherkin');
        this.symbolCache = symbolCache;
    }

    /**
     * Schedules a debounced linting request for a document.
     */
    public scheduleLint(document: vscode.TextDocument, delayMs: number = 250) {
        const uriStr = document.uri.toString();
        const existing = this.pendingRequests.get(uriStr);
        if (existing?.timer) {
            clearTimeout(existing.timer);
        }

        const requestId = ++this.nextRequestId;
        const timer = setTimeout(() => {
            this.lint(document, requestId, document.version);
        }, delayMs);

        this.pendingRequests.set(uriStr, { timer, requestId });
    }

    /**
     * Immediately lints a document, bypassing any active debounce.
     */
    public immediateLint(document: vscode.TextDocument) {
        const uriStr = document.uri.toString();
        const existing = this.pendingRequests.get(uriStr);
        if (existing?.timer) {
            clearTimeout(existing.timer);
        }

        const requestId = ++this.nextRequestId;
        this.pendingRequests.set(uriStr, { requestId });
        this.lint(document, requestId, document.version);
    }

    /**
     * Lints the document and applies diagnostics.
     * @param document The VS Code text document to lint.
     * @param requestId The execution request ID to track stale runs.
     * @param version The document version at the time of the request.
     */
    public async lint(document: vscode.TextDocument, requestId: number = ++this.nextRequestId, version: number = document.version) {
        if (document.languageId !== 'feature' && document.languageId !== 'gherkin') {
            return;
        }

        const config = this.configService.getConfiguration(document.uri);
        if (!config.linter.enabled) {
            vscode.window.showInformationMessage("Linter is currently DISABLED by configuration.");
            this.diagnosticCollection.delete(document.uri);
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const dialect = dialectService.getDialect(document);
        let gherkinDocument: GherkinDocument | null = null;
        const result = await parseGherkin(text);
        gherkinDocument = result.document;
        const errors = result.errors;
        
        let hasFatalSyntaxError = false;

        for (const error of errors) {
            const location = error.location;
            if (location && typeof location.line === 'number') {
                // AST locations are 1-indexed, VS Code positions are 0-indexed
                const lineIndex = Math.min(Math.max(0, location.line - 1), document.lineCount > 0 ? document.lineCount - 1 : 0);
                const lineText = document.lineCount > 0 ? document.lineAt(lineIndex).text : '';
                
                // Column from AST is 1-indexed. If not present or 0, default to first non-whitespace char.
                let startChar = location.column ? Math.max(0, location.column - 1) : 0;
                if (startChar === 0) {
                    const firstWordMatch = lineText.match(/\S+/);
                    startChar = firstWordMatch ? lineText.indexOf(firstWordMatch[0]) : 0;
                }
                    
                    // Try to highlight the word at the error column, or just the rest of the line
                    const matchRest = lineText.substring(startChar).match(/\S+/);
                    let endChar = matchRest ? startChar + matchRest[0].length : lineText.length;
                    
                    // Format the error message cleanly
                    let message = error.message;
                    let code = 'SYNTAX_ERROR';
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
                        const startsWithBlockKeyword = blockKeywords.find(k => gotText.startsWith(k));
                        
                        if (startsWithBlockKeyword && !gotText.startsWith(startsWithBlockKeyword + ':')) {
                            code = 'MISSING_COLON';
                            message = `Missing colon (':') after ${startsWithBlockKeyword}`;
                            suggestedEdit = startsWithBlockKeyword + ':';
                            // Adjust endChar to cover the full keyword
                            endChar = startChar + startsWithBlockKeyword.length;
                        } else {
                            const firstWord = gotText.split(/\s+/)[0];
                            const stepKeywords = dialectService.getStepKeywords(dialect);
                            const validKeywords = [...blockKeywords, ...stepKeywords];
                            
                            let bestMatch = '';
                            let lowestDistance = 999;
                            const normalizedFirst = firstWord.toLowerCase();

                            for (const kw of validKeywords) {
                                const normalizedKw = kw.toLowerCase();
                                
                                // Direct prefix match (e.g. 'whe' -> 'When', 'give' -> 'Given')
                                if (normalizedFirst.length >= 2 && normalizedKw.startsWith(normalizedFirst)) {
                                    bestMatch = kw;
                                    break;
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
                            
                            if (bestMatch) {
                                code = 'MISSPELLED_KEYWORD';
                                
                                const isBlockKeyword = blockKeywords.includes(bestMatch);
                                
                                if (isBlockKeyword) {
                                    message = `Misspelled or incomplete block keyword: '${firstWord}'. Did you mean '${bestMatch}:'?`;
                                    suggestedEdit = bestMatch + ':';
                                } else {
                                    message = `Misspelled or incomplete keyword: '${firstWord}'. Did you mean '${bestMatch}'?`;
                                    suggestedEdit = bestMatch;
                                }
                                endChar = startChar + firstWord.length;
                            } else {
                                if (message.includes('expected:')) {
                                    message = `Invalid Gherkin syntax. Expected a valid keyword in ${dialect.name} (${validKeywords.slice(0, 5).join(', ')}, etc.)`;
                                } else {
                                    message = message.replace(/^(\d+:\d+):\s*/, '');
                                }
                            }
                        }
                    } else if (message.includes('inconsistent cell count')) {
                        // The parser reports the error on the first row that diffs from the previous rows.
                        // However, the missing pipe could be on the header row or a previous row.
                        // We will scan up and down to find the row(s) missing a pipe.
                        let foundMissingPipe = false;
                        
                        // Find start of table
                        let tableStart = lineIndex;
                        while (tableStart > 0 && document.lineAt(tableStart - 1).text.trim().startsWith('|')) {
                            tableStart--;
                        }
                        
                        // Find end of table
                        let tableEnd = lineIndex;
                        while (tableEnd < document.lineCount - 1 && document.lineAt(tableEnd + 1).text.trim().startsWith('|')) {
                            tableEnd++;
                        }

                        for (let i = tableStart; i <= tableEnd; i++) {
                            const tLine = document.lineAt(i).text;
                            if (tLine.trim().startsWith('|') && !tLine.trim().endsWith('|')) {
                                foundMissingPipe = true;
                                const firstNonWhitespace = tLine.search(/\S/);
                                const tStartChar = firstNonWhitespace !== -1 ? firstNonWhitespace : 0;
                                const tEndChar = tLine.length;
                                
                                const range = new vscode.Range(i, tStartChar, i, tEndChar);
                                const diagnostic = new vscode.Diagnostic(
                                    range,
                                    'Inconsistent cell count. Missing closing pipe?',
                                    vscode.DiagnosticSeverity.Error
                                );
                                diagnostic.source = 'Gherkin Parser';
                                diagnostic.code = 'INCONSISTENT_CELL_COUNT';
                                diagnostic.relatedInformation = [
                                    new vscode.DiagnosticRelatedInformation(
                                        new vscode.Location(document.uri, range),
                                        tLine.substring(tStartChar) + ' |'
                                    )
                                ];
                                diagnostics.push(diagnostic);
                            }
                        }

                        if (foundMissingPipe) {
                            // We already added specific diagnostics for the bad rows, so we can skip adding a generic one.
                            continue;
                        } else {
                            code = 'INCONSISTENT_CELL_COUNT';
                            message = 'Inconsistent cell count in table row.';
                        }
                    } else {
                        if (message.includes('expected:')) {
                            const validKeywords = [...dialectService.getBlockKeywords(dialect), ...dialectService.getStepKeywords(dialect)];
                            message = `Invalid Gherkin syntax. Expected a valid keyword in ${dialect.name} (${validKeywords.slice(0, 5).join(', ')}, etc.)`;
                        } else {
                            message = message.replace(/^(\d+:\d+):\s*/, '');
                        }
                    }

                    const range = new vscode.Range(lineIndex, startChar, lineIndex, Math.max(startChar, endChar));

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        message,
                        vscode.DiagnosticSeverity.Error
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
                    
                    if (code !== 'INCONSISTENT_CELL_COUNT') {
                        hasFatalSyntaxError = true;
                    }
                }
            }


        // If parsed successfully, check for undefined steps and semantic issues
        if (gherkinDocument && gherkinDocument.feature) {
            const dialect = dialectService.getDialect(document);
            const featureExpectedKeywords = [...dialect.background, ...dialect.rule, ...dialect.scenario, ...dialect.scenarioOutline].map(k => k.trim());
            const ruleExpectedKeywords = [...dialect.background, ...dialect.scenario, ...dialect.scenarioOutline].map(k => k.trim());
            const scenarioExpectedKeywords = [...dialect.given, ...dialect.when, ...dialect.then, ...dialect.and, ...dialect.but, ...dialect.examples, ...dialect.scenario, ...dialect.scenarioOutline].map(k => k.trim());
            const blockKeywords = dialectService.getBlockKeywords(dialect);

            this.checkDescription(gherkinDocument.feature, diagnostics, document, featureExpectedKeywords, blockKeywords);
            if (gherkinDocument.feature.children) {
                for (const child of gherkinDocument.feature.children) {
                    if (child.rule) {
                        this.checkDescription(child.rule, diagnostics, document, ruleExpectedKeywords, blockKeywords);
                        if (child.rule.children) {
                            for (const ruleChild of child.rule.children) {
                                const ruleScenario = ruleChild.scenario || ruleChild.background;
                                if (ruleScenario) {
                                    await this.checkSteps(ruleScenario.steps || [], diagnostics, document);
                                    this.checkScenarioExamples(ruleChild.scenario, diagnostics, document);
                                    this.checkDescription(ruleScenario, diagnostics, document, scenarioExpectedKeywords, blockKeywords);
                                }
                            }
                        }
                    } else {
                        const scenario = child.scenario || child.background;
                        if (scenario) {
                            await this.checkSteps(scenario.steps || [], diagnostics, document);
                            this.checkScenarioExamples(child.scenario, diagnostics, document);
                            this.checkDescription(scenario, diagnostics, document, scenarioExpectedKeywords, blockKeywords);
                        }
                    }
                }
            }
        } else {
            // If the document failed to parse (e.g. because of a syntax error like 'Whe'),
            // the AST is null and we can't detect SCENARIO_WITH_EXAMPLES via AST.
            // Let's do a fallback text scan just for this specific semantic error.
            this.fallbackCheckScenarioExamples(document, diagnostics, dialect);
            this.fallbackCheckMisspelledKeywords(document, diagnostics, dialect);
        }

        // Before publishing, verify we are still the most recent request for this document,
        // and the document hasn't been modified or closed during our async parse.
        if (document.isClosed || document.version !== version) {
            return;
        }

        const uriStr = document.uri.toString();
        const pending = this.pendingRequests.get(uriStr);
        if (pending && pending.requestId !== requestId) {
            return;
        }
        let finalDiagnostics = diagnostics;
        if (config.linter.enabledRules && config.linter.enabledRules.length > 0) {
            finalDiagnostics = diagnostics.filter(d => typeof d.code === 'string' && config.linter.enabledRules.includes(d.code));
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
                    diagnostic.code = 'SCENARIO_WITH_EXAMPLES';
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

            for (const kw of expectedKeywords) {
                const normalizedKw = kw.toLowerCase();
                if (normalizedFirst.length >= 2 && normalizedKw.startsWith(normalizedFirst)) {
                    bestMatch = kw;
                    break;
                }
                const dist = getLevenshteinDistance(normalizedFirst, normalizedKw);
                const threshold = normalizedKw.length <= 4 ? 1 : 2;
                if (dist < lowestDistance && dist <= threshold) {
                    lowestDistance = dist;
                    bestMatch = kw;
                }
            }

            if (bestMatch) {
                const firstNonWhitespace = line.search(/\S/);
                const startChar = firstNonWhitespace !== -1 ? firstNonWhitespace : 0;
                const endChar = startChar + firstWord.length;
                const range = new vscode.Range(i, startChar, i, endChar);
                const isBlockKeyword = blockKeywords.includes(bestMatch);
                
                let code = 'MISSPELLED_KEYWORD';
                let message = '';
                let suggestedEdit = '';

                if (normalizedFirst === bestMatch.toLowerCase()) {
                    if (isBlockKeyword) {
                        code = 'MISSING_COLON';
                        message = `Missing colon (':') after ${bestMatch}`;
                        suggestedEdit = bestMatch + ':';
                    } else {
                        message = `Incorrect casing: '${firstWord}'. Did you mean '${bestMatch}'?`;
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

                // Do not scan arbitrary description text aggressively.
                // We only fuzzily match against structural keywords EXPECTED in this section.
                for (const kw of expectedKeywords) {
                    const normalizedKw = kw.toLowerCase();
                    if (normalizedFirst.length >= 2 && normalizedKw.startsWith(normalizedFirst)) {
                        bestMatch = kw;
                        break;
                    }
                    const dist = getLevenshteinDistance(normalizedFirst, normalizedKw);
                    const threshold = normalizedKw.length <= 4 ? 1 : 2;
                    if (dist < lowestDistance && dist <= threshold) {
                        lowestDistance = dist;
                        bestMatch = kw;
                    }
                }

                if (bestMatch) {
                    const documentLineText = document.lineAt(currentLineIdx).text;
                    const firstNonWhitespace = documentLineText.search(/\S/);
                    const startChar = firstNonWhitespace !== -1 ? firstNonWhitespace : 0;
                    const endChar = startChar + firstWord.length;
                    const range = new vscode.Range(currentLineIdx, startChar, currentLineIdx, endChar);

                    const isBlockKeyword = blockKeywords.includes(bestMatch);

                    let code = '';
                    let message = '';
                    let suggestedEdit = '';

                    if (normalizedFirst === bestMatch.toLowerCase()) {
                        // Exact match (case insensitive)
                        if (isBlockKeyword) {
                            // They spelled it perfectly but it's in the description. They forgot the colon!
                            code = 'MISSING_COLON';
                            message = `Missing colon (':') after ${bestMatch}`;
                            suggestedEdit = bestMatch + ':';
                        } else {
                            // Step keyword.
                            if (firstWord === bestMatch) {
                                // Exactly correctly cased. It's just out of place (likely due to structural error above). Do not flag.
                                currentLineIdx++;
                                continue;
                            } else {
                                // e.g., 'given' instead of 'Given'. Offer to fix casing.
                                code = 'MISSPELLED_KEYWORD';
                                message = `Incorrect casing: '${firstWord}'. Did you mean '${bestMatch}'?`;
                                suggestedEdit = bestMatch;
                            }
                        }
                    } else {
                        // Typo or prefix
                        if (isBlockKeyword) {
                            // Since it's in the description and a block keyword, it's missing a colon too!
                            code = 'MISSPELLED_KEYWORD';
                            message = `Misspelled or incomplete block keyword: '${firstWord}'. Did you mean '${bestMatch}:'?`;
                            suggestedEdit = bestMatch + ':';
                        } else {
                            code = 'MISSPELLED_KEYWORD';
                            message = `Misspelled or incomplete keyword: '${firstWord}'. Did you mean '${bestMatch}'?`;
                            suggestedEdit = bestMatch;
                        }
                    }

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
            diagnostic.code = 'SCENARIO_WITH_EXAMPLES';
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
                        `Undefined step: "${stepText}"`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'Gherkin Definition';
                    diagnostic.code = 'UNDEFINED_STEP';
                    
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
                        `Ambiguous step: matches multiple definitions (${patterns})`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.source = 'Gherkin Definition';
                    diagnostic.code = 'AMBIGUOUS_STEP';
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
