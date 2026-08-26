

const CommandCategory = "Gherkin PowerTools";


export const GherkinPowerToolsCommands = {
    showImpactDetails: {
        id: 'gherkinPowerTools.showImpactDetails',
        title: 'Show Impact Details',
        category: CommandCategory,
        aliases: ['gherkin-powertools.showImpactDetails']
    },
    replayOnboarding: {
        id: 'gherkinPowerTools.replayOnboarding',
        title: 'Replay Onboarding',
        category: CommandCategory
    },
    commandCenter: {
        id: 'gherkinPowerTools.commandCenter',
        title: 'Command Center',
        category: CommandCategory
    },
    demoQuickFix: {
        id: 'gherkinPowerTools.demoQuickFix',
        title: 'Demo Quick Fix',
        category: CommandCategory
    },
    demoGoToDefinition: {
        id: 'gherkinPowerTools.demoGoToDefinition',
        title: 'Demo Go to Definition',
        category: CommandCategory
    },
    format: {
        id: 'gherkinPowerTools.format',
        title: 'Format Gherkin Document',
        category: CommandCategory
    },
    showGherkinHealth: {
        id: 'gherkinPowerTools.showGherkinHealth',
        title: 'Show Gherkin Health',
        category: CommandCategory
    },
    showMetrics: {
        id: 'gherkinPowerTools.showMetrics',
        title: 'Show Developer Metrics',
        category: CommandCategory
    },
    runFeature: {
        id: 'gherkinPowerTools.runFeature',
        title: 'Run Feature',
        category: CommandCategory
    },
    runScenario: {
        id: 'gherkinPowerTools.runScenario',
        title: 'Run Scenario',
        category: CommandCategory
    },
    runFeatureWithArgs: {
        id: 'gherkinPowerTools.runFeatureWithArgs',
        title: 'Edit Feature...',
        category: CommandCategory
    },
    runScenarioWithArgs: {
        id: 'gherkinPowerTools.runScenarioWithArgs',
        title: 'Edit Scenario...',
        category: CommandCategory
    },
    debugFeature: {
        id: 'gherkinPowerTools.debugFeature',
        title: 'Debug Feature',
        category: CommandCategory
    },
    debugScenario: {
        id: 'gherkinPowerTools.debugScenario',
        title: 'Debug Scenario',
        category: CommandCategory
    },
    diagnoseWorkspace: {
        id: 'gherkinPowerTools.diagnoseWorkspace',
        title: 'Diagnose Workspace',
        category: CommandCategory
    },
    testExplorerEditAndRun: {
        id: 'gherkinPowerTools.testExplorerEditAndRun',
        title: 'Edit Behave args & Run',
        category: CommandCategory
    },
    extractStep: {
        id: 'gherkinPowerTools.refactor.extractStep',
        title: 'Extract Step',
        category: CommandCategory
    },
    renameStep: {
        id: 'gherkinPowerTools.refactor.renameStep',
        title: 'Rename Step',
        category: CommandCategory
    },
    exportHistory: {
        id: 'gherkinPowerTools.analytics.exportHistory',
        title: 'Export History as JSON',
        category: CommandCategory
    },
    clearHistory: {
        id: 'gherkinPowerTools.analytics.clearHistory',
        title: 'Clear History',
        category: CommandCategory
    },
    createStepDefinition: {
        id: 'gherkinPowerTools.createStepDefinition',
        title: 'Create Step Definition',
        category: CommandCategory
    },
    internalRecordCompletion: {
        id: 'gherkinPowerTools.internal.recordCompletion',
        title: 'Record Completion',
        category: CommandCategory
    },
    explainCompletionRanking: {
        id: 'gherkinPowerTools.diagnostics.explainCompletionRanking',
        title: 'Explain Completion Ranking',
        category: CommandCategory
    }
} as const;
