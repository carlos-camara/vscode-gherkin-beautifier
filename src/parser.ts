import type { GherkinDocument } from '@cucumber/messages';

export interface ParseResult {
    document: GherkinDocument | null;
    errors: any[];
}

let cucumberModulesPromise: Promise<any> | null = null;

async function getCucumberModules() {
    if (!cucumberModulesPromise) {
        cucumberModulesPromise = (async () => {
            const gherkin = await import('@cucumber/gherkin');
            const messages = await import('@cucumber/messages');
            return { gherkin, messages };
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

    try {
        document = parser.parse(text) as GherkinDocument;
    } catch (e: any) {
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

    return { document, errors };
}
