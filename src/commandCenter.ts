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
            description: 'Format current file',
            commandId: GherkinPowerToolsCommands.format.id
        },

        // Execution & Debugging
        {
            label: 'Execution & Debugging',
            kind: vscode.QuickPickItemKind.Separator
        },
        {
            label: '$(play) Run Feature',
            description: 'Run current feature',
            commandId: GherkinPowerToolsCommands.runFeature.id
        },
        {
            label: '$(play) Run Scenario',
            description: 'Run scenario at cursor',
            commandId: GherkinPowerToolsCommands.runScenario.id
        },
        {
            label: '$(gear) Edit Feature...',
            description: 'Run feature with custom arguments',
            commandId: GherkinPowerToolsCommands.runFeatureWithArgs.id
        },
        {
            label: '$(gear) Edit Scenario...',
            description: 'Run scenario with custom arguments',
            commandId: GherkinPowerToolsCommands.runScenarioWithArgs.id
        },
        {
            label: '$(debug-alt) Debug Feature',
            description: 'Debug current feature',
            commandId: GherkinPowerToolsCommands.debugFeature.id
        },
        {
            label: '$(debug-alt) Debug Scenario',
            description: 'Debug scenario at cursor',
            commandId: GherkinPowerToolsCommands.debugScenario.id
        },

        // Step Definitions
        {
            label: 'Step Definitions',
            kind: vscode.QuickPickItemKind.Separator
        },
        {
            label: '$(add) Create Step Definition',
            description: 'Generate Python code for undefined step',
            commandId: GherkinPowerToolsCommands.createStepDefinition.id
        },

        // Analysis & Diagnostics
        {
            label: 'Analysis & Diagnostics',
            kind: vscode.QuickPickItemKind.Separator
        },
        {
            label: '$(graph) Show Gherkin Health',
            description: 'View project metrics and anti-patterns dashboard',
            commandId: GherkinPowerToolsCommands.showGherkinHealth.id
        },
        {
            label: '$(stethoscope) Diagnose Workspace',
            description: 'Generate workspace troubleshooting report',
            commandId: GherkinPowerToolsCommands.diagnoseWorkspace.id
        }
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a command',
        matchOnDescription: true
    });

    if (selected && selected.commandId) {
        // Execute the chosen command
        await vscode.commands.executeCommand(selected.commandId);
    }
}
