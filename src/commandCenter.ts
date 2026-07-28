import * as vscode from 'vscode';

interface CommandCenterItem extends vscode.QuickPickItem {
    commandId?: string;
}

export async function showCommandCenter() {
    const items: CommandCenterItem[] = [
        // Formatting
        {
            label: 'Formatting',
            kind: vscode.QuickPickItemKind.Separator
        },
        {
            label: '$(paintcan) Format Gherkin Document',
            description: 'Formats the current Gherkin file',
            commandId: 'gherkinPowerTools.format'
        },

        // Execution & Debugging
        {
            label: 'Execution & Debugging',
            kind: vscode.QuickPickItemKind.Separator
        },
        {
            label: '$(play) Run Feature',
            description: 'Executes the entire feature file',
            commandId: 'gherkinPowerTools.runFeature'
        },
        {
            label: '$(play) Run Scenario',
            description: 'Executes the scenario at the cursor position',
            commandId: 'gherkinPowerTools.runScenario'
        },
        {
            label: '$(gear) Edit Feature...',
            description: 'Executes the feature with custom interactive arguments',
            commandId: 'gherkinPowerTools.runFeatureWithArgs'
        },
        {
            label: '$(gear) Edit Scenario...',
            description: 'Executes the scenario with custom interactive arguments',
            commandId: 'gherkinPowerTools.runScenarioWithArgs'
        },
        {
            label: '$(debug-alt) Debug Feature',
            description: 'Starts a debug session for the feature file',
            commandId: 'gherkinPowerTools.debugFeature'
        },
        {
            label: '$(debug-alt) Debug Scenario',
            description: 'Starts a debug session for the scenario at the cursor position',
            commandId: 'gherkinPowerTools.debugScenario'
        },

        // Step Definitions
        {
            label: 'Step Definitions',
            kind: vscode.QuickPickItemKind.Separator
        },
        {
            label: '$(add) Create Step Definition',
            description: 'Generates Python code for an undefined step',
            commandId: 'gherkinPowerTools.createStepDefinition'
        },

        // Analysis & Diagnostics
        {
            label: 'Analysis & Diagnostics',
            kind: vscode.QuickPickItemKind.Separator
        },
        {
            label: '$(graph) Show Project Statistics',
            description: 'Generates a visual dashboard of features and steps',
            commandId: 'gherkinPowerTools.showStatistics'
        },
        {
            label: '$(stethoscope) Diagnose Workspace',
            description: 'Generates a troubleshooting report for the workspace',
            commandId: 'gherkinPowerTools.diagnoseWorkspace'
        }
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a Gherkin PowerTools command to execute...',
        matchOnDescription: true
    });

    if (selected && selected.commandId) {
        // Execute the chosen command
        await vscode.commands.executeCommand(selected.commandId);
    }
}
