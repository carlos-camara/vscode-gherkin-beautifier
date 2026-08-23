import * as vscode from 'vscode';

export type RuleSeverity = 'error' | 'warning' | 'info' | 'hint' | 'off';
export type RuleCategory = 'AST' | 'Semantic' | 'Behave' | 'Anti-Pattern';

export interface RuleDefinition {
    id: string;
    title: string;
    description: string;
    category: RuleCategory;
    defaultSeverity: RuleSeverity;
    enabledByDefault: boolean;
    supportsQuickFix: boolean;
    aliases: string[];
    documentationAnchor: string;
}

export const RULES_REGISTRY: Record<string, RuleDefinition> = {
    'syntax-error': {
        id: 'syntax-error',
        title: 'Syntax Error',
        description: 'The document contains invalid Gherkin syntax that prevents parsing.',
        category: 'AST',
        defaultSeverity: 'error',
        enabledByDefault: true,
        supportsQuickFix: false,
        aliases: ['SYNTAX_ERROR', 'syntax-errors'],
        documentationAnchor: 'syntax-error'
    },
    'missing-colon': {
        id: 'missing-colon',
        title: 'Missing Colon',
        description: 'A required trailing colon is missing after a keyword (e.g. Feature, Scenario).',
        category: 'AST',
        defaultSeverity: 'error',
        enabledByDefault: true,
        supportsQuickFix: true,
        aliases: ['MISSING_COLON'],
        documentationAnchor: 'missing-colon'
    },
    'invalid-keyword': {
        id: 'invalid-keyword',
        title: 'Invalid Keyword',
        description: 'The keyword used is not valid for the current Gherkin dialect.',
        category: 'AST',
        defaultSeverity: 'error',
        enabledByDefault: true,
        supportsQuickFix: true,
        aliases: ['MISSPELLED_KEYWORD', 'INVALID_KEYWORD'],
        documentationAnchor: 'invalid-keyword'
    },
    'scenario-with-examples': {
        id: 'scenario-with-examples',
        title: 'Scenario with Examples',
        description: 'A "Scenario" keyword is used instead of "Scenario Outline" when Examples are present.',
        category: 'Semantic',
        defaultSeverity: 'warning',
        enabledByDefault: true,
        supportsQuickFix: true,
        aliases: ['SCENARIO_WITH_EXAMPLES'],
        documentationAnchor: 'scenario-with-examples'
    },
    'table-inconsistency': {
        id: 'table-inconsistency',
        title: 'Table Inconsistency',
        description: 'Rows in a Data Table or Examples block have an inconsistent number of cells.',
        category: 'Semantic',
        defaultSeverity: 'error',
        enabledByDefault: true,
        supportsQuickFix: true,
        aliases: ['INCONSISTENT_CELL_COUNT', 'TABLE_INCONSISTENCY'],
        documentationAnchor: 'table-inconsistency'
    },
    'undefined-step': {
        id: 'undefined-step',
        title: 'Undefined Step',
        description: 'No matching Python step definition was found for this step.',
        category: 'Behave',
        defaultSeverity: 'error',
        enabledByDefault: true,
        supportsQuickFix: true,
        aliases: ['UNDEFINED_STEP', 'undefined-steps'],
        documentationAnchor: 'undefined-step'
    },
    'ambiguous-step': {
        id: 'ambiguous-step',
        title: 'Ambiguous Step',
        description: 'Multiple Python step definitions match this step.',
        category: 'Behave',
        defaultSeverity: 'error',
        enabledByDefault: true,
        supportsQuickFix: false,
        aliases: ['AMBIGUOUS_STEP', 'ambiguous-steps'],
        documentationAnchor: 'ambiguous-step'
    },
    'oversized-scenario': {
        id: 'oversized-scenario',
        title: 'Oversized Scenario',
        description: 'The Scenario has too many steps, suggesting it is testing too much.',
        category: 'Anti-Pattern',
        defaultSeverity: 'warning',
        enabledByDefault: true,
        supportsQuickFix: false,
        aliases: [],
        documentationAnchor: 'oversized-scenario'
    },
    'oversized-feature': {
        id: 'oversized-feature',
        title: 'Oversized Feature',
        description: 'The Feature file has too many Scenarios, making it hard to maintain.',
        category: 'Anti-Pattern',
        defaultSeverity: 'info',
        enabledByDefault: true,
        supportsQuickFix: false,
        aliases: [],
        documentationAnchor: 'oversized-feature'
    },
    'duplicated-steps': {
        id: 'duplicated-steps',
        title: 'Duplicated Steps',
        description: 'The same exact steps are repeated multiple times.',
        category: 'Anti-Pattern',
        defaultSeverity: 'error',
        enabledByDefault: true,
        supportsQuickFix: false,
        aliases: [],
        documentationAnchor: 'duplicated-steps'
    },
    'unused-steps': {
        id: 'unused-steps',
        title: 'Unused Steps',
        description: 'Step definitions exist but are not used anywhere.',
        category: 'Anti-Pattern',
        defaultSeverity: 'info',
        enabledByDefault: true,
        supportsQuickFix: false,
        aliases: [],
        documentationAnchor: 'unused-steps'
    },
    'excessive-tags': {
        id: 'excessive-tags',
        title: 'Excessive Tags',
        description: 'Too many tags are applied to a single element.',
        category: 'Anti-Pattern',
        defaultSeverity: 'info',
        enabledByDefault: true,
        supportsQuickFix: false,
        aliases: [],
        documentationAnchor: 'excessive-tags'
    },
    'inconsistent-formatting': {
        id: 'inconsistent-formatting',
        title: 'Inconsistent Formatting',
        description: 'The Gherkin document contains inconsistent formatting.',
        category: 'Anti-Pattern',
        defaultSeverity: 'info',
        enabledByDefault: true,
        supportsQuickFix: false,
        aliases: [],
        documentationAnchor: 'inconsistent-formatting'
    }

};

export type RuleId = keyof typeof RULES_REGISTRY;



export function isValidRule(id: string): id is RuleId {
    return id in RULES_REGISTRY;
}

export function isValidSeverity(severity: string): severity is RuleSeverity {
    return ['error', 'warning', 'info', 'hint', 'off'].includes(severity);
}

export interface CodeActionPayload {
    replacementText?: string;
    stepText?: string;
    stepKeyword?: string;
}

export class RuleDiagnostic extends vscode.Diagnostic {
    constructor(
        range: vscode.Range,
        message: string,
        severity: vscode.DiagnosticSeverity,
        public readonly ruleId: RuleId,
        public readonly documentVersion: number,
        public readonly actionPayload?: CodeActionPayload
    ) {
        super(range, message, severity);
        this.code = ruleId;
    }
}

/**
 * A side-channel registry to preserve strongly typed RuleDiagnostic 
 * instances that are otherwise stripped by VS Code's DiagnosticCollection.
 */
export const diagnosticRegistry = new Map<string, RuleDiagnostic[]>();
