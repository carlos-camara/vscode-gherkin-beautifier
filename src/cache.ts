import * as vscode from 'vscode';
import { logger } from './logger';
import { discoveryService } from './discovery';
import { astRepository } from './ast';
import { parsePythonDecorators } from './tokenizer';
import type { Tag, Scenario } from '@cucumber/messages';
import { WorkspaceEventBus } from './eventBus';
export interface StepDefinition {
    type: 'given' | 'when' | 'then' | 'step';
    rawPattern: string;
    matcherType: 'parse' | 'cfparse' | 're';
    regex?: RegExp;
    evaluable: boolean;
    compilationError?: string;
    decoratorRange: vscode.Range;
    functionRange?: vscode.Range;
    functionName?: string;
    documentation?: string;
    uri: vscode.Uri;
}

type CacheState = 'uninitialized' | 'initializing' | 'ready' | 'failed';

export class SymbolCache {
    // Map of file URI string to a list of step definitions in that file
    private cache: Map<string, StepDefinition[]> = new Map();
    public state: CacheState = 'uninitialized';
    private initPromise: Promise<void> | null = null;
    private eventBus?: WorkspaceEventBus;
    private eventBusDisposable?: vscode.Disposable;

    /**
     * Subscribes to the Workspace Event Bus to receive file system and editor changes.
     * This service relies on the Event Bus for lifecycle updates rather than direct API calls.
     */
    public setEventBus(eventBus: WorkspaceEventBus) {
        this.eventBus = eventBus;
        this.eventBusDisposable?.dispose();
        this.eventBusDisposable = this.eventBus.onEvent(e => {
            if (e.type === 'stepFileCreated' || e.type === 'stepFileChanged') {
                this.updateFile(e.uri);
            } else if (e.type === 'textDocumentOpened' || e.type === 'textDocumentChanged') {
                const doc = e.type === 'textDocumentOpened' ? e.document : e.event.document;
                if (doc.languageId === 'python') {
                    this.updateFile(doc.uri);
                }
            } else if (e.type === 'stepFileDeleted') {
                this.removeFile(e.uri);
            } else if (e.type === 'configurationChanged') {
                if (e.event && (e.event.affectsConfiguration('gherkinPowerTools.behave.stepGlobs') || e.event.affectsConfiguration('gherkinPowerTools.behave.ignoreGlobs'))) {
                    this.clear();
                    this.ensureInitialized();
                }
            }
        });
    }

    public clear(): void {
        this.cache.clear();
        this.state = 'uninitialized';
        this.initPromise = null;
    }

    public dispose(): void {
        this.eventBusDisposable?.dispose();
        this.clear();
    }

    public ensureInitialized(): Promise<void> {
        if (this.state === 'initializing' || this.state === 'ready') {
            return this.initPromise!;
        }
        
        this.state = 'initializing';
        this.initPromise = (async () => {
            try {
                const stepFiles = await discoveryService.getStepFiles();
                await Promise.all(stepFiles.map(file => this.updateFile(file)));

                this.state = 'ready';
                logger.info(`Gherkin PowerTools: Symbol cache initialized with ${stepFiles.length} files.`);
            } catch (err) {
                this.state = 'failed';
                logger.error('Error initializing symbol cache:', err);
            }
        })();
        
        return this.initPromise;
    }

    private updateDebounce: Map<string, { timeout: NodeJS.Timeout, resolves: Array<() => void> }> = new Map();

    public async updateFile(uri: vscode.Uri): Promise<void> {
        const uriString = uri.toString();
        
        return new Promise<void>((resolve) => {
            const existing = this.updateDebounce.get(uriString);
            if (existing) {
                clearTimeout(existing.timeout);
                existing.resolves.push(resolve);
            }
            
            const resolves = existing ? existing.resolves : [resolve];

            const timeout = setTimeout(async () => {
                this.updateDebounce.delete(uriString);
                await this.processFile(uri);
                resolves.forEach(r => r());
            }, 300);

            this.updateDebounce.set(uriString, { timeout, resolves });
        });
    }

    private async processFile(uri: vscode.Uri): Promise<void> {
        try {
            let content = '';
            const openDoc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
            if (openDoc) {
                content = openDoc.getText();
            } else {
                const rawBytes = await vscode.workspace.fs.readFile(uri);
                content = new TextDecoder('utf8').decode(rawBytes);
            }
            const lines = content.split(/\r?\n/);
            const definitions: StepDefinition[] = [];

            const decorators = parsePythonDecorators(content);

            for (const dec of decorators) {
                const stepType = dec.type;
                const rawPattern = dec.argumentText;

                let matcherType: 'parse' | 'cfparse' | 're' = 'parse';
                const firstLine = lines[dec.startLine] || '';
                if (firstLine.match(/@(given|when|then|step)\s*\(\s*re\./i) || rawPattern.includes('(?P<')) {
                    matcherType = 're';
                } else if (rawPattern.includes('{') && rawPattern.includes('}')) {
                    matcherType = 'parse';
                }

                let regexPattern = rawPattern;
                if (matcherType === 're') {
                    regexPattern = regexPattern.replace(/\(\?P<[^>]+>/g, '(');
                } else {
                    // Escape regex characters and replace \{param\} with .*
                    regexPattern = regexPattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '.*');
                }

                // Prevent exponential backtracking
                regexPattern = regexPattern.replace(/(?:\.\*)+/g, '.*');

                const decoratorRange = new vscode.Range(dec.startLine, dec.startCol, dec.endLine, dec.endCol);

                    let functionName: string | undefined;
                    let functionRange: vscode.Range | undefined;
                    let documentation: string | undefined;

                    for (let j = dec.endLine + 1; j < Math.min(dec.endLine + 15, lines.length); j++) {
                        const aheadLine = lines[j].trim();
                        if (!functionName && aheadLine.startsWith('def ')) {
                            const defMatch = aheadLine.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
                            if (defMatch) {
                                functionName = defMatch[1];
                                const defStartLine = j;
                                const defStartCol = lines[j].indexOf('def ');
                                
                                let currentLineIdx = j;
                                let functionSignature = aheadLine;
                                while (!functionSignature.endsWith(':') && currentLineIdx + 1 < lines.length) {
                                    currentLineIdx++;
                                    const nextLine = lines[currentLineIdx].trim();
                                    functionSignature += ' ' + nextLine;
                                }
                                
                                functionRange = new vscode.Range(
                                    defStartLine, Math.max(0, defStartCol),
                                    currentLineIdx, lines[currentLineIdx].length
                                );
                                
                                for (let k = currentLineIdx + 1; k < Math.min(currentLineIdx + 10, lines.length); k++) {
                                    const docLine = lines[k].trim();
                                    if (docLine.startsWith('"""') || docLine.startsWith("'''")) {
                                        const quote = docLine.substring(0, 3);
                                        let doc = docLine.substring(3);
                                        if (doc.endsWith(quote) && docLine.length > 3) {
                                            documentation = doc.slice(0, -3).trim();
                                            break;
                                        } else {
                                            let fullDoc = doc + '\n';
                                            for (let m = k + 1; m < lines.length; m++) {
                                                const mLine = lines[m];
                                                const mTrimmed = mLine.trim();
                                                if (mTrimmed.endsWith(quote)) {
                                                    fullDoc += mLine.substring(0, mLine.lastIndexOf(quote));
                                                    break;
                                                }
                                                fullDoc += mLine + '\n';
                                            }
                                            documentation = fullDoc.trim();
                                            break;
                                        }
                                    } else if (docLine !== '') {
                                        break;
                                    }
                                }
                            }
                            break;
                        }
                    }

                    let regex: RegExp | undefined;
                    let evaluable = true;
                    let compilationError: string | undefined;

                    if (!dec.isStringLiteral) {
                        evaluable = false;
                        compilationError = 'Dynamic Python expression is not supported';
                        logger.debug(`Skipping dynamic expression for step: ${rawPattern}.`);
                    } else {
                        try {
                            regex = new RegExp('^' + regexPattern + '$', 'i');
                        } catch (e: any) {
                            evaluable = false;
                            compilationError = e.message;
                            logger.debug(`Skipping regex compilation for step: ${rawPattern}. Error: ${e.message}`);
                        }
                    }

                    definitions.push({
                        type: stepType,
                        rawPattern,
                        matcherType,
                        regex,
                        evaluable,
                        compilationError,
                        decoratorRange,
                        functionRange,
                        functionName,
                        documentation,
                        uri
                    });
            }

            this.cache.set(uri.toString(), definitions);
            this.eventBus?.publish({ type: 'stepDefinitionsUpdated', uri });
        } catch (err) {
            logger.error(`Error updating cache for file ${uri.fsPath}:`, err);
            this.removeFile(uri);
        }
    }

    public removeFile(uri: vscode.Uri): void {
        const uriString = uri.toString();
        const existingTimeout = this.updateDebounce.get(uriString);
        if (existingTimeout) {
            clearTimeout(existingTimeout.timeout);
            existingTimeout.resolves.forEach(r => r());
            this.updateDebounce.delete(uriString);
        }
        this.cache.delete(uriString);
    }

    public async getStepDefinitions(stepText: string, semanticType?: 'given' | 'when' | 'then' | 'step'): Promise<StepDefinition[]> {
        await this.ensureInitialized();
        const matches: StepDefinition[] = [];
        for (const [_, definitions] of this.cache) {
            for (const def of definitions) {
                if (semanticType && semanticType !== 'step' && def.type !== 'step' && def.type !== semanticType) {
                    continue;
                }
                if (def.evaluable && def.regex && def.regex.test(stepText)) {
                    matches.push(def);
                }
            }
        }
        return matches;
    }

    public async getAllStepDefinitions(semanticType?: 'given' | 'when' | 'then' | 'step'): Promise<StepDefinition[]> {
        await this.ensureInitialized();
        const definitions: StepDefinition[] = [];
        for (const [_, defs] of this.cache) {
            for (const def of defs) {
                if (semanticType && semanticType !== 'step' && def.type !== 'step' && def.type !== semanticType) {
                    continue;
                }
                definitions.push(def);
            }
        }
        return definitions;
    }
}


interface FileState {
    counts: Map<string, number>;
    status: 'current' | 'stale' | 'partial';
}

export class FeatureCache {
    private fileTagCounts: Map<string, FileState> = new Map();
    private globalTagCount: Map<string, number> = new Map();
    private updateDebounce: Map<string, { timeout: NodeJS.Timeout, resolves: Array<() => void> }> = new Map();

    public state: CacheState = 'uninitialized';
    private initPromise: Promise<void> | null = null;
    private eventBus?: WorkspaceEventBus;
    private eventBusDisposable?: vscode.Disposable;

    /**
     * Subscribes to the Workspace Event Bus to receive file system and editor changes.
     * This service relies on the Event Bus for lifecycle updates rather than direct API calls.
     */
    public setEventBus(eventBus: WorkspaceEventBus) {
        this.eventBus = eventBus;
        this.eventBusDisposable?.dispose();
        this.eventBusDisposable = this.eventBus.onEvent(e => {
            if (e.type === 'featureFileCreated' || e.type === 'featureFileChanged') {
                this.updateFile(e.uri);
            } else if (e.type === 'featureFileDeleted') {
                this.removeFile(e.uri);
            }
        });
    }

    public ensureInitialized(): Promise<void> {
        if (this.state === 'ready' || this.state === 'initializing') {
            return this.initPromise!;
        }

        this.state = 'initializing';
        this.initPromise = (async () => {
            try {
                const featureFiles = await vscode.workspace.findFiles('**/*.feature', '**/node_modules/**');
                for (const file of featureFiles) {
                    await this.updateFile(file);
                }
                this.state = 'ready';
                logger.info(`Gherkin PowerTools: Feature cache initialized with ${featureFiles.length} files.`);
            } catch (err) {
                this.state = 'failed';
                logger.error('Error initializing feature cache:', err);
            }
        })();
        
        return this.initPromise;
    }

    public async updateFile(uri: vscode.Uri): Promise<void> {
        const uriString = uri.toString();
        
        return new Promise<void>((resolve) => {
            const existing = this.updateDebounce.get(uriString);
            if (existing) {
                clearTimeout(existing.timeout);
                existing.resolves.push(resolve);
            }
            
            const resolves = existing ? existing.resolves : [resolve];

            const timeout = setTimeout(async () => {
                this.updateDebounce.delete(uriString);
                await this.processFile(uri);
                resolves.forEach(r => r());
            }, 300);

            this.updateDebounce.set(uriString, { timeout, resolves });
        });
    }

    private async processFile(uri: vscode.Uri): Promise<void> {
        let content: string;
        try {
            // Prefer open document
            const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
            if (doc) {
                content = doc.getText();
            } else {
                const bytes = await vscode.workspace.fs.readFile(uri);
                content = new TextDecoder('utf8').decode(bytes);
            }
        } catch (err) {
            logger.error(`Error reading feature file ${uri.toString()}:`, err);
            // File read failure (e.g. temporary unreachability for remote fs). Retain old state but mark stale.
            const existing = this.fileTagCounts.get(uri.toString());
            if (existing) {
                existing.status = 'stale';
            }
            return;
        }

        try {
            const { document: docAST, errors } = await astRepository.getAST({ uri, version: 0, getText: () => content });
            const tagCounts = new Map<string, number>();

            const addTagCount = (tag: string, count: number) => {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + count);
            };

            const processTags = (tags: readonly Tag[] | undefined): string[] => {
                if (!tags) return [];
                return tags.map(t => t.name);
            };

            const traverse = (node: Scenario, inheritedTags: string[]) => {
                const currentTags = processTags(node.tags);
                const allTags = [...new Set([...inheritedTags, ...currentTags])];

                // Check if the scenario has examples (Scenario Outline)
                if (node.examples && node.examples.length > 0) {
                    // Scenario Outline
                    for (const example of node.examples) {
                        const exampleTags = processTags(example.tags);
                        const combinedTags = [...new Set([...allTags, ...exampleTags])];
                        const rowCount = example.tableBody ? example.tableBody.length : 0;
                        if (rowCount > 0) {
                            for (const tag of combinedTags) { addTagCount(tag, rowCount); }
                        } else {
                            // Fallback: If the table is empty or malformed but the outline exists, count it as 1
                            for (const tag of combinedTags) { addTagCount(tag, 1); }
                        }
                    }
                } else {
                    // Standard Scenario (or Outline without examples)
                    for (const tag of allTags) { addTagCount(tag, 1); }
                }
            };

            if (docAST && docAST.feature) {
                const featureTags = processTags(docAST.feature.tags);
                if (docAST.feature.children) {
                    for (const child of docAST.feature.children) {
                        if (child.rule) {
                            const ruleTags = processTags(child.rule.tags);
                            const combinedRuleTags = [...new Set([...featureTags, ...ruleTags])];
                            if (child.rule.children) {
                                for (const rChild of child.rule.children) {
                                    if (rChild.scenario) traverse(rChild.scenario, combinedRuleTags);
                                }
                            }
                        } else if (child.scenario) {
                            traverse(child.scenario, featureTags);
                        }
                    }
                }
                const status = errors.length > 0 ? 'partial' : 'current';
                this.updateIncrementalTagCounts(uri.toString(), tagCounts, status);
            } else {
                // Partial or unparsable AST, use fallback
                const fallbackCounts = this.fallbackParseTags(content);
                this.updateIncrementalTagCounts(uri.toString(), fallbackCounts, 'partial');
            }
        } catch (err) {
            logger.error(`Error parsing feature file ${uri.toString()}:`, err);
            const fallbackCounts = this.fallbackParseTags(content);
            this.updateIncrementalTagCounts(uri.toString(), fallbackCounts, 'partial');
        }
    }

    private fallbackParseTags(content: string): Map<string, number> {
        const tagCounts = new Map<string, number>();
        const lines = content.split(/\r?\n/);

        let featureTags: string[] = [];
        let ruleTags: string[] = [];
        let currentTags: string[] = []; 
        let currentScenarioTags: string[] = [];
        
        let isInsideExamples = false;
        let exampleHeaderSeen = false;
        let isFirstExamplesBlock = false;
        
        const addTags = (tags: string[], count: number) => {
            for (const tag of tags) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + count);
            }
        };

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            if (trimmed.startsWith('@')) {
                const tagsOnLine = trimmed.split(/\s+/).filter(t => t.startsWith('@'));
                currentTags.push(...tagsOnLine);
            } else if (/^Feature:/i.test(trimmed)) {
                featureTags = [...currentTags];
                currentTags = [];
                ruleTags = [];
                isInsideExamples = false;
            } else if (/^Rule:/i.test(trimmed)) {
                ruleTags = [...currentTags];
                currentTags = [];
                isInsideExamples = false;
            } else if (/^(Scenario|Scenario Outline|Scenario Template|Example):/i.test(trimmed)) {
                isInsideExamples = false;
                isFirstExamplesBlock = true;
                const allTags = [...new Set([...featureTags, ...ruleTags, ...currentTags])];
                currentScenarioTags = allTags;
                addTags(currentScenarioTags, 1);
                currentTags = [];
            } else if (/^(Examples|Scenarios):/i.test(trimmed)) {
                isInsideExamples = true;
                exampleHeaderSeen = false;
                const examplesTags = [...new Set([...currentScenarioTags, ...currentTags])];
                currentScenarioTags = examplesTags;
                currentTags = [];
            } else if (isInsideExamples && trimmed.startsWith('|')) {
                if (!exampleHeaderSeen) {
                    exampleHeaderSeen = true;
                } else {
                    if (isFirstExamplesBlock) {
                        addTags(currentScenarioTags, -1);
                        isFirstExamplesBlock = false;
                    }
                    addTags(currentScenarioTags, 1);
                }
            } else {
                currentTags = [];
            }
        }
        
        for (const [tag, count] of tagCounts.entries()) {
            if (count <= 0) tagCounts.delete(tag);
        }
        return tagCounts;
    }

    private updateIncrementalTagCounts(uriString: string, newCounts: Map<string, number>, status: 'current' | 'stale' | 'partial') {
        const oldState = this.fileTagCounts.get(uriString);
        const oldCounts = oldState ? oldState.counts : new Map<string, number>();

        // Remove old counts
        for (const [tag, count] of oldCounts) {
            const currentGlobal = this.globalTagCount.get(tag) || 0;
            this.globalTagCount.set(tag, Math.max(0, currentGlobal - count));
        }

        // Add new counts
        for (const [tag, count] of newCounts) {
            const currentGlobal = this.globalTagCount.get(tag) || 0;
            this.globalTagCount.set(tag, currentGlobal + count);
        }

        this.fileTagCounts.set(uriString, { counts: newCounts, status });
    }

    public removeFile(uri: vscode.Uri): void {
        const uriString = uri.toString();
        const existingTimeout = this.updateDebounce.get(uriString);
        if (existingTimeout) {
            clearTimeout(existingTimeout.timeout);
            existingTimeout.resolves.forEach(r => r()); // resolve dangling promises
            this.updateDebounce.delete(uriString);
        }

        const oldState = this.fileTagCounts.get(uriString);
        if (oldState) {
            for (const [tag, count] of oldState.counts) {
                const currentGlobal = this.globalTagCount.get(tag) || 0;
                this.globalTagCount.set(tag, Math.max(0, currentGlobal - count));
            }
            this.fileTagCounts.delete(uriString);
        }
    }

    public async getTagBlastRadius(tag: string): Promise<number> {
        await this.ensureInitialized();
        return this.globalTagCount.get(tag) || 0;
    }

    public getFileState(uri: vscode.Uri): FileState | undefined {
        return this.fileTagCounts.get(uri.toString());
    }

    public async hasStaleOrPartialFilesForTag(tag: string): Promise<boolean> {
        await this.ensureInitialized();
        for (const state of this.fileTagCounts.values()) {
            if ((state.status === 'stale' || state.status === 'partial') && state.counts.has(tag)) {
                return true;
            }
        }
        return false;
    }
}
