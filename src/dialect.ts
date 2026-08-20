import * as vscode from 'vscode';

import type { Dialect } from '@cucumber/gherkin';

const dialects = require('@cucumber/gherkin/dist/gherkin-languages.json');

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
     * Traverses upwards from a given line to resolve if an And/But step
     * acts as a Given, When, or Then context.
     */
    public resolveAndBut(document: vscode.TextDocument, lineIndex: number): 'given' | 'when' | 'then' | 'step' {
        const dialect = this.getDialect(document);
        const givenKeywords = dialect.given;
        const whenKeywords = dialect.when;
        const thenKeywords = dialect.then;
        const stepRegex = this.getStepRegex(dialect);

        for (let i = lineIndex; i >= 0; i--) {
            const text = document.lineAt(i).text;
            const match = text.match(stepRegex);
            if (match) {
                const kw = match[1];
                if (givenKeywords.includes(kw)) return 'given';
                if (whenKeywords.includes(kw)) return 'when';
                if (thenKeywords.includes(kw)) return 'then';
            }
            // Stop if we hit a scenario or feature block since steps cannot cross scenario boundaries
            if (this.getStructureRegex(dialect).test(text)) {
                break;
            }
        }
        return 'step';
    }

    /**
     * Resolves the semantic context of a step during a top-to-bottom AST traversal.
     * Non-continuation keywords (Given/When/Then) establish a new context.
     * Continuation keywords (And/But/*) preserve the current context.
     */
    public resolveSemanticTypeDownwards(keyword: string, currentContext: 'given' | 'when' | 'then' | 'step', dialect: Dialect): 'given' | 'when' | 'then' | 'step' {
        const kw = keyword.trim();
        if (dialect.given.map(k => k.trim()).includes(kw)) return 'given';
        if (dialect.when.map(k => k.trim()).includes(kw)) return 'when';
        if (dialect.then.map(k => k.trim()).includes(kw)) return 'then';
        return currentContext;
    }

    public clearCache(uri: vscode.Uri) {
        this.cache.delete(uri.toString());
    }
}

export const dialectService = new DialectService();
