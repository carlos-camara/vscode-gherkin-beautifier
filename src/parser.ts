import type { GherkinDocument } from '@cucumber/messages';

import { metricsLogger } from './metrics';
import { performance } from 'perf_hooks';

export interface ParseResult {
    document: GherkinDocument | null;
    errors: any[];
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

export async function parseGherkin(text: string): Promise<ParseResult> {
    const { gherkin, messages } = await getCucumberModules();
    
    // Create fresh instances to prevent sharing mutable state across concurrent requests
    const uuidFn = messages.IdGenerator.uuid();
    const builder = new gherkin.AstBuilder(uuidFn);
    const matcher = new gherkin.GherkinClassicTokenMatcher();
    const parser = new gherkin.Parser(builder, matcher);

    let document: GherkinDocument | null = null;
    let errors: any[] = [];
    
    // Performance metrics
    const totalStart = performance.now();
    let astStart = 0;
    let astEnd = 0;

    try {
        astStart = performance.now();
        document = parser.parse(text) as GherkinDocument;
        astEnd = performance.now();
    } catch (e: any) {
        astEnd = performance.now();
        // Syntax errors are grouped in an array by @cucumber/gherkin
        errors = Array.isArray(e.errors) ? e.errors : [e];

        // Ensure we retrieve the partial AST if it was built
        try {
            const partial = builder.getResult();
            if (partial) {
                document = partial as GherkinDocument;
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

    return { document, errors };
}
