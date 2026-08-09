import * as vscode from 'vscode';
import { GherkinPowerToolsCommands } from './commands';

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
            commandId: GherkinPowerToolsCommands.format.id
        },

        // Execution & Debugging
        {
            label: 'Execution & Debugging',
            kind: vscode.QuickPickItemKind.Separator
        },
        {
            label: '$(play) Run Feature',
            description: 'Executes the entire feature file',
            commandId: GherkinPowerToolsCommands.runFeature.id
        },
        {
            label: '$(play) Run Scenario',
            description: 'Executes the scenario at the cursor position',
            commandId: GherkinPowerToolsCommands.runScenario.id
        },
        {
            label: '$(gear) Edit Feature...',
            description: 'Executes the feature with custom interactive arguments',
            commandId: GherkinPowerToolsCommands.runFeatureWithArgs.id
        },
        {
            label: '$(gear) Edit Scenario...',
            description: 'Executes the scenario with custom interactive arguments',
            commandId: GherkinPowerToolsCommands.runScenarioWithArgs.id
        },
        {
            label: '$(debug-alt) Debug Feature',
            description: 'Starts a debug session for the feature file',
            commandId: GherkinPowerToolsCommands.debugFeature.id
        },
        {
            label: '$(debug-alt) Debug Scenario',
            description: 'Starts a debug session for the scenario at the cursor position',
            commandId: GherkinPowerToolsCommands.debugScenario.id
        },

        // Step Definitions
        {
            label: 'Step Definitions',
            kind: vscode.QuickPickItemKind.Separator
        },
        {
            label: '$(add) Create Step Definition',
            description: 'Generates Python code for an undefined step',
            commandId: GherkinPowerToolsCommands.createStepDefinition.id
        },

        // Analysis & Diagnostics
        {
            label: 'Analysis & Diagnostics',
            kind: vscode.QuickPickItemKind.Separator
        },
        {
            label: '$(graph) Show Gherkin Health',
            description: 'Generates a visual dashboard of project metrics and actionable anti-patterns',
            commandId: GherkinPowerToolsCommands.showGherkinHealth.id
        },
        {
            label: '$(stethoscope) Diagnose Workspace',
            description: 'Generates a troubleshooting report for the workspace',
            commandId: GherkinPowerToolsCommands.diagnoseWorkspace.id
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
