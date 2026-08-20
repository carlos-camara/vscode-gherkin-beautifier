import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { SymbolCache, FeatureCache } from './cache';
import { discoveryService } from './discovery';
import { featureDiscoveryService } from './featureDiscovery';
import { ConfigurationService } from './configuration';
import { DeferredBootstrap, CapabilityStatus } from './bootstrap';

export interface DiagnosticReport {
    extensionVersion: string;
    vscodeVersion: string;
    operatingSystem: string;
    workspaceFolderCount: number;
    stepGlobs: string[];
    ignoreGlobs: string[];
    featureFilesCount: number;
    stepFilesCount: number;
    indexedDefinitionsCount: number;
    pythonExtensionInstalled: boolean;
    pythonInterpreterPath?: string;
    behaveExecution: string;
    behaveExecutableStatus: string;
    projectConfigStatus: string;
    bootstrapCapabilities: CapabilityStatus[];
    warnings: string[];
    recommendations: string[];
    rawTimestamp: string;
}

export function redactPath(input: string, customHome?: string, customUser?: string): string {
    if (!input) return input;
    let result = input;

    const home = customHome || process.env.HOME || process.env.USERPROFILE || os.homedir();
    const user = customUser || process.env.USER || process.env.USERNAME || (home ? path.basename(home) : '');

    if (home && home.length > 2) {
        const normHome = home.replace(/\\/g, '/');
        const reg = new RegExp(normHome.replace(/[-[\]{}()+^$.,\\#\s]/g, '\\$&'), 'gi');
        result = result.replace(/\\/g, '/').replace(reg, '/Users/<redacted>');
    }

    if (user && user.length > 2) {
        const regUser = new RegExp(`(/Users/|/home/|C:/Users/)${user.replace(/[-[\]{}()+^$.,\\#\s]/g, '\\$&')}`, 'gi');
        result = result.replace(regUser, '$1<redacted>');
    }

    return result;
}

export function redactReportText(text: string): string {
    return redactPath(text);
}

export class DiagnosticEngine {
    public async collectDiagnostics(
        symbolCache?: SymbolCache,
        _featureCache?: FeatureCache,
        configService?: ConfigurationService,
        bootstrap?: DeferredBootstrap
    ): Promise<DiagnosticReport> {
        const ext = vscode.extensions.getExtension('carloscamara.vscode-gherkin-powertools');
        const extensionVersion = ext?.packageJSON?.version || '1.7.6';
        const vscodeVersion = vscode.version;
        const operatingSystem = `${process.platform} (${process.arch}) ${os.release()}`;

        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const workspaceFolderCount = workspaceFolders.length;

        const mainFolder = workspaceFolders[0]?.uri;
        const config = configService ? configService.getConfiguration(mainFolder) : {
            behave: {
                stepGlobs: ['**/steps/**/*.py', '**/features/steps/**/*.py'],
                ignoreGlobs: ['**/node_modules/**', '**/.venv/**', '**/venv/**', '**/env/**'],
                execution: {
                    executable: 'behave',
                    arguments: []
                }
            }
        };

        const stepGlobs = config.behave.stepGlobs;
        const ignoreGlobs = config.behave.ignoreGlobs;
        const behaveExecution = JSON.stringify(config.behave.execution || { executable: 'behave', arguments: [] });

        // Discovered files
        let featureFilesCount = 0;
        try {
            const features = await featureDiscoveryService.getFeatureFiles();
            featureFilesCount = features.length;
        } catch {
            featureFilesCount = 0;
        }

        let stepFilesCount = 0;
        try {
            const stepFiles = await discoveryService.getStepFiles();
            stepFilesCount = stepFiles.length;
        } catch {
            stepFilesCount = 0;
        }

        let indexedDefinitionsCount = 0;
        if (symbolCache) {
            try {
                const allDefs = await symbolCache.getAllStepDefinitions();
                indexedDefinitionsCount = allDefs.length;
            } catch {
                indexedDefinitionsCount = 0;
            }
        }

        // Python extension check
        const pythonExt = vscode.extensions.getExtension('ms-python.python');
        const pythonExtensionInstalled = !!pythonExt;

        // Python interpreter status
        let pythonInterpreterPath: string | undefined = undefined;
        try {
            const pyConfig = vscode.workspace.getConfiguration('python', mainFolder);
            pythonInterpreterPath = pyConfig.get<string>('defaultInterpreterPath') || pyConfig.get<string>('pythonPath');
        } catch {
            pythonInterpreterPath = undefined;
        }

        // Behave executable check
        let behaveExecutableStatus = 'Configured';
        if (config.behave.execution && config.behave.execution.executable) {
            behaveExecutableStatus = `Configured as "${config.behave.execution.executable}" (with ${config.behave.execution.arguments.length} args)`;
        } else {
            behaveExecutableStatus = 'Not configured';
        }

        // Project config file status (.gherkin-powertoolsrc.json)
        let projectConfigStatus = 'Not present';
        if (mainFolder) {
            const configFilePath = path.join(mainFolder.fsPath, '.gherkin-powertoolsrc.json');
            if (fs.existsSync(configFilePath)) {
                try {
                    const raw = fs.readFileSync(configFilePath, 'utf8');
                    JSON.parse(raw);
                    projectConfigStatus = 'Present & Valid JSON';
                } catch {
                    projectConfigStatus = 'Present & Invalid JSON (Syntax Error)';
                }
            }
        }

        // Warnings & Recommendations
        const warnings: string[] = [];
        const recommendations: string[] = [];

        if (workspaceFolderCount === 0) {
            warnings.push('No workspace folder is currently open in VS Code.');
            recommendations.push('Open a project folder containing .feature and Python step files.');
        }

        if (featureFilesCount === 0 && workspaceFolderCount > 0) {
            warnings.push('No .feature files were found in the workspace.');
            recommendations.push('Ensure your Gherkin feature files end with .feature extension.');
        }

        if (stepFilesCount === 0 && workspaceFolderCount > 0) {
            warnings.push('No Python step definition files (.py) were discovered using current stepGlobs.');
            recommendations.push('Check if your step files live in custom directories and update "gherkinPowerTools.behave.stepGlobs".');
        }

        if (!pythonExtensionInstalled) {
            warnings.push('The official Python extension (ms-python.python) is not installed.');
            recommendations.push('Install ms-python.python from VS Code Marketplace to enable interactive Python scenario debugging.');
        }

        if (projectConfigStatus.includes('Invalid JSON')) {
            warnings.push('Your project .gherkin-powertoolsrc.json file contains syntax errors.');
            recommendations.push('Fix JSON syntax errors in .gherkin-powertoolsrc.json to enable team configuration overrides.');
        }

        if (indexedDefinitionsCount === 0 && stepFilesCount > 0) {
            warnings.push('Step files were discovered but 0 step definitions were indexed in SymbolCache.');
            recommendations.push('Ensure your Python functions are decorated with @given, @when, @then, or @step decorators using string literals.');
        }

        const bootstrapCapabilities = bootstrap ? bootstrap.getDiagnostics() : [];

        return {
            extensionVersion,
            vscodeVersion,
            operatingSystem,
            workspaceFolderCount,
            stepGlobs,
            ignoreGlobs,
            featureFilesCount,
            stepFilesCount,
            indexedDefinitionsCount,
            pythonExtensionInstalled,
            pythonInterpreterPath: pythonInterpreterPath ? redactPath(pythonInterpreterPath) : undefined,
            behaveExecution,
            behaveExecutableStatus,
            projectConfigStatus,
            bootstrapCapabilities,
            warnings,
            recommendations,
            rawTimestamp: new Date().toISOString()
        };
    }

    public generateReportMarkdown(report: DiagnosticReport): string {
        const lines: string[] = [];

        lines.push('=== GHERKIN POWERTOOLS DIAGNOSTIC REPORT ===');
        lines.push(`Generated: ${report.rawTimestamp}`);
        lines.push('');
        lines.push('--- ENVIRONMENT ---');
        lines.push(`Extension Version : ${report.extensionVersion}`);
        lines.push(`VS Code Version   : ${report.vscodeVersion}`);
        lines.push(`OS & Architecture : ${report.operatingSystem}`);
        lines.push(`Workspace Folders : ${report.workspaceFolderCount}`);
        lines.push('');
        lines.push('--- DISCOVERY & INDEXING ---');
        lines.push(`Feature Files Found     : ${report.featureFilesCount}`);
        lines.push(`Step Files Discovered   : ${report.stepFilesCount}`);
        lines.push(`Indexed Definitions     : ${report.indexedDefinitionsCount}`);
        lines.push(`Configured stepGlobs    : ${JSON.stringify(report.stepGlobs)}`);
        lines.push(`Configured ignoreGlobs  : ${JSON.stringify(report.ignoreGlobs)}`);
        lines.push('');
        lines.push('--- PYTHON & BEHAVE ENVIRONMENT ---');
        lines.push(`Python Extension        : ${report.pythonExtensionInstalled ? 'Installed ✅' : 'Not Installed ⚠️'}`);
        if (report.pythonInterpreterPath) {
            lines.push(`Interpreter Path        : ${report.pythonInterpreterPath}`);
        }
        lines.push(`Behave Execution        : ${report.behaveExecution}`);
        lines.push(`Behave Executable       : ${report.behaveExecutableStatus}`);
        lines.push(`Project Config (.json)  : ${report.projectConfigStatus}`);
        lines.push('');

        if (report.bootstrapCapabilities.length > 0) {
            lines.push('--- BOOTSTRAP CAPABILITIES ---');
            report.bootstrapCapabilities.forEach(c => {
                const retryStr = c.retryCount > 0 ? ` (retries: ${c.retryCount})` : '';
                const errorStr = c.error ? ` - Error: ${c.error}` : '';
                lines.push(`[${c.criticality.toUpperCase()}] ${c.id}: ${c.state}${retryStr}${errorStr}`);
            });
            lines.push('');
        }

        if (report.warnings.length > 0) {
            lines.push('--- WARNINGS ---');
            report.warnings.forEach(w => lines.push(`⚠️ ${w}`));
            lines.push('');
        }

        if (report.recommendations.length > 0) {
            lines.push('--- ACTIONABLE RECOMMENDATIONS ---');
            report.recommendations.forEach(r => lines.push(`💡 ${r}`));
            lines.push('');
        }

        lines.push('=== END OF REPORT ===');
        return lines.join('\n');
    }
}

let diagnosticOutputChannel: vscode.OutputChannel | undefined;

export async function showDiagnosticsReport(
    context: vscode.ExtensionContext,
    symbolCache?: SymbolCache,
    featureCache?: FeatureCache,
    configService?: ConfigurationService,
    bootstrap?: DeferredBootstrap
): Promise<string> {
    const engine = new DiagnosticEngine();
    const report = await engine.collectDiagnostics(symbolCache, featureCache, configService, bootstrap);
    const rawMarkdown = engine.generateReportMarkdown(report);
    const sanitizedMarkdown = redactReportText(rawMarkdown);

    if (!diagnosticOutputChannel) {
        diagnosticOutputChannel = vscode.window.createOutputChannel('Gherkin Diagnostics');
        context.subscriptions.push(diagnosticOutputChannel);
    }

    diagnosticOutputChannel.clear();
    diagnosticOutputChannel.appendLine(sanitizedMarkdown);
    diagnosticOutputChannel.show(true);

    vscode.window.showInformationMessage(
        'Gherkin: Diagnostic report generated in Output Channel.',
        '📋 Copy Sanitized Report'
    ).then(selection => {
        if (selection === '📋 Copy Sanitized Report') {
            vscode.env.clipboard.writeText(sanitizedMarkdown);
            vscode.window.showInformationMessage('Sanitized diagnostic report copied to clipboard.');
        }
    });

    return sanitizedMarkdown;
}
