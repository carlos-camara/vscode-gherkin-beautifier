import { RULES_REGISTRY } from './rules';

const defaultRules: Record<string, any> = {};
for (const [key, rule] of Object.entries(RULES_REGISTRY)) {
    if (rule.enabledByDefault) {
        defaultRules[key] = rule.defaultSeverity;
    } else {
        defaultRules[key] = 'off';
    }
}

export const DEFAULT_CONFIG = {
    indentation: { steps: 4 },
    tables: { alignToKeyword: true },
    docStrings: { alignToKeyword: true, formatJson: 'auto' },
    tags: { format: 'wrap', sort: 'preserve' },
    emptyLines: { betweenScenarios: 1 },
    formatter: { enabled: true },
    linter: { enabled: true, enabledRules: [] },
    rules: defaultRules,
    behave: {
        stepGlobs: ["**/steps/**/*.py", "**/features/steps/**/*.py"],
        ignoreGlobs: ["**/node_modules/**", "**/.venv/**", "**/venv/**", "**/env/**"],
        additionalArguments: [],
        execution: {
            executable: "behave",
            arguments: []
        }
    },
    featureGlobs: ["**/*.feature"]
};

export const DEFAULT_RULE_CONFIG: Record<string, any> = defaultRules;
