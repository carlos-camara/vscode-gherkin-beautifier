import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigurationService } from './configuration';
import { discoveryService } from './discovery';

export interface OnboardingAnalysis {
    isBehaveProject: boolean;
    uncoveredStepFiles: string[];
    suggestedStepGlobs: string[];
    hasManifest: boolean;
    hasEnvironmentPy: boolean;
}

function findPythonFilesSync(dir: string, ignoreGlobs: string[], maxFiles: number = 200): string[] {
    const results: string[] = [];

    function traverse(currentDir: string) {
        if (results.length >= maxFiles) return;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (results.length >= maxFiles) return;
            const fullPath = path.join(currentDir, entry.name);
            const uri = vscode.Uri.file(fullPath);
            if (discoveryService.isIgnored(uri, ignoreGlobs)) {
                continue;
            }

            if (entry.isDirectory()) {
                if (['node_modules', '.venv', 'venv', 'env', '.git'].includes(entry.name)) {
                    continue;
                }
                traverse(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.py')) {
                results.push(fullPath);
            }
        }
    }

    traverse(dir);
    return results;
}

export class BehaveDetector {
    public static async detectBehaveUsage(folderUri: vscode.Uri): Promise<{ isBehaveProject: boolean; hasManifest: boolean; hasEnvironmentPy: boolean }> {
        let isBehaveProject = false;
        let hasManifest = false;
        let hasEnvironmentPy = false;

        // 1. Check manifests
        const manifestNames = ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py', 'setup.cfg'];
        for (const name of manifestNames) {
            const filePath = path.join(folderUri.fsPath, name);
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    if (/\bbehave\b/i.test(content)) {
                        hasManifest = true;
                        isBehaveProject = true;
                        break;
                    }
                } catch {
                    // Ignore read errors
                }
            }
        }

        // 2. Check environment.py
        if (fs.existsSync(path.join(folderUri.fsPath, 'environment.py'))) {
            hasEnvironmentPy = true;
            isBehaveProject = true;
        } else {
            try {
                const envFiles = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(folderUri, '**/environment.py'),
                    '{**/node_modules/**,**/.venv/**,**/venv/**,**/env/**}',
                    1
                );
                const filtered = envFiles.filter(f => f.fsPath.startsWith(folderUri.fsPath));
                if (filtered.length > 0) {
                    hasEnvironmentPy = true;
                    isBehaveProject = true;
                }
            } catch {
                // Ignore find errors
            }
        }

        // 3. Check for Python step decorators (@given, @when, @then, @step)
        if (!isBehaveProject) {
            let pyFilePaths: string[] = [];
            try {
                const pyFiles = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(folderUri, '**/*.py'),
                    '{**/node_modules/**,**/.venv/**,**/venv/**,**/env/**}',
                    50
                );
                pyFilePaths = pyFiles.filter(f => f.fsPath.startsWith(folderUri.fsPath)).map(f => f.fsPath);
            } catch {
                pyFilePaths = [];
            }

            if (pyFilePaths.length === 0 && fs.existsSync(folderUri.fsPath)) {
                pyFilePaths = findPythonFilesSync(folderUri.fsPath, ['**/node_modules/**', '**/.venv/**', '**/venv/**', '**/env/**'], 50);
            }

            for (const pyPath of pyFilePaths) {
                try {
                    const content = fs.readFileSync(pyPath, 'utf8');
                    if (/@(?:given|when|then|step)\b/i.test(content)) {
                        isBehaveProject = true;
                        break;
                    }
                } catch {
                    // Ignore read errors
                }
            }
        }

        return { isBehaveProject, hasManifest, hasEnvironmentPy };
    }

    public static async checkStepGlobsCoverage(
        folderUri: vscode.Uri,
        currentStepGlobs: string[],
        ignoreGlobs: string[]
    ): Promise<{ uncoveredStepFiles: string[]; suggestedStepGlobs: string[] }> {
        const uncoveredStepFiles: string[] = [];
        const suggestedDirs = new Set<string>();

        let candidatePyPaths: string[] = [];
        try {
            const excludePattern = discoveryService.normalizeGlobs(ignoreGlobs, []).length > 1
                ? `{${ignoreGlobs.join(',')}}`
                : (ignoreGlobs[0] || '');
            const pyFiles = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folderUri, '**/*.py'),
                excludePattern
            );
            candidatePyPaths = pyFiles.filter(f => f.fsPath.startsWith(folderUri.fsPath)).map(f => f.fsPath);
        } catch {
            candidatePyPaths = [];
        }

        if (candidatePyPaths.length === 0 && fs.existsSync(folderUri.fsPath)) {
            candidatePyPaths = findPythonFilesSync(folderUri.fsPath, ignoreGlobs, 200);
        }

        for (const pyPath of candidatePyPaths) {
            try {
                const content = fs.readFileSync(pyPath, 'utf8');
                const pyUri = vscode.Uri.file(pyPath);
                if (/@(?:given|when|then|step)\b/i.test(content) || path.basename(pyPath) === 'environment.py') {
                    const relativePath = path.relative(folderUri.fsPath, pyPath).replace(/\\/g, '/');

                    if (!discoveryService.isIgnored(pyUri, ignoreGlobs)) {
                        // Check if current stepGlobs match this file
                        const matchesCurrentGlobs = currentStepGlobs.some(glob => {
                            const reg = discoveryService.globToRegex(glob);
                            return reg.test(relativePath);
                        });

                        if (!matchesCurrentGlobs) {
                            uncoveredStepFiles.push(relativePath);

                            // Calculate suggested glob
                            const dirName = path.dirname(relativePath);
                            if (dirName && dirName !== '.') {
                                suggestedDirs.add(`**/${dirName}/**/*.py`);
                            } else {
                                suggestedDirs.add('**/*.py');
                            }
                        }
                    }
                }
            } catch {
                // Ignore read errors
            }
        }

        const suggestedStepGlobs = Array.from(new Set([...currentStepGlobs, ...Array.from(suggestedDirs)]));

        return { uncoveredStepFiles, suggestedStepGlobs };
    }
}

export class OnboardingEngine {
    public async analyzeWorkspaceFolder(
        folderUri: vscode.Uri,
        currentStepGlobs: string[],
        ignoreGlobs: string[]
    ): Promise<OnboardingAnalysis> {
        const detection = await BehaveDetector.detectBehaveUsage(folderUri);
        if (!detection.isBehaveProject) {
            return {
                isBehaveProject: false,
                uncoveredStepFiles: [],
                suggestedStepGlobs: currentStepGlobs,
                hasManifest: false,
                hasEnvironmentPy: false
            };
        }

        const coverage = await BehaveDetector.checkStepGlobsCoverage(folderUri, currentStepGlobs, ignoreGlobs);

        return {
            isBehaveProject: true,
            uncoveredStepFiles: coverage.uncoveredStepFiles,
            suggestedStepGlobs: coverage.suggestedStepGlobs,
            hasManifest: detection.hasManifest,
            hasEnvironmentPy: detection.hasEnvironmentPy
        };
    }
}

export function mergeSettingsJson(existingText: string, newStepGlobs: string[]): string {
    let obj: any = {};
    if (existingText && existingText.trim().length > 0) {
        try {
            obj = JSON.parse(existingText);
        } catch {
            obj = {};
        }
    }
    obj['gherkinPowerTools.behave.stepGlobs'] = newStepGlobs;
    return JSON.stringify(obj, null, 4);
}

export function mergeProjectConfigFile(existingText: string, newStepGlobs: string[]): string {
    let obj: any = {};
    if (existingText && existingText.trim().length > 0) {
        try {
            obj = JSON.parse(existingText);
        } catch {
            obj = { profile: 'strict' };
        }
    } else {
        obj.profile = 'strict';
    }
    if (!obj.behave || typeof obj.behave !== 'object') {
        obj.behave = {};
    }
    obj.behave.stepGlobs = newStepGlobs;
    return JSON.stringify(obj, null, 4);
}

export async function showOnboardingNotificationIfNeeded(
    context: vscode.ExtensionContext,
    configService: ConfigurationService
): Promise<boolean> {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    if (workspaceFolders.length === 0) {
        return false;
    }

    const engine = new OnboardingEngine();
    let notificationShown = false;

    for (const folder of workspaceFolders) {
        const dismissalKey = `gherkinPowerTools.dismissOnboarding.${folder.uri.fsPath}`;
        if (context.globalState.get<boolean>(dismissalKey, false)) {
            continue;
        }

        const config = configService.getConfiguration(folder.uri);
        const analysis = await engine.analyzeWorkspaceFolder(
            folder.uri,
            config.behave.stepGlobs,
            config.behave.ignoreGlobs
        );

        if (analysis.isBehaveProject && analysis.uncoveredStepFiles.length > 0) {
            notificationShown = true;
            const stepCount = analysis.uncoveredStepFiles.length;

            vscode.window.showInformationMessage(
                `Discovered ${stepCount} Python step file(s) outside stepGlobs. Update configuration?`,
                '⚙️ Settings',
                '📄 Config',
                '🩺 Diagnostics'
            ).then(async selection => {
                if (selection === '⚙️ Settings') {
                    const vscodeDir = path.join(folder.uri.fsPath, '.vscode');
                    const settingsPath = path.join(vscodeDir, 'settings.json');
                    let existing = '';
                    if (fs.existsSync(settingsPath)) {
                        try { existing = fs.readFileSync(settingsPath, 'utf8'); } catch { existing = ''; }
                    } else if (!fs.existsSync(vscodeDir)) {
                        fs.mkdirSync(vscodeDir, { recursive: true });
                    }
                    const merged = mergeSettingsJson(existing, analysis.suggestedStepGlobs);
                    fs.writeFileSync(settingsPath, merged, 'utf8');
                    vscode.window.showInformationMessage('Workspace settings updated with suggested stepGlobs.');
                } else if (selection === '📄 Config') {
                    const configPath = path.join(folder.uri.fsPath, '.gherkin-powertoolsrc.json');
                    let existing = '';
                    if (fs.existsSync(configPath)) {
                        try { existing = fs.readFileSync(configPath, 'utf8'); } catch { existing = ''; }
                    }
                    const merged = mergeProjectConfigFile(existing, analysis.suggestedStepGlobs);
                    fs.writeFileSync(configPath, merged, 'utf8');
                    vscode.window.showInformationMessage('.gherkin-powertoolsrc.json updated with suggested stepGlobs.');
                } else if (selection === '🩺 Diagnostics') {
                    vscode.commands.executeCommand('gherkinPowerTools.diagnoseWorkspace');
                }
            });
            break;
        }
    }

    return notificationShown;
}
