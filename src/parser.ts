import type { GherkinDocument } from '@cucumber/messages';

import { metricsLogger } from './metrics';
import { performance } from 'perf_hooks';

export interface GherkinParseError {
    code: string;
    message: string;
    source: 'parser' | 'ast-builder' | 'module-loader' | 'unknown';
    severity: 'error' | 'warning';
    recoverable: boolean;
    line?: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
}

export interface ParseResult {
    document: GherkinDocument | null;
    errors: GherkinParseError[];
    isPartial: boolean;
}

let cucumberModulesPromise: Promise<any> | null = null;

async function getCucumberModules() {
    if (!cucumberModulesPromise) {
        cucumberModulesPromise = (async () => {
            try {
                // When bundled for production, esbuild correctly resolves require() and converts ESM to CJS
                const gherkin = require('@cucumber/gherkin');
                const messages = require('@cucumber/messages');
                return { gherkin, messages };
            } catch (e: any) {
                // During local tests (tsc output), require() throws ERR_REQUIRE_ESM for these packages.
                // Fallback to native Node.js dynamic import.
                if (e.code === 'ERR_REQUIRE_ESM') {
                    const dynamicImport = new Function('specifier', 'return import(specifier)');
                    const gherkin = await dynamicImport('@cucumber/gherkin');
                    const messages = await dynamicImport('@cucumber/messages');
                    return { gherkin, messages };
                }
                throw e;
            }
        })();
    }
    return cucumberModulesPromise;
}

function normalizeGherkinError(e: any): GherkinParseError[] {
    if (!e) return [];
    
    // Handle module loading errors explicitly
    if (e.code === 'ERR_REQUIRE_ESM' || e.code === 'MODULE_NOT_FOUND') {
        return [{
            code: 'MODULE_LOAD_ERROR',
            message: e.message || 'Failed to load Gherkin parsing modules',
            source: 'module-loader',
            severity: 'error',
            recoverable: false
        }];
    }

    const name = e.constructor?.name || e.name || 'UnknownError';
    
    if (name === 'CompositeParserException' && Array.isArray(e.errors)) {
        return e.errors.flatMap((err: any) => normalizeGherkinError(err));
    }

    let source: GherkinParseError['source'] = 'unknown';
    if (name.includes('Parser') || name.includes('Token') || name.includes('EOF')) {
        source = 'parser';
    } else if (name.includes('AstBuilder')) {
        source = 'ast-builder';
    }

    let code = 'PARSE_ERROR';
    if (name === 'UnexpectedTokenException') code = 'UNEXPECTED_TOKEN';
    else if (name === 'UnexpectedEOFException') code = 'UNEXPECTED_EOF';
    else if (name === 'NoSuchLanguageException') code = 'NO_SUCH_LANGUAGE';
    else if (name === 'AstBuilderException') code = 'AST_BUILDER_ERROR';

    return [{
        code,
        message: e.message || 'Unknown parsing error',
        source,
        severity: 'error',
        recoverable: false, // will be updated by caller if partial AST exists
        line: e.location?.line || e.line,
        column: e.location?.column || e.column
    }];
}

export async function parseGherkin(text: string): Promise<ParseResult> {
    const { gherkin, messages } = await getCucumberModules();
    
    // Create fresh instances to prevent sharing mutable state across concurrent requests
    const uuidFn = messages.IdGenerator.uuid();
    const builder = new gherkin.AstBuilder(uuidFn);
    const matcher = new gherkin.GherkinClassicTokenMatcher();
    const parser = new gherkin.Parser(builder, matcher);

    let document: GherkinDocument | null = null;
    let errors: GherkinParseError[] = [];
    let isPartial = false;
    
    // Performance metrics
    const totalStart = performance.now();
    let astStart = 0;
    let astEnd = 0;

    try {
        astStart = performance.now();
        document = parser.parse(text) as GherkinDocument;
        astEnd = performance.now();
    } catch (e: unknown) {
        astEnd = performance.now();
        
        errors = normalizeGherkinError(e);

        // Ensure we retrieve the partial AST if it was built
        try {
            const partial = builder.getResult();
            if (partial) {
                document = partial as GherkinDocument;
                isPartial = true;
                // Mark errors as recoverable since we got a partial document
                errors.forEach(err => err.recoverable = true);
            }
        } catch (builderError) {
            // Partial tree might not be available for severe syntax errors
        }
    }

    const totalEnd = performance.now();

    if (metricsLogger.isEnabled()) {
        let features = 0;
        let scenarios = 0;
        let steps = 0;

        if (document && document.feature) {
            features = 1;
            for (const child of document.feature.children) {
                if (child.scenario) {
                    scenarios++;
                    steps += child.scenario.steps?.length || 0;
                } else if (child.background) {
                    steps += child.background.steps?.length || 0;
                } else if (child.rule) {
                    for (const ruleChild of child.rule.children) {
                        if (ruleChild.scenario) {
                            scenarios++;
                            steps += ruleChild.scenario.steps?.length || 0;
                        } else if (ruleChild.background) {
                            steps += ruleChild.background.steps?.length || 0;
                        }
                    }
                }
            }
        }

        metricsLogger.recordParse(
            totalEnd - totalStart,
            astEnd - astStart,
            features,
            scenarios,
            steps,
            errors.length
        );
    }

    return { document, errors, isPartial };
}
