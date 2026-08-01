import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { discoveryService } from './discovery';
import { SymbolCache } from './cache';

export class BehaveDoctor {
    constructor(private collection: vscode.DiagnosticCollection) {}

    public async analyze(symbolCache: SymbolCache): Promise<void> {
        this.collection.clear();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Behave Doctor: No workspace folder open.');
            return;
        }

        const mainFolder = workspaceFolders[0].uri;
        const diagnostics: vscode.Diagnostic[] = [];

        // 1. Workspace Trust
        if (!vscode.workspace.isTrusted) {
            diagnostics.push(this.createDiag('Workspace is not trusted. Some features may be disabled.', vscode.DiagnosticSeverity.Warning, 'WORKSPACE_NOT_TRUSTED'));
        }

        // 2. Python installation
        const pythonExt = vscode.extensions.getExtension('ms-python.python');
        if (!pythonExt) {
            diagnostics.push(this.createDiag('Python extension is not installed.', vscode.DiagnosticSeverity.Error, 'MISSING_PYTHON_EXT'));
        }

        // 3. Virtual environments & execution config
        let pythonPath: string | undefined;
        try {
            const pyConfig = vscode.workspace.getConfiguration('python', mainFolder);
            pythonPath = pyConfig.get<string>('defaultInterpreterPath') || pyConfig.get<string>('pythonPath');
        } catch {}

        if (pythonPath) {
            const isVenv = pythonPath.includes('.venv') || pythonPath.includes('venv') || pythonPath.includes('env');
            if (!isVenv) {
                diagnostics.push(this.createDiag('Python interpreter does not seem to point to a virtual environment.', vscode.DiagnosticSeverity.Information, 'NO_VIRTUAL_ENV'));
            }
        }

        // 4. Missing folders
        const featuresPath = vscode.Uri.joinPath(mainFolder, 'features');
        if (!fs.existsSync(featuresPath.fsPath)) {
            diagnostics.push(this.createDiag('Missing "features" folder in workspace root.', vscode.DiagnosticSeverity.Warning, 'MISSING_FEATURES_FOLDER'));
        } else {
            const stepsPath = vscode.Uri.joinPath(featuresPath, 'steps');
            if (!fs.existsSync(stepsPath.fsPath)) {
                diagnostics.push(this.createDiag('Missing "features/steps" folder.', vscode.DiagnosticSeverity.Warning, 'MISSING_STEPS_FOLDER'));
            }
        }

        // 5. Behave Installation
        const config = vscode.workspace.getConfiguration('gherkinPowerTools.behave', mainFolder);
        const behaveCmd = config.get<string>('command') || 'behave';
        
        try {
            await this.execCommand(`${behaveCmd} --version`, mainFolder.fsPath);
        } catch (e) {
            diagnostics.push(this.createDiag(`Behave command "${behaveCmd}" failed. Is behave installed in your environment?`, vscode.DiagnosticSeverity.Error, 'BEHAVE_NOT_INSTALLED'));
        }

        // 6. Step & Feature Discovery
        const stepFiles = await discoveryService.getStepFiles();
        if (stepFiles.length === 0) {
            diagnostics.push(this.createDiag('No Python step definitions found. Check "gherkinPowerTools.behave.stepGlobs".', vscode.DiagnosticSeverity.Warning, 'NO_STEPS_DISCOVERED'));
        }

        let featureFilesCount = 0;
        try {
            const features = await vscode.workspace.findFiles('**/*.feature', '{**/node_modules/**,**/.venv/**,**/venv/**,**/env/**}');
            featureFilesCount = features.length;
        } catch {}

        if (featureFilesCount === 0) {
            diagnostics.push(this.createDiag('No .feature files discovered in the workspace.', vscode.DiagnosticSeverity.Information, 'NO_FEATURES_DISCOVERED'));
        }

        // 7. Duplicate step definitions
        const allDefs = await symbolCache.getAllStepDefinitions();
        const seenPatterns = new Map<string, vscode.Uri>();
        for (const def of allDefs) {
            if (seenPatterns.has(def.pattern)) {
                diagnostics.push(this.createDiag(`Duplicate step definition pattern found: "${def.pattern}"`, vscode.DiagnosticSeverity.Warning, 'DUPLICATE_STEP_DEFINITION'));
            } else {
                seenPatterns.set(def.pattern, def.uri);
            }
        }

        // 8. Invalid Settings (Check if stepGlobs is empty)
        const stepGlobs = config.get<string[]>('stepGlobs') || [];
        if (stepGlobs.length === 0) {
            diagnostics.push(this.createDiag('Setting "gherkinPowerTools.behave.stepGlobs" is empty. Step discovery is broken.', vscode.DiagnosticSeverity.Error, 'EMPTY_STEP_GLOBS'));
        }

        // Attach diagnostics to the main folder URI
        this.collection.set(mainFolder, diagnostics);

        // Generate and show markdown report
        const report = this.generateReportMarkdown(diagnostics, mainFolder.fsPath);
        const doc = await vscode.workspace.openTextDocument({ content: report, language: 'markdown' });
        await vscode.window.showTextDocument(doc);
    }

    private createDiag(message: string, severity: vscode.DiagnosticSeverity, code: string): vscode.Diagnostic {
        const diag = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), message, severity);
        diag.source = 'Behave Doctor';
        diag.code = code;
        return diag;
    }

    private execCommand(cmd: string, cwd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.exec(cmd, { cwd }, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stdout.toString());
                }
            });
        });
    }

    private generateReportMarkdown(diagnostics: vscode.Diagnostic[], workspacePath: string): string {
        const lines: string[] = [];
        lines.push('# 🩺 Behave Doctor Report');
        lines.push(`**Workspace**: \`${workspacePath}\``);
        lines.push(`**Timestamp**: \`${new Date().toISOString()}\``);
        lines.push('');
        
        if (diagnostics.length === 0) {
            lines.push('✅ **All checks passed!** Your workspace looks healthy.');
            return lines.join('\n');
        }

        lines.push('## ⚠️ Issues Detected');
        lines.push('');
        
        for (const diag of diagnostics) {
            let sevString = 'ℹ️ Info';
            if (diag.severity === vscode.DiagnosticSeverity.Error) sevString = '❌ Error';
            if (diag.severity === vscode.DiagnosticSeverity.Warning) sevString = '⚠️ Warning';

            lines.push(`### ${sevString}: \`${diag.code}\``);
            lines.push(`**Description**: ${diag.message}`);
            
            // Add recommendation
            let fix = 'Review workspace configuration.';
            if (diag.code === 'MISSING_FEATURES_FOLDER') fix = 'Create a `features/` directory in the root of your workspace.';
            if (diag.code === 'MISSING_STEPS_FOLDER') fix = 'Create a `features/steps/` directory.';
            if (diag.code === 'MISSING_PYTHON_EXT') fix = 'Install the `ms-python.python` extension from the marketplace.';
            if (diag.code === 'NO_VIRTUAL_ENV') fix = 'Create a virtual environment (`python -m venv .venv`) and select it in VS Code.';
            if (diag.code === 'BEHAVE_NOT_INSTALLED') fix = 'Install behave (`pip install behave`) in your active environment.';
            if (diag.code === 'EMPTY_STEP_GLOBS') fix = 'Reset `gherkinPowerTools.behave.stepGlobs` to default in your settings.';
            
            lines.push(`**Recommended Fix**: ${fix}`);
            lines.push('');
        }

        lines.push('---');
        lines.push('💡 **Tip**: Check the "Problems" panel (`Cmd+Shift+M` or `Ctrl+Shift+M`) to access automated **Quick Fixes** for some of these issues.');
        
        return lines.join('\n');
    }
}

export class DoctorCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];

    public provideCodeActions(document: vscode.TextDocument, _range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, _token: vscode.CancellationToken): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'Behave Doctor') continue;

            if (diagnostic.code === 'MISSING_FEATURES_FOLDER') {
                const action = new vscode.CodeAction("Create 'features' folder", vscode.CodeActionKind.QuickFix);
                action.command = {
                    command: 'gherkinPowerTools.doctor.createFolder',
                    title: 'Create Folder',
                    arguments: [vscode.Uri.joinPath(document.uri, 'features')]
                };
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                actions.push(action);
            } else if (diagnostic.code === 'MISSING_STEPS_FOLDER') {
                const action = new vscode.CodeAction("Create 'features/steps' folder", vscode.CodeActionKind.QuickFix);
                action.command = {
                    command: 'gherkinPowerTools.doctor.createFolder',
                    title: 'Create Folder',
                    arguments: [vscode.Uri.joinPath(document.uri, 'features', 'steps')]
                };
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                actions.push(action);
            } else if (diagnostic.code === 'EMPTY_STEP_GLOBS') {
                const action = new vscode.CodeAction("Reset 'stepGlobs' to default", vscode.CodeActionKind.QuickFix);
                action.command = {
                    command: 'gherkinPowerTools.doctor.resetStepGlobs',
                    title: 'Reset Step Globs',
                    arguments: [document.uri]
                };
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                actions.push(action);
            } else if (diagnostic.code === 'MISSING_PYTHON_EXT') {
                const action = new vscode.CodeAction("Install Python Extension", vscode.CodeActionKind.QuickFix);
                action.command = {
                    command: 'workbench.extensions.installExtension',
                    title: 'Install Extension',
                    arguments: ['ms-python.python']
                };
                action.diagnostics = [diagnostic];
                actions.push(action);
            }
        }

        return actions;
    }
}
