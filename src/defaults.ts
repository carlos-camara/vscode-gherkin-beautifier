export const DEFAULT_CONFIG = {
    indentation: { steps: 4 },
    tables: { alignToKeyword: true },
    docStrings: { alignToKeyword: true },
    tags: { format: 'wrap', sort: 'preserve' },
    emptyLines: { betweenScenarios: 1 },
    formatter: { enabled: true },
    linter: { enabled: true, enabledRules: [] },
    behave: {
        stepGlobs: ["**/steps/**/*.py", "**/features/steps/**/*.py"],
        ignoreGlobs: ["**/node_modules/**", "**/.venv/**", "**/venv/**", "**/env/**"],
        additionalArguments: [],
        command: "behave"
    }
};

export const DEFAULT_RULE_CONFIG: Record<string, string> = {
    "oversized-scenario": "warning",
    "oversized-feature": "info",
    "duplicated-steps": "error",
    "unused-steps": "info",
    "ambiguous-steps": "error",
    "undefined-steps": "error",
    "excessive-tags": "info",
    "inconsistent-formatting": "info",
    "poor-maintainability": "warning"
};
