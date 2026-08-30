import * as vscode from 'vscode';
import { astRepository } from './ast';
import { featureDiscoveryService } from './featureDiscovery';
import { logger } from './logger';
import { ConfigurationService } from './configuration';
import { TestSelectionNormalizer } from './testSelectionNormalizer';
import { runBehaveForTestRun } from './execution';
import * as path from 'path';
import { WorkspaceEventBus } from './eventBus';
import { TestIdentity } from './testIdentity';


export class GherkinTestController {
    private controller: vscode.TestController;
    private configService: ConfigurationService;
    private eventBus?: WorkspaceEventBus;
    private eventBusDisposable?: vscode.Disposable;
    private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private activeStepDecoration: vscode.TextEditorDecorationType;

    constructor(context: vscode.ExtensionContext, configService: ConfigurationService, testControllerId?: string) {
        this.configService = configService;
        const cid = testControllerId || 'gherkin-tests';
        this.controller = vscode.tests.createTestController(cid, 'Gherkin / Behave');

        this.activeStepDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
            isWholeLine: true,
            border: '1px solid',
            borderColor: new vscode.ThemeColor('editor.wordHighlightBorder')
        });
        context.subscriptions.push(this.activeStepDecoration);

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
    }

    /**
     * Subscribes to the Workspace Event Bus to receive file system and editor changes.
     * This service relies on the Event Bus for lifecycle updates rather than direct API calls.
     */
    public setEventBus(eventBus: WorkspaceEventBus) {
        this.eventBus = eventBus;
        this.eventBusDisposable?.dispose();
        this.eventBusDisposable = this.eventBus.onEvent(e => {
            if (e.type === 'featureFileCreated') {
                this.getOrCreateFile(e.uri);
            } else if (e.type === 'featureFileChanged') {
                this.parseTestsInFileContents(this.getOrCreateFile(e.uri));
            } else if (e.type === 'featureFileDeleted') {
                this.controller.items.delete(e.uri.toString());
            } else if (e.type === 'textDocumentOpened' || e.type === 'textDocumentChanged') {
                const doc = e.type === 'textDocumentOpened' ? e.document : e.event.document;
                if (!doc.uri.fsPath.endsWith('.feature')) { return; }

                const key = doc.uri.toString();
                const existing = this.debounceTimers.get(key);
                if (existing) { clearTimeout(existing); }

                const timer = setTimeout(() => {
                    this.debounceTimers.delete(key);
                    const fileItem = this.getOrCreateFile(doc.uri);
                    this.parseTestsInDocumentContent(fileItem, doc);
                }, 400);

                this.debounceTimers.set(key, timer);
            }
        });

        for (const document of vscode.workspace.textDocuments) {
            if (document.uri.fsPath.endsWith('.feature')) {
                const fileItem = this.getOrCreateFile(document.uri);
                this.parseTestsInDocumentContent(fileItem, document);
            }
        }
    }
    public dispose() {
        this.eventBusDisposable?.dispose();
        this.controller.dispose();
        for (const timer of this.debounceTimers.values()) { clearTimeout(timer); }
        this.debounceTimers.clear();
        this.activeStepDecoration.dispose();
    }

    private clearActiveStepDecoration(uri?: vscode.Uri) {
        for (const editor of vscode.window.visibleTextEditors) {
            if (!uri || editor.document.uri.toString() === uri.toString()) {
                editor.setDecorations(this.activeStepDecoration, []);
            }
        }
    }



    private async discoverAllFilesInWorkspace() {
        const files = await featureDiscoveryService.getFeatureFiles();
        for (const file of files) {
            await this.parseTestsInFileContents(this.getOrCreateFile(file));
        }
    }

    private getOrCreateFile(uri: vscode.Uri): vscode.TestItem {
        const existing = this.controller.items.get(uri.toString());
        if (existing) { return existing; }
        
        const fileName = path.basename(uri.fsPath);
        const niceName = fileName
            .replace(/\.feature$/i, '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());

        const file = this.controller.createTestItem(uri.toString(), niceName, uri);
        file.description = fileName;
        
        this.controller.items.add(file);
        file.canResolveChildren = true;
        return file;
    }

    private async parseTestsInFileContents(fileItem: vscode.TestItem) {
        if (!fileItem.uri) { return; }
        try {
            const doc = await vscode.workspace.openTextDocument(fileItem.uri);
            await this.parseTestsInDocumentContent(fileItem, doc);
        } catch (e) {
            logger.error(`Error parsing file for Test Explorer: ${e}`);
        }
    }

    private async parseTestsInDocumentContent(fileItem: vscode.TestItem, document: vscode.TextDocument) {
        if (!fileItem.uri) { return; }
        try {
            const { document: docAST } = await astRepository.getAST(document);
            fileItem.children.replace([]);
            if (!docAST?.feature) { return; }

            const feature = docAST.feature;
            const featureItem = this.controller.createTestItem(
                TestIdentity.createId(fileItem.uri, 'feature'),
                feature.name || 'Unnamed Feature',
                fileItem.uri
            );
            featureItem.description = 'Feature';
            featureItem.sortText = String(feature.location.line).padStart(5, '0');
            if (feature.tags && Array.isArray(feature.tags)) {
                featureItem.tags = feature.tags.map((t: any) => new vscode.TestTag(t.name));
            }
            const fLine = feature.location.line - 1;
            featureItem.range = new vscode.Range(fLine, 0, fLine, 100);
            fileItem.children.add(featureItem);

            for (const child of feature.children) {
                if (child.scenario) {
                    this.addScenario(featureItem, child.scenario, fileItem.uri);
                } else if (child.rule) {
                    const ruleItem = this.controller.createTestItem(
                        TestIdentity.createId(fileItem.uri, 'rule', child.rule.location.line),
                        child.rule.name || 'Unnamed Rule',
                        fileItem.uri
                    );
                    ruleItem.description = 'Rule';
                    ruleItem.sortText = String(child.rule.location.line).padStart(5, '0');
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
        
        const scenarioItem = this.controller.createTestItem(
            TestIdentity.createId(uri, isOutline ? 'outline' : 'scenario', line),
            scenario.name || `Unnamed ${isOutline ? 'Outline' : 'Scenario'}`,
            uri
        );
        scenarioItem.description = isOutline ? 'Scenario Outline' : 'Scenario';
        scenarioItem.sortText = String(line).padStart(5, '0');
        
        if (scenario.tags && Array.isArray(scenario.tags)) {
            scenarioItem.tags = scenario.tags.map((t: any) => new vscode.TestTag(t.name));
        }

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
                        TestIdentity.createId(uri, 'row', rowLine),
                        preview || `Row ${rowLine}`,
                        uri
                    );
                    exampleItem.description = 'Example';
                    exampleItem.sortText = String(rowLine).padStart(5, '0');
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
        if (!vscode.workspace.isTrusted) {
            vscode.window.showWarningMessage("Test execution disabled in untrusted workspace.");
            return;
        }

        const run = mode !== 'debug' ? this.controller.createTestRun(request) : undefined;

        const normalizer = new TestSelectionNormalizer();
        const itemsToRun = normalizer.normalize(request, this.controller.items);

        // Recursively enqueue all children so the UI shows spinners
        const enqueueItem = (item: vscode.TestItem) => {
            run?.enqueued(item);
            item.children.forEach(enqueueItem);
        };
        itemsToRun.forEach(enqueueItem);

        if (token.isCancellationRequested) {
            run?.end();
            return;
        }

        if (mode === 'edit') {
            const firstUri = itemsToRun[0]?.uri;
            if (firstUri) {
                await vscode.commands.executeCommand('gherkinPowerTools.runScenarioWithArgs', firstUri, undefined);
            }
            run?.end();
            return;
        }

        // Helper to find a child item by its line number
        const findItemByLine = (parent: vscode.TestItem, line: number): vscode.TestItem | undefined => {
            const identity = TestIdentity.parse(parent.id);
            if (identity.line === line) return parent;
            for (const [_, child] of parent.children) {
                const found = findItemByLine(child, line);
                if (found) return found;
            }
            return undefined;
        };

        // Helper to find a child item by its name as fallback
        const findItemByName = (parent: vscode.TestItem, name: string): vscode.TestItem | undefined => {
            if (parent.label.includes(name)) return parent;
            for (const [_, child] of parent.children) {
                const found = findItemByName(child, name);
                if (found) return found;
            }
            return undefined;
        };

        // Group into ExecutionTargets
        const targetsByUri = new Map<string, { uri: vscode.Uri, runWholeFeature: boolean, lines: Set<number>, items: vscode.TestItem[] }>();

        for (const item of itemsToRun) {
            if (!item.uri) continue;
            const uriStr = item.uri.toString();
            if (!targetsByUri.has(uriStr)) {
                targetsByUri.set(uriStr, { uri: item.uri, runWholeFeature: false, lines: new Set(), items: [] });
            }
            const target = targetsByUri.get(uriStr)!;
            target.items.push(item);

            const identity = TestIdentity.parse(item.id);
            if (identity.type === 'feature') {
                target.runWholeFeature = true;
            } else if (identity.line !== undefined) {
                target.lines.add(identity.line);
            }
        }

        for (const target of targetsByUri.values()) {
            if (token.isCancellationRequested) break;
            
            // For debug mode, we just run the first line (multiple lines in debug is messy)
            if (mode === 'debug') {
                const firstItem = target.items[0];
                const identity = TestIdentity.parse(firstItem.id);
                await vscode.commands.executeCommand(
                    identity.line !== undefined ? 'gherkinPowerTools.debugScenario' : 'gherkinPowerTools.debugFeature',
                    target.uri,
                    identity.line
                );
                continue;
            }
            
            if (run) {
                target.items.forEach(item => run.started(item));
                
                const labelList = target.items.map(i => i.label).join(', ');
                run.appendOutput(`\r\n\x1b[36m▶ Running [${target.uri.fsPath}]: ${labelList}\x1b[0m\r\n`);

                let capturedOutput = '';
                let currentScenarioItem: vscode.TestItem | undefined;
                let currentStepItem: vscode.TestItem | undefined;
                let currentScenarioFailed = false;
                let currentScenarioDuration = 0;
                let currentScenarioErrorFile: string | undefined;
                let currentScenarioErrorLine: number | undefined;
                let currentScenarioErrorMessage: string | undefined;
                const processedItems = new Set<vscode.TestItem>();

                const outcome = await runBehaveForTestRun(
                    target.uri,
                    target.runWholeFeature ? undefined : target.lines,
                    this.configService,
                    (text) => {
                        capturedOutput += text;
                        run.appendOutput(text, undefined, currentStepItem || currentScenarioItem || target.items[0]);
                    },
                    token,
                    (event) => {
                        if (event.type === 'scenario') {
                            currentScenarioFailed = false;
                            currentScenarioDuration = 0;
                            currentScenarioErrorFile = undefined;
                            currentScenarioErrorLine = undefined;
                            currentScenarioErrorMessage = undefined;
                            currentStepItem = undefined;
                            const rootItem = this.controller.items.get(target.uri.toString());
                            if (rootItem) {
                                currentScenarioItem = findItemByLine(rootItem, event.payload.line) || (event.payload.name ? findItemByName(rootItem, event.payload.name) : undefined);
                            }
                            if (currentScenarioItem) {
                                const childrenToRemove: string[] = [];
                                currentScenarioItem.children.forEach(child => {
                                    if (child.id.includes('#error:')) {
                                        childrenToRemove.push(child.id);
                                    }
                                });
                                childrenToRemove.forEach(id => currentScenarioItem!.children.delete(id));
                                run.started(currentScenarioItem);
                            }
                        } else if (event.type === 'step_start') {
                            if (currentScenarioItem && currentScenarioItem.uri) {
                                if (event.payload.line) {
                                    currentStepItem = findItemByLine(currentScenarioItem, event.payload.line);
                                    if (currentStepItem) {
                                        run.started(currentStepItem);
                                    }
                                }
                                const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === currentScenarioItem!.uri!.toString());
                                if (editor && event.payload.line) {
                                    const line = event.payload.line - 1;
                                    const range = new vscode.Range(line, 0, line, 0);
                                    editor.setDecorations(this.activeStepDecoration, [range]);
                                }
                            }
                        } else if (event.type === 'step') {
                            if (currentScenarioItem && currentScenarioItem.uri) {
                                this.clearActiveStepDecoration(currentScenarioItem.uri);
                            }
                            if (currentStepItem) {
                                if (['failed', 'undefined', 'error'].includes(event.payload.status)) {
                                    const msg = new vscode.TestMessage(event.payload.error_message || 'Step failed');
                                    if (event.payload.error_file && event.payload.error_line) {
                                        msg.location = new vscode.Location(vscode.Uri.file(event.payload.error_file), new vscode.Position(event.payload.error_line - 1, 0));
                                    }
                                    run.failed(currentStepItem, msg, event.payload.duration ? event.payload.duration * 1000 : undefined);
                                } else {
                                    run.passed(currentStepItem, event.payload.duration ? event.payload.duration * 1000 : undefined);
                                }
                            }
                            currentStepItem = undefined;
                            
                            if (['failed', 'undefined', 'error'].includes(event.payload.status)) {
                                currentScenarioFailed = true;
                                if (event.payload.error_file && event.payload.error_line !== undefined) {
                                    currentScenarioErrorFile = event.payload.error_file;
                                    currentScenarioErrorLine = event.payload.error_line;
                                }
                                if (event.payload.error_message) {
                                    currentScenarioErrorMessage = event.payload.error_message;
                                }
                            }
                            if (event.payload.duration) {
                                currentScenarioDuration += event.payload.duration;
                            }
                        } else if (event.type === 'scenario_result') {
                            if (currentScenarioItem && TestIdentity.parse(currentScenarioItem.id).line === event.payload.line) {
                                processedItems.add(currentScenarioItem);
                                
                                if (event.payload.context_snapshot) {
                                    const keys = Object.keys(event.payload.context_snapshot);
                                    if (keys.length > 0) {
                                        let snapshotOutput = '\r\n\x1b[35m--------------------------------------------------\x1b[0m\r\n';
                                        snapshotOutput += '\x1b[35mFINAL CONTEXT STATE (Context Snapshot)\x1b[0m\r\n';
                                        snapshotOutput += '\x1b[35m--------------------------------------------------\x1b[0m\r\n';
                                        for (const key of keys) {
                                            snapshotOutput += `\x1b[34m• context.${key}\x1b[0m = ${event.payload.context_snapshot[key]}\r\n`;
                                        }
                                        snapshotOutput += '\x1b[35m--------------------------------------------------\x1b[0m\r\n\r\n';
                                        run.appendOutput(snapshotOutput, undefined, currentScenarioItem);
                                    }
                                }

                                const isFailure = ['failed', 'error', 'hook_error'].includes(event.payload.status) || currentScenarioFailed;
                                if (isFailure) {
                                    if (event.payload.error_message) {
                                        currentScenarioErrorMessage = event.payload.error_message;
                                    }
                                    const rawMsg = currentScenarioErrorMessage || "Scenario failed";
                                    const msgText = rawMsg.split('\n').filter((line, index, arr) => index === 0 || line !== arr[index - 1]).join('\n');
                                    
                                    const md = new vscode.MarkdownString();
                                    md.appendMarkdown(`**Execution Failed**\n\n\`\`\`python\n${msgText}\n\`\`\``);
                                    const msg = new vscode.TestMessage(md);
                                    
                                    let stepItem: vscode.TestItem | undefined;
                                    if (currentScenarioErrorFile && currentScenarioErrorLine !== undefined) {
                                        const uri = vscode.Uri.file(currentScenarioErrorFile);
                                        const pos = new vscode.Position(currentScenarioErrorLine - 1, 0);
                                        msg.location = new vscode.Location(uri, pos);
                                        
                                        // Create a child TestItem so clicking the scenario doesn't auto-open peek view
                                        const stepId = `${currentScenarioItem.id}#error:${currentScenarioErrorLine}`;
                                        stepItem = this.controller.createTestItem(
                                            stepId,
                                            `Failed at line ${currentScenarioErrorLine}`,
                                            uri
                                        );
                                        stepItem.description = 'Exception';
                                        stepItem.range = new vscode.Range(pos, pos);
                                        currentScenarioItem.children.add(stepItem);
                                        run.started(stepItem);
                                        run.failed(stepItem, msg, currentScenarioDuration * 1000 || undefined);
                                    }
                                    
                                    if (stepItem) {
                                        // Fail the scenario without a message to prevent auto-peek
                                        run.failed(currentScenarioItem, [], currentScenarioDuration * 1000 || undefined);
                                    } else {
                                        run.failed(currentScenarioItem, msg, currentScenarioDuration * 1000 || undefined);
                                    }
                                } else if (event.payload.status === 'skipped' || event.payload.status === 'untested') {
                                    run.skipped(currentScenarioItem);
                                } else {
                                    run.passed(currentScenarioItem, currentScenarioDuration * 1000 || undefined);
                                }
                                this.clearActiveStepDecoration(currentScenarioItem.uri);
                                currentScenarioItem = undefined;
                            }
                        }
                    }
                );

                if (outcome.type === 'failure' && processedItems.size === 0) {
                    const cleanOutput = capturedOutput.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
                    const md = new vscode.MarkdownString(`**Behave exited with code ${outcome.code}.**\n\n\`\`\`text\n${cleanOutput}\n\`\`\``);
                    target.items.forEach(item => run.failed(item, new vscode.TestMessage(md)));
                } else if (outcome.type === 'launch_failure' || outcome.type === 'process_error' || outcome.type === 'protocol_failure') {
                    const errorMsg = outcome.type === 'launch_failure' ? outcome.error : 
                                     outcome.type === 'process_error' ? `Process crashed: ${outcome.error}` : 
                                     `Protocol error: ${outcome.error}`;
                    target.items.forEach(item => run.errored(item, new vscode.TestMessage(errorMsg)));
                } else if (outcome.type === 'timeout') {
                    target.items.forEach(item => run.errored(item, new vscode.TestMessage(`Execution timed out after ${outcome.durationSeconds} seconds.`)));
                } else if (outcome.type !== 'cancelled') {
                    const markUnprocessed = (node: vscode.TestItem, isTargeted: boolean = false) => {
                        const targeted = isTargeted || target.items.includes(node);
                        if (node.children.size === 0) {
                            if (!processedItems.has(node) && targeted) {
                                run.skipped(node);
                            }
                        } else {
                            node.children.forEach(child => markUnprocessed(child, targeted));
                        }
                    };
                    target.items.forEach(item => markUnprocessed(item, true));
                }
            }
        }

        this.clearActiveStepDecoration();
        run?.end();
    }

}
