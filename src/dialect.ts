import * as vscode from 'vscode';

import type { Dialect } from '@cucumber/gherkin';

const dialects = require('@cucumber/gherkin/dist/gherkin-languages.json');

type SemanticStepType = 'given' | 'when' | 'then' | 'step';

export class DialectService {
    private cache = new Map<string, { version: number, dialect: Dialect }>();

    public getDialect(documentOrText: vscode.TextDocument | string): Dialect {
        if (typeof documentOrText === 'string') {
            return this.detectDialect(documentOrText);
        }
        const key = documentOrText.uri.toString();
        const cached = this.cache.get(key);
        if (cached && cached.version === documentOrText.version) {
            return cached.dialect;
        }

        const dialect = this.detectDialect(documentOrText.getText());
        this.cache.set(key, { version: documentOrText.version, dialect });
        return dialect;
    }

    public detectDialect(text: string): Dialect {
        const lines = text.split(/\r?\n/).slice(0, 10);
        for (const line of lines) {
            const match = line.match(/^\s*#\s*language:\s*([a-zA-Z\-]+)/);
            if (match && match[1]) {
                const lang = match[1].toLowerCase();
                if (dialects[lang as keyof typeof dialects]) {
                    return dialects[lang as keyof typeof dialects] as Dialect;
                }
            }
        }
        return dialects['en'] as Dialect;
    }

    public getStepKeywords(dialect: Dialect): string[] {
        return [
            ...dialect.given,
            ...dialect.when,
            ...dialect.then,
            ...dialect.and,
            ...dialect.but
        ].filter(k => k.length > 0);
    }

    public getBlockKeywords(dialect: Dialect): string[] {
        return [
            ...dialect.feature,
            ...dialect.background,
            ...dialect.rule,
            ...dialect.scenario,
            ...dialect.scenarioOutline,
            ...dialect.examples
        ].filter(k => k.length > 0);
    }

    public getStepRegex(dialect: Dialect): RegExp {
        const keywords = this.getStepKeywords(dialect);
        if (!keywords.includes('* ')) keywords.push('* ');

        // Sort descending by length so longer keywords match first
        keywords.sort((a, b) => b.length - a.length);
        const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return new RegExp(`^\\s*(${escaped.join('|')})(.*)$`);
    }

    public getStructureRegex(dialect: Dialect): RegExp {
        const keywords = this.getBlockKeywords(dialect);
        keywords.sort((a, b) => b.length - a.length);
        const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return new RegExp(`^\\s*(${escaped.join('|')}):?`, 'im');
    }


    /**
     * Resolves the semantic type of a keyword.
     * - Continuation keywords (And, But, *) inherit the previousContext.
     * - Malformed keywords explicitly return 'step'.
     * - Ideal for forward-scanning AST walkers (Linter, Outline) to avoid O(N^2) backward document scanning.
     */
    public resolveKeywordSemanticType(keyword: string, dialect: Dialect, previousContext: SemanticStepType = 'step'): SemanticStepType {
        const kw = keyword.trim().toLowerCase();

        // Continuation keywords inherit context. Must be checked first because '*' is also present in given/when/then arrays.
        if (kw === '*' ||
            dialect.and.some(k => k.trim().toLowerCase() === kw) ||
            dialect.but.some(k => k.trim().toLowerCase() === kw)) {
            return previousContext;
        }

        if (dialect.given.some(k => k.trim().toLowerCase() === kw)) return 'given';
        if (dialect.when.some(k => k.trim().toLowerCase() === kw)) return 'when';
        if (dialect.then.some(k => k.trim().toLowerCase() === kw)) return 'then';

        // Malformed input (e.g. "Garbage I do something")
        return 'step';
    }

    /**
     * Resolves the semantic type of a step at a specific document line.
     * - Efficiently scans backwards if a continuation keyword is found.
     * - Strictly stops at Scenario/Background block boundaries.
     * - Replaces resolveAndBut.
     */
    public resolveDocumentLineSemanticType(document: vscode.TextDocument, lineIndex: number): SemanticStepType {
        const dialect = this.getDialect(document);
        const stepRegex = this.getStepRegex(dialect);
        const boundaryRegex = this.getStructureRegex(dialect);

        for (let i = lineIndex; i >= 0; i--) {
            const text = document.lineAt(i).text;

            // Stop if we hit a scenario or feature block since steps cannot cross boundaries
            if (boundaryRegex.test(text)) {
                break;
            }

            const match = text.match(stepRegex);
            if (match) {
                const kw = match[1];
                const resolved = this.resolveKeywordSemanticType(kw, dialect, 'step');
                if (resolved !== 'step') {
                    return resolved; // Found given/when/then
                }
                // If it's a continuation (and/but/*), we just continue scanning backwards
            }
        }
        return 'step';
    }

    public clearCache(uri: vscode.Uri) {
        this.cache.delete(uri.toString());
    }
}

export const dialectService = new DialectService();
