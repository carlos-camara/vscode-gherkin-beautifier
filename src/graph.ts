import * as vscode from 'vscode';
import { WorkspaceEventBus } from './eventBus';
import { astRepository } from './ast';
import { featureDiscoveryService } from './featureDiscovery';
import { SymbolCache } from './cache';
import { ResourceIdentity } from './utils/resourceIdentity';
import { logger } from './logger';
import { DialectService } from './dialect';
import type { Tag, Step } from '@cucumber/messages';
import { parseExecuteSteps } from './tokenizer';

export type NodeType = 'Feature' | 'Rule' | 'Background' | 'Scenario' | 'Step' | 'Example' | 'Tag' | 'StepDefinition' | 'PythonFile';

export interface GraphNode {
    readonly id: string;
    readonly type: NodeType;
    readonly uri: string;
    readonly line: number;
}

export interface FeatureNode extends GraphNode { readonly type: 'Feature'; children: string[]; tags: string[]; readonly name: string; }
export interface RuleNode extends GraphNode { readonly type: 'Rule'; children: string[]; tags: string[]; readonly parent: string; readonly name: string; }
export interface ScenarioNode extends GraphNode { readonly type: 'Scenario'; steps: string[]; examples: string[]; tags: string[]; readonly parent: string; readonly name: string; }
export interface BackgroundNode extends GraphNode { readonly type: 'Background'; steps: string[]; readonly parent: string; }
export interface StepNode extends GraphNode { readonly type: 'Step'; readonly text: string; readonly definitionId?: string; readonly parent: string; readonly keyword: string; readonly semanticType?: 'given' | 'when' | 'then' | 'step'; }
export interface ExampleNode extends GraphNode { readonly type: 'Example'; tags: string[]; readonly parent: string; readonly name: string; }
export interface TagNode extends GraphNode { readonly type: 'Tag'; readonly name: string; targets: string[]; }
export interface StepDefNode extends GraphNode { readonly type: 'StepDefinition'; readonly pattern: string; readonly matcherType: string; readonly semanticType?: 'given' | 'when' | 'then' | 'step'; readonly pythonFile: string; usages: string[]; }
export interface PythonFileNode extends GraphNode { readonly type: 'PythonFile'; definitions: string[]; }

export class WorkspaceGraphGeneration {
    constructor(
        public readonly version: number,
        public readonly nodes: ReadonlyMap<string, GraphNode>,
        public readonly uriToNodes: ReadonlyMap<string, ReadonlySet<string>>,
        public readonly unresolvedSteps: ReadonlySet<string>,
        public readonly parseErrors: ReadonlyMap<string, ReadonlyArray<any>> = new Map()
    ) {}

    public getAllStepNodes(): StepNode[] {
        return Array.from(this.nodes.values()).filter(n => n.type === 'Step') as StepNode[];
    }

    public getAllStepDefNodes(): StepDefNode[] {
        return Array.from(this.nodes.values()).filter(n => n.type === 'StepDefinition') as StepDefNode[];
    }

    public getUsages(stepDefId: string): StepNode[] {
        const defNode = this.nodes.get(stepDefId) as StepDefNode | undefined;
        if (!defNode) return [];
        return defNode.usages.map(id => this.nodes.get(id) as StepNode).filter(n => !!n);
    }

    public getReferences(stepId: string): StepDefNode | undefined {
        const stepNode = this.nodes.get(stepId) as StepNode | undefined;
        if (!stepNode || !stepNode.definitionId) return undefined;
        return this.nodes.get(stepNode.definitionId) as StepDefNode | undefined;
    }

    public getImpactedScenarios(tagId: string): ScenarioNode[] {
        const tagNode = this.nodes.get(tagId.startsWith('Tag:') ? tagId : `Tag:${tagId}`) as TagNode | undefined;
        if (!tagNode) return [];
        return tagNode.targets.map(id => this.nodes.get(id) as ScenarioNode).filter(n => !!n);
    }

    public getDuplicateImplementations(): StepDefNode[][] {
        const duplicates: StepDefNode[][] = [];
        const patternMap = new Map<string, StepDefNode[]>();

        for (const node of this.nodes.values()) {
            if (node.type === 'StepDefinition') {
                const def = node as StepDefNode;
                const key = `${def.matcherType}:${def.pattern}`;
                if (!patternMap.has(key)) patternMap.set(key, []);
                patternMap.get(key)!.push(def);
            }
        }

        for (const defs of patternMap.values()) {
            if (defs.length > 1) {
                duplicates.push(defs);
            }
        }

        return duplicates;
    }

    public getAllNodes(): GraphNode[] {
        return Array.from(this.nodes.values());
    }

    public getNode(id: string): GraphNode | undefined {
        return this.nodes.get(id);
    }
}

export class GraphTransaction {
    public readonly baseGeneration: WorkspaceGraphGeneration;
    public readonly nodes: Map<string, GraphNode>;
    public readonly uriToNodes: Map<string, Set<string>>;
    public readonly unresolvedSteps: Set<string>;
    public readonly parseErrors: Map<string, readonly any[]>;
    private modified = new Set<string>();

    constructor(baseGeneration: WorkspaceGraphGeneration) {
        this.baseGeneration = baseGeneration;
        this.nodes = new Map(baseGeneration.nodes);
        this.uriToNodes = new Map();
        for (const [uri, set] of baseGeneration.uriToNodes.entries()) {
            this.uriToNodes.set(uri, new Set(set));
        }
        this.unresolvedSteps = new Set(baseGeneration.unresolvedSteps);
        this.parseErrors = new Map(baseGeneration.parseErrors);
    }

    public getNodeForMutation<T extends GraphNode>(id: string): T | undefined {
        const node = this.nodes.get(id);
        if (!node) return undefined;

        if (!this.modified.has(id)) {
            // Deep clone arrays for safety on structural sharing
            const cloned = { ...node } as any;
            if (cloned.children) cloned.children = [...cloned.children];
            if (cloned.tags) cloned.tags = [...cloned.tags];
            if (cloned.targets) cloned.targets = [...cloned.targets];
            if (cloned.usages) cloned.usages = [...cloned.usages];
            if (cloned.examples) cloned.examples = [...cloned.examples];
            if (cloned.steps) cloned.steps = [...cloned.steps];
            if (cloned.definitions) cloned.definitions = [...cloned.definitions];

            this.nodes.set(id, cloned as T);
            this.modified.add(id);
            return cloned as T;
        }

        return node as T;
    }

    public setNode(node: GraphNode): void {
        this.nodes.set(node.id, node);
        this.modified.add(node.id);

        if (!this.uriToNodes.has(node.uri)) {
            this.uriToNodes.set(node.uri, new Set());
        }
        this.uriToNodes.get(node.uri)!.add(node.id);

        if (node.type === 'Step') {
            const step = node as StepNode;
            if (!step.definitionId) {
                this.unresolvedSteps.add(node.id);
            } else {
                this.unresolvedSteps.delete(node.id);
            }
        }
    }

    public deleteNode(id: string): void {
        const node = this.nodes.get(id);
        if (node) {
            const set = this.uriToNodes.get(node.uri);
            if (set) {
                set.delete(id);
                if (set.size === 0) {
                    this.uriToNodes.delete(node.uri);
                    this.parseErrors.delete(node.uri);
                }
            }
            if (node.type === 'Step') {
                this.unresolvedSteps.delete(id);
            }
        }
        this.nodes.delete(id);
        this.modified.add(id);
    }

    public commit(): WorkspaceGraphGeneration {
        return new WorkspaceGraphGeneration(
            this.baseGeneration.version + 1,
            this.nodes,
            this.uriToNodes,
            this.unresolvedSteps,
            this.parseErrors
        );
    }
}

export class WorkspaceGraph {
    public currentGeneration: WorkspaceGraphGeneration = new WorkspaceGraphGeneration(0, new Map(), new Map(), new Set());
    private updateRequests = new Map<string, number>();
    private commitMutex: Promise<void> = Promise.resolve();

    private eventBusDisposable?: vscode.Disposable;
    private symbolCache: SymbolCache;

    constructor(symbolCache: SymbolCache) {
        this.symbolCache = symbolCache;
    }

    private getCanonicalUri(uri: vscode.Uri | string): string {
        return ResourceIdentity.getCanonicalUriString(uri);
    }

    public setEventBus(eventBus: WorkspaceEventBus) {
        this.eventBusDisposable?.dispose();
        this.eventBusDisposable = eventBus.onEvent(e => {
            if (e.type === 'featureFileChanged' || e.type === 'featureFileCreated') {
                this.indexFeatureFile(e.uri);
            } else if (e.type === 'featureFileDeleted') {
                this.removeFileAsync(this.getCanonicalUri(e.uri));
            } else if (e.type === 'stepDefinitionsUpdated') {
                this.indexPythonFile(e.uri);
            } else if (e.type === 'stepFileDeleted') {
                this.removeFileAsync(this.getCanonicalUri(e.uri));
            }
        });
    }

    private isInitialized = false;

    public async initialize(): Promise<void> {
        if (this.isInitialized) return;
        this.isInitialized = true;

        try {
            const featureUris = await featureDiscoveryService.getFeatureFiles();
            for (const uri of featureUris) {
                await this.indexFeatureFile(uri);
            }

            const allDefs = await this.symbolCache.getAllStepDefinitions();
            const pythonUris = new Set(allDefs.map(d => d.uri.toString()));
            for (const uriStr of pythonUris) {
                await this.indexPythonFile(vscode.Uri.parse(uriStr));
            }
        } catch (err) {
            logger.error(`WorkspaceGraph: Error during initialization`, err);
        }
    }

    public async executeTransaction(reqId: number, uriStr: string, buildFn: (tx: GraphTransaction) => Promise<void>) {
        const previousMutex = this.commitMutex;
        let resolveMutex: () => void;
        this.commitMutex = new Promise(r => resolveMutex = r);

        await previousMutex;

        try {
            if (this.updateRequests.get(uriStr) !== reqId) {
                return; // Obsolete request
            }
            const tx = new GraphTransaction(this.currentGeneration);
            await buildFn(tx);
            this.currentGeneration = tx.commit();
        } finally {
            resolveMutex!();
        }
    }

    private async removeFileAsync(uriStr: string) {
        const reqId = (this.updateRequests.get(uriStr) || 0) + 1;
        this.updateRequests.set(uriStr, reqId);
        await this.executeTransaction(reqId, uriStr, async (tx) => {
            this.removeNodesByUriTx(tx, uriStr);
            tx.parseErrors.delete(uriStr);
        });
    }

    public cancelAll() {
        this.updateRequests.clear();
    }

    /**
     * Visible for testing only. Bypasses transaction locking to inject nodes directly.
     */
    public setNodeForTest(node: GraphNode) {
        const newNodes = new Map<string, GraphNode>((this.currentGeneration as any).nodes);
        newNodes.set(node.id, node);

        const newUriToNodes = new Map(this.currentGeneration.uriToNodes);
        if (!newUriToNodes.has(node.uri)) {
            newUriToNodes.set(node.uri, new Set());
        }
        const set = new Set(newUriToNodes.get(node.uri));
        set.add(node.id);
        newUriToNodes.set(node.uri, set);

        const newUnresolvedSteps = new Set(this.currentGeneration.unresolvedSteps);
        if (node.type === 'Step') {
            const step = node as StepNode;
            if (!step.definitionId) {
                newUnresolvedSteps.add(node.id);
            } else {
                newUnresolvedSteps.delete(node.id);
            }
        }

        this.currentGeneration = new WorkspaceGraphGeneration(this.currentGeneration.version + 1, newNodes, newUriToNodes, newUnresolvedSteps);
    }

    /**
     * Visible for testing only. Bypasses transaction locking to remove nodes directly.
     */
    public deleteNodeForTest(id: string) {
        const node = this.currentGeneration.nodes.get(id);
        const newNodes = new Map<string, GraphNode>((this.currentGeneration as any).nodes);
        newNodes.delete(id);

        const newUriToNodes = new Map(this.currentGeneration.uriToNodes);
        if (node && newUriToNodes.has(node.uri)) {
            const set = new Set(newUriToNodes.get(node.uri));
            set.delete(id);
            if (set.size === 0) {
                newUriToNodes.delete(node.uri);
            } else {
                newUriToNodes.set(node.uri, set);
            }
        }

        const newUnresolvedSteps = new Set(this.currentGeneration.unresolvedSteps);
        if (node && node.type === 'Step') {
            newUnresolvedSteps.delete(id);
        }

        this.currentGeneration = new WorkspaceGraphGeneration(this.currentGeneration.version + 1, newNodes, newUriToNodes, newUnresolvedSteps);
    }

    private async indexFeatureFile(uri: vscode.Uri) {
        const uriStr = this.getCanonicalUri(uri);
        const reqId = (this.updateRequests.get(uriStr) || 0) + 1;
        this.updateRequests.set(uriStr, reqId);

        try {
            let content = '';
            const openDoc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uriStr);
            if (openDoc) {
                content = openDoc.getText();
            } else {
                const bytes = await vscode.workspace.fs.readFile(uri);
                content = new TextDecoder('utf8').decode(bytes);
            }

            const parseResult = await astRepository.getAST({ uri, version: openDoc ? openDoc.version : 0, getText: () => content });
            const docAST = parseResult.document;

            if (this.updateRequests.get(uriStr) !== reqId) return;

            await this.executeTransaction(reqId, uriStr, async (tx) => {
                this.removeNodesByUriTx(tx, uriStr);

                // Store parse errors
                if (parseResult.errors && parseResult.errors.length > 0) {
                    tx.parseErrors.set(uriStr, parseResult.errors);
                } else {
                    tx.parseErrors.delete(uriStr);
                }

                if (!docAST || !docAST.feature) return;
                await this.symbolCache.ensureInitialized();

                const featureAST = docAST.feature;

                const processTags = (tags: readonly Tag[] | undefined): string[] => {
                    if (!tags) return [];
                    const tagNames = tags.map(t => t.name);
                    tagNames.forEach(t => {
                        let tagNode = tx.nodes.get(`Tag:${t}`) as TagNode;
                        if (!tagNode) {
                            tagNode = { id: `Tag:${t}`, type: 'Tag', uri: '', line: 0, name: t, targets: [] };
                            tx.setNode(tagNode);
                        }
                    });
                    return tagNames;
                };

                const featureId = `${uriStr}:${featureAST.location.line}`;
                const featureTags = processTags(featureAST.tags);
                const featureNode: FeatureNode = {
                    id: featureId, type: 'Feature', uri: uriStr, line: featureAST.location.line,
                    children: [], tags: featureTags, name: featureAST.name
                };

                const dialectService = new DialectService();
                const dialect = dialectService.detectDialect(content);

                const traverseSteps = async (steps: readonly Step[] | undefined, parentId: string): Promise<string[]> => {
                    let currentSemanticType: 'given' | 'when' | 'then' | 'step' = 'step';
                    if (!steps) return [];
                    const stepIds: string[] = [];
                    for (const step of steps) {
                        const stepId = `${uriStr}:${step.location.line}`;
                        const kw = step.keyword ? step.keyword.trim() : '';
                        currentSemanticType = dialectService.resolveSemanticTypeDownwards(kw, currentSemanticType, dialect);

                        const stepNode: StepNode = {
                            id: stepId, type: 'Step', uri: uriStr, line: step.location.line,
                            text: step.text, parent: parentId, keyword: step.keyword,
                            semanticType: currentSemanticType
                        };
                        tx.setNode(stepNode);
                        stepIds.push(stepId);

                        await this.resolveStepDefinitionTx(tx, stepNode);
                    }
                    return stepIds;
                };

                if (featureAST.children) {
                    for (const child of featureAST.children) {
                        if (child.background) {
                            const bgId = `${uriStr}:${child.background.location.line}`;
                            const bgNode: BackgroundNode = {
                                id: bgId, type: 'Background', uri: uriStr, line: child.background.location.line,
                                steps: await traverseSteps(child.background.steps, bgId), parent: featureId
                            };
                            tx.setNode(bgNode);
                            featureNode.children.push(bgId);
                        } else if (child.scenario) {
                            const sc = child.scenario;
                            const scId = `${uriStr}:${sc.location.line}`;
                            const scTags = processTags(sc.tags);
                            const scNode: ScenarioNode = {
                                id: scId, type: 'Scenario', uri: uriStr, line: sc.location.line,
                                steps: await traverseSteps(sc.steps, scId), examples: [], tags: scTags, parent: featureId, name: sc.name
                            };

                            if (sc.examples) {
                                for (const ex of sc.examples) {
                                    const exId = `${uriStr}:${ex.location.line}`;
                                    const exTags = processTags(ex.tags);
                                    const exNode: ExampleNode = {
                                        id: exId, type: 'Example', uri: uriStr, line: ex.location.line,
                                        tags: exTags, parent: scId, name: ex.name
                                    };
                                    tx.setNode(exNode);
                                    scNode.examples.push(exId);
                                }
                            }
                            tx.setNode(scNode);
                            featureNode.children.push(scId);

                            const inheritedTags = [...new Set([...featureTags, ...scTags])];
                            inheritedTags.forEach(t => {
                                const tNode = tx.getNodeForMutation<TagNode>(`Tag:${t}`);
                                if (tNode && !tNode.targets.includes(scId)) tNode.targets.push(scId);
                            });
                        } else if (child.rule) {
                            const r = child.rule;
                            const rId = `${uriStr}:${r.location.line}`;
                            const rTags = processTags(r.tags);
                            const rNode: RuleNode = {
                                id: rId, type: 'Rule', uri: uriStr, line: r.location.line,
                                children: [], tags: rTags, parent: featureId, name: r.name
                            };

                            if (r.children) {
                                for (const rChild of r.children) {
                                    if (rChild.background) {
                                        const bgId = `${uriStr}:${rChild.background.location.line}`;
                                        const bgNode: BackgroundNode = {
                                            id: bgId, type: 'Background', uri: uriStr, line: rChild.background.location.line,
                                            steps: await traverseSteps(rChild.background.steps, bgId), parent: rId
                                        };
                                        tx.setNode(bgNode);
                                        rNode.children.push(bgId);
                                    } else if (rChild.scenario) {
                                        const sc = rChild.scenario;
                                        const scId = `${uriStr}:${sc.location.line}`;
                                        const scTags = processTags(sc.tags);
                                        const scNode: ScenarioNode = {
                                            id: scId, type: 'Scenario', uri: uriStr, line: sc.location.line,
                                            steps: await traverseSteps(sc.steps, scId), examples: [], tags: scTags, parent: rId, name: sc.name
                                        };
                                        if (sc.examples) {
                                            for (const ex of sc.examples) {
                                                const exId = `${uriStr}:${ex.location.line}`;
                                                const exTags = processTags(ex.tags);
                                                const exNode: ExampleNode = {
                                                    id: exId, type: 'Example', uri: uriStr, line: ex.location.line,
                                                    tags: exTags, parent: scId, name: ex.name
                                                };
                                                tx.setNode(exNode);
                                                scNode.examples.push(exId);
                                            }
                                        }
                                        tx.setNode(scNode);
                                        rNode.children.push(scId);

                                        const inheritedTags = [...new Set([...featureTags, ...rTags, ...scTags])];
                                        inheritedTags.forEach(t => {
                                            const tNode = tx.getNodeForMutation<TagNode>(`Tag:${t}`);
                                            if (tNode && !tNode.targets.includes(scId)) tNode.targets.push(scId);
                                        });
                                    }
                                }
                            }
                            tx.setNode(rNode);
                            featureNode.children.push(rId);
                        }
                    }
                }
                tx.setNode(featureNode);
            });
        } catch (err) {
            logger.error(`WorkspaceGraph: Error indexing feature file ${uriStr}`, err);
        }
    }

    private async indexPythonFile(uri: vscode.Uri) {
        const uriStr = this.getCanonicalUri(uri);
        const reqId = (this.updateRequests.get(uriStr) || 0) + 1;
        this.updateRequests.set(uriStr, reqId);

        const allDefs = await this.symbolCache.getAllStepDefinitions();
        const fileDefs = allDefs.filter(d => this.getCanonicalUri(d.uri) === uriStr);

        if (fileDefs.length === 0) {
            await this.removeFileAsync(uriStr);
            return;
        }

        try {
            let content = '';
            const openDoc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
            if (openDoc) {
                content = openDoc.getText();
            } else {
                const bytes = await vscode.workspace.fs.readFile(uri);
                content = new TextDecoder('utf8').decode(bytes);
            }

            if (this.updateRequests.get(uriStr) !== reqId) return;

            await this.executeTransaction(reqId, uriStr, async (tx) => {
                this.removeNodesByUriTx(tx, uriStr);

                const pyFileNode: PythonFileNode = {
                    id: uriStr, type: 'PythonFile', uri: uriStr, line: 0, definitions: []
                };

                for (const def of fileDefs) {
                    const defId = `${uriStr}:${def.decoratorRange.start.line}`;
                    const defNode: StepDefNode = {
                        id: defId, type: 'StepDefinition', uri: uriStr, line: def.decoratorRange.start.line,
                        pattern: def.rawPattern, matcherType: def.matcherType, semanticType: def.type, pythonFile: uriStr, usages: []
                    };
                    tx.setNode(defNode);
                    pyFileNode.definitions.push(defId);
                }

                const executeSteps = parseExecuteSteps(content);
                const dialectService = new DialectService();
                const dialect = dialectService.detectDialect(content);

                for (const exStepBlock of executeSteps) {
                    let currentSemanticType: 'given' | 'when' | 'then' | 'step' = 'step';
                    for (const exStep of exStepBlock) {
                        const stepId = `${uriStr}:execute_steps:${exStep.line}:${Math.random().toString(36).substr(2, 5)}`;
                        const kw = exStep.keyword;
                        currentSemanticType = dialectService.resolveSemanticTypeDownwards(kw, currentSemanticType, dialect);

                        let parentDefId = uriStr;
                        for (const def of fileDefs) {
                            if (def.functionRange && exStep.line >= def.functionRange.start.line && exStep.line <= def.functionRange.end.line) {
                                parentDefId = `${uriStr}:${def.decoratorRange.start.line}`;
                                break;
                            }
                        }

                        const stepNode: StepNode = {
                            id: stepId, type: 'Step', uri: uriStr, line: exStep.line,
                            text: exStep.text, parent: parentDefId, keyword: kw,
                            semanticType: currentSemanticType
                        };
                        tx.setNode(stepNode);
                    }
                }

                tx.setNode(pyFileNode);
                await this.resolveImpactedStepsTx(tx);
            });
        } catch (err) {
            logger.error(`WorkspaceGraph: Error parsing execute_steps for ${uriStr}`, err);
        }
    }

    private removeNodesByUriTx(tx: GraphTransaction, uriStr: string) {
        const normalizedUri = ResourceIdentity.getCanonicalUriString(uriStr);
        const nodeIds = tx.uriToNodes.get(normalizedUri);
        if (!nodeIds) return;

        const toDelete = Array.from(nodeIds);

        toDelete.forEach(id => {
            const node = tx.nodes.get(id);
            if (node) {
                if (node.type === 'Scenario') {
                    const scNode = node as ScenarioNode;
                    scNode.tags.forEach(t => {
                        const tagNode = tx.getNodeForMutation<TagNode>(`Tag:${t}`);
                        if (tagNode) {
                            tagNode.targets = tagNode.targets.filter(tId => tId !== id);
                            tx.setNode(tagNode);
                        }
                    });
                }
                if (node.type === 'Step') {
                    const stNode = node as StepNode;
                    if (stNode.definitionId) {
                        const defNode = tx.getNodeForMutation<StepDefNode>(stNode.definitionId);
                        if (defNode) {
                            defNode.usages = defNode.usages.filter(uId => uId !== id);
                            tx.setNode(defNode);
                        }
                    }
                }
                if (node.type === 'StepDefinition') {
                    const defNode = node as StepDefNode;
                    defNode.usages.forEach(stepId => {
                        const stepMut = tx.getNodeForMutation<StepNode>(stepId);
                        if (stepMut) {
                            (stepMut as any).definitionId = undefined;
                            tx.setNode(stepMut); // Triggers unresolvedSteps.add(stepId)
                        }
                    });
                }
            }
        });
        toDelete.forEach(id => tx.deleteNode(id));
    }

    private async resolveStepDefinitionTx(tx: GraphTransaction, stepNode: StepNode) {
        if (!stepNode.text) return;
        const defs = await this.symbolCache.getStepDefinitions(stepNode.text, stepNode.semanticType);
        if (defs.length > 0) {
            const def = defs[0];
            const defUriStr = this.getCanonicalUri(def.uri);
            const defId = `${defUriStr}:${def.decoratorRange.start.line}`;

            const stepMut = tx.getNodeForMutation<StepNode>(stepNode.id);
            if (stepMut) {
                (stepMut as any).definitionId = defId;
                tx.setNode(stepMut); // Triggers unresolvedSteps.delete(stepNode.id)
            }

            const defNode = tx.getNodeForMutation<StepDefNode>(defId);
            if (defNode && !defNode.usages.includes(stepNode.id)) {
                defNode.usages.push(stepNode.id);
                tx.setNode(defNode);
            }
        }
    }

    private async resolveImpactedStepsTx(tx: GraphTransaction) {
        // Only resolve steps that are currently unresolved
        const stepIds = Array.from(tx.unresolvedSteps);
        for (const id of stepIds) {
            const step = tx.nodes.get(id) as StepNode;
            if (step) {
                await this.resolveStepDefinitionTx(tx, step);
            }
        }
    }

    public dispose() {
        this.eventBusDisposable?.dispose();
        this.currentGeneration = new WorkspaceGraphGeneration(this.currentGeneration.version + 1, new Map(), new Map(), new Set());
    }
}
