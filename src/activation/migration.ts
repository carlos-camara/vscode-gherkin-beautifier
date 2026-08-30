import * as vscode from 'vscode';
import { logger } from '../logger';
import { parseArgsStringToVector } from '../execution';

/**
 * Executes all state cleanup and configuration migrations required 
 * for maintaining backwards compatibility with legacy configurations.
 * 
 * @param context The extension context
 */
export async function executeMigrations(context: vscode.ExtensionContext): Promise<void> {
    try {
        // Clear out any legacy state from the old recommendation prompt
        const stateKey = 'gherkinPowerTools.promptedPeekView';
        await context.globalState.update(stateKey, undefined);
        
        // Migrate legacy command configurations automatically on start
        await migrateLegacyExecutionSettings();
        await migrateLegacyLocalExecutableSettings();
    } catch (err) {
        logger.error(`Error during legacy migration: ${err}`);
    }
}

/**
 * Automates the migration from the deprecated string-based `behave.localExecutable`
 * to the new structured `behave.localExecution` object setting.
 */
export async function migrateLegacyLocalExecutableSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('gherkinPowerTools.behave');
    const inspection = config.inspect<string>('localExecutable');

    if (!inspection) { return; }

    const migrateTarget = async (value: string | undefined, target: vscode.ConfigurationTarget) => {
        if (value) {
            const executable = value.trim();
            const isPython = executable.endsWith('python') || executable.endsWith('python.exe');
            const args = isPython ? ['-m', 'behave'] : [];
            await config.update('localExecution', { executable, arguments: args }, target);
            logger.info(`Migrated legacy behave.localExecutable "${value}" to behave.localExecution at target ${target}.`);
        }
        // Always delete the legacy command to clean up their settings
        if (value !== undefined) {
            await config.update('localExecutable', undefined, target);
        }
    };

    // Migrate in order of priority to ensure all overrides are migrated
    await migrateTarget(inspection.globalValue, vscode.ConfigurationTarget.Global);
    await migrateTarget(inspection.workspaceValue, vscode.ConfigurationTarget.Workspace);
}

/**
 * Automates the migration from the deprecated string-based `behave.command` 
 * to the new structured `behave.execution` object setting. 
 * This ensures users don't face execution errors without manual action.
 */
export async function migrateLegacyExecutionSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('gherkinPowerTools.behave');
    const inspection = config.inspect<string>('command');

    if (!inspection) { return; }

    const migrateTarget = async (value: string | undefined, target: vscode.ConfigurationTarget) => {
        if (value && value !== 'behave') {
            const parts = parseArgsStringToVector(value);
            if (parts.length > 0) {
                const executable = parts[0];
                const args = parts.slice(1);
                // Save to the new execution object
                await config.update('execution', { executable, arguments: args }, target);
                logger.info(`Migrated legacy behave.command "${value}" to behave.execution at target ${target}.`);
            }
        }
        // Always delete the legacy command to clean up their settings
        if (value !== undefined) {
            await config.update('command', undefined, target);
        }
    };

    // Migrate in order of priority to ensure all overrides are migrated
    await migrateTarget(inspection.globalValue, vscode.ConfigurationTarget.Global);
    await migrateTarget(inspection.workspaceValue, vscode.ConfigurationTarget.Workspace);
}
