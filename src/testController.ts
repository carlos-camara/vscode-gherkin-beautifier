import * as vscode from 'vscode';
import { parseGherkin } from './parser';
import { logger } from './logger';
import { ConfigurationService } from './configuration';
import * as path from 'path';

/** Extracts the scenario line number from a TestItem ID of the form `uri#scenario:LINE` */
function extractLineFromId(id: string): number | undefined {
    const match = id.match(/#scenario:(\d+)$/);
    return match ? parseInt(match[1], 10) : undefined;
}

/** Returns whether a TestItem represents a scenario (has a line in its ID) */
function isScenarioItem(item: vscode.TestItem): boolean {
    return item.id.includes('#scenario:');
}

/** Returns whether a TestItem represents a file-level node */
function isFileItem(item: vscode.TestItem): boolean {
    return !item.id.includes('#');
}

export class GherkinTestController {
    private controller: vscode.TestController;
    private fileWatcher?: vscode.FileSystemWatcher;
    private textChangeDisposable?: vscode.Disposable;
    private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(_configService: ConfigurationService) {
        this.controller = vscode.tests.createTestController('gherkin-tests', 'Gherkin / Behave');

        this.controller.resolveHandler = async (item) => {
            if (!item) {
                await this.discoverAllFilesInWorkspace();
            } else {
                await this.parseTestsInFileContents(item);
            }
        };

        // --- Run profile ---
        this.controller.createRunProfile(
            '▶ Run',
            vscode.TestRunProfileKind.Run,
            (request, token) => this.runHandler(request, token, 'run'),
            true
        );

        // --- Debug profile ---
        this.controller.createRunProfile(
            '🐞 Debug',
            vscode.TestRunProfileKind.Debug,
            (request, token) => this.runHandler(request, token, 'debug'),
            true
        );

        // Note: "Edit args & Run" is exposed as a standalone toolbar icon button
        // via package.json contributes.menus > view/title (see gherkinPowerTools.testExplorerEditAndRun)

        this.startWatchingWorkspace();
        this.startWatchingTextChanges();
    }

    public dispose() {
        this.controller.dispose();
        this.fileWatcher?.dispose();
        this.textChangeDisposable?.dispose();
        for (const timer of this.debounceTimers.values()) { clearTimeout(timer); }
        this.debounceTimers.clear();
    }

    private startWatchingWorkspace() {
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.feature');
        this.fileWatcher.onDidCreate(uri => this.getOrCreateFile(uri));
        this.fileWatcher.onDidChange(uri => this.parseTestsInFileContents(this.getOrCreateFile(uri)));
        this.fileWatcher.onDidDelete(uri => this.controller.items.delete(uri.toString()));
    }

    /** Refreshes the tree as the user types in .feature files (debounced 400 ms). */
    private startWatchingTextChanges() {
        this.textChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
            const { uri } = event.document;
            if (!uri.fsPath.endsWith('.feature')) { return; }

            const key = uri.toString();
            const existing = this.debounceTimers.get(key);
            if (existing) { clearTimeout(existing); }

            const timer = setTimeout(() => {
                this.debounceTimers.delete(key);
                const fileItem = this.getOrCreateFile(uri);
                // Use the in-memory text directly so the tree stays in sync
                // even before the file is saved.
                this.parseTestsInDocumentContent(fileItem, event.document.getText());
            }, 400);

            this.debounceTimers.set(key, timer);
        });
    }

    private async discoverAllFilesInWorkspace() {
        if (!vscode.workspace.workspaceFolders) { return; }
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
        if (existing) { return existing; }
        const file = this.controller.createTestItem(uri.toString(), path.basename(uri.fsPath), uri);
        this.controller.items.add(file);
        file.canResolveChildren = true;
        return file;
    }

    private async parseTestsInFileContents(fileItem: vscode.TestItem) {
        if (!fileItem.uri) { return; }
        try {
            const doc = await vscode.workspace.openTextDocument(fileItem.uri);
            await this.parseTestsInDocumentContent(fileItem, doc.getText());
        } catch (e) {
            logger.error(`Error parsing file for Test Explorer: ${e}`);
        }
    }

    private async parseTestsInDocumentContent(fileItem: vscode.TestItem, text: string) {
        if (!fileItem.uri) { return; }
        try {
            const { document } = await parseGherkin(text);
            fileItem.children.replace([]);
            if (!document?.feature) { return; }

            const feature = document.feature;
            const featureItem = this.controller.createTestItem(
                `${fileItem.uri.toString()}#feature`,
                `Feature: ${feature.name}`,
                fileItem.uri
            );
            const fLine = feature.location.line - 1;
            featureItem.range = new vscode.Range(fLine, 0, fLine, 100);
            fileItem.children.add(featureItem);

            for (const child of feature.children) {
                if (child.scenario) {
                    this.addScenario(featureItem, child.scenario, fileItem.uri);
                } else if (child.rule) {
                    const ruleItem = this.controller.createTestItem(
                        `${fileItem.uri.toString()}#rule:${child.rule.location.line}`,
                        `Rule: ${child.rule.name}`,
                        fileItem.uri
                    );
                    const rLine = child.rule.location.line - 1;
                    ruleItem.range = new vscode.Range(rLine, 0, rLine, 100);
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
        const line = scenario.location.line;
        const isOutline = scenario.keyword?.trim().toLowerCase().includes('outline');
        const label = `${isOutline ? 'Scenario Outline' : 'Scenario'}: ${scenario.name || `Line ${line}`}`;

        const scenarioItem = this.controller.createTestItem(
            `${uri.toString()}#scenario:${line}`,
            label,
            uri
        );
        scenarioItem.range = new vscode.Range(line - 1, 0, line - 1, 100);
        parentItem.children.add(scenarioItem);

        // Expand each Examples table row as a child TestItem so they can be run individually
        if (isOutline && scenario.examples) {
            for (const examplesBlock of scenario.examples) {
                const tableRows: any[] = examplesBlock.tableBody || [];
                const headerCells: string[] = (examplesBlock.tableHeader?.cells || []).map((c: any) => c.value);

                for (const row of tableRows) {
                    const rowLine = row.location.line;
                    const cellValues: string[] = (row.cells || []).map((c: any) => c.value);
                    // Build a readable label using first two columns as preview
                    const preview = cellValues.slice(0, 2).map((v, i) => `${headerCells[i]}=${v}`).join(', ');
                    const exampleItem = this.controller.createTestItem(
                        `${uri.toString()}#scenario:${rowLine}`,
                        `Example: ${preview || `Row ${rowLine}`}`,
                        uri
                    );
                    exampleItem.range = new vscode.Range(rowLine - 1, 0, rowLine - 1, 100);
                    scenarioItem.children.add(exampleItem);
                }
            }
        }
    }

    private async runHandler(
        request: vscode.TestRunRequest,
        token: vscode.CancellationToken,
        mode: 'run' | 'debug' | 'edit'
    ) {
        const run = this.controller.createTestRun(request);

        // Collect all leaf (scenario) items that should run
        const scenarioItems: vscode.TestItem[] = [];
        const fileItems: vscode.TestItem[] = [];

        const collectItems = (item: vscode.TestItem) => {
            if (isScenarioItem(item)) {
                scenarioItems.push(item);
            } else if (isFileItem(item)) {
                fileItems.push(item);
                // Also collect all scenario children
                item.children.forEach(feat => feat.children.forEach(child => {
                    if (isScenarioItem(child)) { scenarioItems.push(child); }
                    else { child.children.forEach(sc => { if (isScenarioItem(sc)) { scenarioItems.push(sc); } }); }
                }));
            } else {
                // Feature or Rule node: collect all scenario children
                item.children.forEach(child => collectItems(child));
            }
        };

        if (request.include) {
            request.include.forEach(item => collectItems(item));
        } else {
            this.controller.items.forEach(item => collectItems(item));
        }

        // Mark them all as enqueued (shows spinner)
        scenarioItems.forEach(item => run.enqueued(item));

        if (token.isCancellationRequested) {
            run.end();
            return;
        }

        // For "edit" mode: show the args prompt once before running
        if (mode === 'edit') {
            const firstUri = scenarioItems[0]?.uri || fileItems[0]?.uri;
            if (firstUri) {
                // The prompt updates memoryAdditionalArgs; then we fall through to 'run'
                await vscode.commands.executeCommand(
                    'gherkinPowerTools.runScenarioWithArgs',
                    firstUri,
                    undefined
                );
            }
            run.end();
            return;
        }

        // Execute each item using the same commands as CodeLens
        for (const item of scenarioItems) {
            if (token.isCancellationRequested) { break; }
            if (!item.uri) { continue; }

            const line = extractLineFromId(item.id);
            run.started(item);

            // Use the right event source: Tasks fire onDidEndTaskProcess,
            // debug sessions fire onDidTerminateDebugSession.
            const done = mode === 'debug'
                ? this.waitForDebugEnd()
                : this.waitForTaskEnd(item.uri, line);

            if (mode === 'debug') {
                await vscode.commands.executeCommand(
                    line !== undefined ? 'gherkinPowerTools.debugScenario' : 'gherkinPowerTools.debugFeature',
                    item.uri,
                    line
                );
            } else {
                await vscode.commands.executeCommand(
                    line !== undefined ? 'gherkinPowerTools.runScenario' : 'gherkinPowerTools.runFeature',
                    item.uri,
                    line
                );
            }

            // Wait for the task/debug session to finish and get exit code
            const exitCode = await done;
            if (exitCode === 0) {
                run.passed(item);
            } else if (exitCode !== null) {
                run.failed(item, new vscode.TestMessage(`Behave exited with code ${exitCode}`));
            }
            // If exitCode is null it means the debug session ended (no exit code available)
        }

        // If no individual scenarios were run (feature-level), run at file level
        if (scenarioItems.length === 0) {
            for (const fileItem of fileItems) {
                if (token.isCancellationRequested) { break; }
                if (!fileItem.uri) { continue; }
                await vscode.commands.executeCommand('gherkinPowerTools.runFeature', fileItem.uri);
            }
        }

        run.end();
    }

    /**
     * Returns a promise that resolves with the exit code when the next gherkin
     * task (ProcessExecution) finishes. Only suitable for `run` mode.
     */
    private waitForTaskEnd(_uri: vscode.Uri, _line: number | undefined): Promise<number | null> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                taskDisposable?.dispose();
                resolve(null);
            }, 5 * 60 * 1000); // 5 minute safety timeout

            const taskDisposable = vscode.tasks.onDidEndTaskProcess(e => {
                if (e.execution.task.source === 'Gherkin PowerTools') {
                    clearTimeout(timeout);
                    taskDisposable.dispose();
                    resolve(e.exitCode ?? null);
                }
            });
        });
    }

    /**
     * Returns a promise that resolves (with null) when the next Behave debug
     * session terminates. Used in `debug` mode so the spinner clears immediately
     * instead of waiting for the 5-minute task timeout.
     */
    private waitForDebugEnd(): Promise<null> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                debugDisposable?.dispose();
                resolve(null);
            }, 5 * 60 * 1000); // 5 minute safety timeout

            const debugDisposable = vscode.debug.onDidTerminateDebugSession(session => {
                if (session.name === 'Debug Behave (PowerTools)') {
                    clearTimeout(timeout);
                    debugDisposable.dispose();
                    resolve(null);
                }
            });
        });
    }
}
