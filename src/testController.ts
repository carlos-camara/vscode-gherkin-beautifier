import * as vscode from 'vscode';
import { parseGherkin } from './parser';
import { logger } from './logger';
import { resolveBehaveExecutionDetails } from './execution';
import * as child_process from 'child_process';
import { ConfigurationService } from './configuration';
import * as path from 'path';

export class GherkinTestController {
    private controller: vscode.TestController;
    private configService: ConfigurationService;
    private fileWatcher?: vscode.FileSystemWatcher;

    constructor(configService: ConfigurationService) {
        this.configService = configService;
        this.controller = vscode.tests.createTestController('gherkin-tests', 'Gherkin / Behave');
        
        this.controller.resolveHandler = async (item) => {
            if (!item) {
                await this.discoverAllFilesInWorkspace();
            } else {
                await this.parseTestsInFileContents(item);
            }
        };

        this.controller.createRunProfile(
            'Run Behave Tests',
            vscode.TestRunProfileKind.Run,
            (request, token) => this.runHandler(request, token),
            true
        );

        this.startWatchingWorkspace();
    }

    public dispose() {
        this.controller.dispose();
        this.fileWatcher?.dispose();
    }

    private startWatchingWorkspace() {
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.feature');
        this.fileWatcher.onDidCreate(uri => this.getOrCreateFile(uri));
        this.fileWatcher.onDidChange(uri => this.parseTestsInFileContents(this.getOrCreateFile(uri)));
        this.fileWatcher.onDidDelete(uri => this.controller.items.delete(uri.toString()));
    }

    private async discoverAllFilesInWorkspace() {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }
        for (const workspaceFolder of vscode.workspace.workspaceFolders) {
            const pattern = new vscode.RelativePattern(workspaceFolder, '**/*.feature');
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
            for (const file of files) {
                await this.parseTestsInFileContents(this.getOrCreateFile(file));
            }
        }
    }

    private getOrCreateFile(uri: vscode.Uri): vscode.TestItem {
        const existing = this.controller.items.get(uri.toString());
        if (existing) {
            return existing;
        }
        const file = this.controller.createTestItem(uri.toString(), path.basename(uri.fsPath), uri);
        this.controller.items.add(file);
        file.canResolveChildren = true;
        return file;
    }

    private async parseTestsInFileContents(fileItem: vscode.TestItem) {
        if (!fileItem.uri) return;
        
        try {
            const doc = await vscode.workspace.openTextDocument(fileItem.uri);
            const text = doc.getText();
            const { document } = await parseGherkin(text);
            
            // Clear existing children
            fileItem.children.replace([]);

            if (!document || !document.feature) {
                return;
            }

            const feature = document.feature;
            const featureId = `${fileItem.uri.toString()}#feature`;
            const featureItem = this.controller.createTestItem(featureId, `Feature: ${feature.name}`, fileItem.uri);
            
            const startLine = feature.location.line - 1;
            const startChar = feature.location.column ? feature.location.column - 1 : 0;
            featureItem.range = new vscode.Range(startLine, startChar, startLine, startChar + 10);
            
            fileItem.children.add(featureItem);

            for (const child of feature.children) {
                if (child.scenario) {
                    this.addScenario(featureItem, child.scenario, fileItem.uri);
                } else if (child.rule) {
                    const ruleId = `${fileItem.uri.toString()}#rule:${child.rule.name}`;
                    const ruleItem = this.controller.createTestItem(ruleId, `Rule: ${child.rule.name}`, fileItem.uri);
                    const rLine = child.rule.location.line - 1;
                    const rCol = child.rule.location.column ? child.rule.location.column - 1 : 0;
                    ruleItem.range = new vscode.Range(rLine, rCol, rLine, rCol + 10);
                    featureItem.children.add(ruleItem);

                    for (const ruleChild of child.rule.children) {
                        if (ruleChild.scenario) {
                            this.addScenario(ruleItem, ruleChild.scenario, fileItem.uri);
                        }
                    }
                }
            }
        } catch (e) {
            logger.error(`Error parsing file for Test Explorer: ${e}`);
        }
    }

    private addScenario(parentItem: vscode.TestItem, scenario: any, uri: vscode.Uri) {
        const scenarioId = `${uri.toString()}#scenario:${scenario.location.line}`;
        const name = scenario.name ? scenario.name : `Line ${scenario.location.line}`;
        const scenarioItem = this.controller.createTestItem(scenarioId, `Scenario: ${name}`, uri);
        
        const line = scenario.location.line - 1;
        const col = scenario.location.column ? scenario.location.column - 1 : 0;
        scenarioItem.range = new vscode.Range(line, col, line, col + 10);
        
        parentItem.children.add(scenarioItem);
    }

    private async runHandler(request: vscode.TestRunRequest, token: vscode.CancellationToken) {
        const run = this.controller.createTestRun(request);
        const queue: vscode.TestItem[] = [];

        if (request.include) {
            request.include.forEach(test => queue.push(test));
        } else {
            this.controller.items.forEach(test => queue.push(test));
        }

        // We only support running full files or full workspaces for now to keep it simple,
        // or we run specific files based on the include selection.
        const filesToRun = new Set<vscode.Uri>();
        const extractFiles = (item: vscode.TestItem) => {
            if (item.uri) { filesToRun.add(item.uri); }
            item.children.forEach(extractFiles);
        };
        queue.forEach(extractFiles);

        for (const uri of filesToRun) {
            if (token.isCancellationRequested) { break; }
            await this.runBehaveOnFile(uri, run, token);
        }

        run.end();
    }

    private async runBehaveOnFile(uri: vscode.Uri, run: vscode.TestRun, token: vscode.CancellationToken) {
        const details = await resolveBehaveExecutionDetails(uri, undefined, this.configService);
        if (!details) {
            logger.error(`Could not resolve behave execution for ${uri.fsPath}`);
            return;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(uri.fsPath);

        const args = [...details.args, '-f', 'json', uri.fsPath];

        return new Promise<void>((resolve) => {
            const proc = child_process.spawn(details.executable, args, { cwd });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', chunk => stdout += chunk.toString());
            proc.stderr.on('data', chunk => stderr += chunk.toString());

            token.onCancellationRequested(() => {
                proc.kill();
                resolve();
            });

            proc.on('close', () => {
                if (token.isCancellationRequested) return resolve();
                
                try {
                    // Behave output can contain text before and after the JSON array
                    const jsonStart = stdout.indexOf('[');
                    const jsonEnd = stdout.lastIndexOf(']') + 1;
                    
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        const jsonStr = stdout.substring(jsonStart, jsonEnd);
                        const results = JSON.parse(jsonStr);
                        this.mapResultsToTestItems(uri, results, run);
                    } else {
                        logger.error(`Could not find JSON array in Behave output. Stderr: ${stderr}`);
                    }
                } catch (e) {
                    logger.error(`Failed to parse Behave JSON output. Error: ${e}. Stderr: ${stderr}`);
                }
                resolve();
            });
        });
    }

    private mapResultsToTestItems(uri: vscode.Uri, results: any[], run: vscode.TestRun) {
        const fileItem = this.controller.items.get(uri.toString());
        if (!fileItem) return;

        // results is an array of features
        for (const featureResult of results) {
            const elements = featureResult.elements || [];
            for (const element of elements) {
                if (element.type === 'scenario') {
                    // Behave JSON formatter uses "location": "file.feature:line"
                    let line: number | undefined;
                    if (element.location) {
                        const parts = element.location.split(':');
                        if (parts.length > 1) {
                            line = parseInt(parts[parts.length - 1], 10);
                        }
                    } else if (element.line) {
                        // Standard Cucumber format fallback
                        line = element.line;
                    }

                    if (line !== undefined) {
                        const scenarioItem = this.findScenarioItemByLine(fileItem, line);
                        
                        if (scenarioItem) {
                            const status = element.status;
                            if (status === 'passed') {
                                run.passed(scenarioItem);
                            } else if (status === 'failed') {
                                run.failed(scenarioItem, new vscode.TestMessage('Scenario failed'));
                            } else if (status === 'skipped') {
                                run.skipped(scenarioItem);
                            }
                        }
                    }
                }
            }
        }
    }

    private findScenarioItemByLine(item: vscode.TestItem, line: number): vscode.TestItem | undefined {
        if (item.id.includes(`#scenario:${line}`)) {
            return item;
        }
        for (const [_, child] of item.children) {
            const found = this.findScenarioItemByLine(child, line);
            if (found) return found;
        }
        return undefined;
    }
}
