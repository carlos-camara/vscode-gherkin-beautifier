import * as vscode from 'vscode';
import { WorkspaceEventBus } from './eventBus';
import { astRepository } from './ast';
import { SymbolCache } from './cache';
import { logger } from './logger';
import type { Tag, Step } from '@cucumber/messages';

export type NodeType = 'Feature' | 'Rule' | 'Background' | 'Scenario' | 'Step' | 'Example' | 'Tag' | 'StepDefinition' | 'PythonFile';

export interface GraphNode {
    id: string;
    type: NodeType;
    uri: string;
    line: number;
}

export interface FeatureNode extends GraphNode { type: 'Feature'; children: string[]; tags: string[]; name: string; }
export interface RuleNode extends GraphNode { type: 'Rule'; children: string[]; tags: string[]; parent: string; name: string; }
export interface ScenarioNode extends GraphNode { type: 'Scenario'; steps: string[]; examples: string[]; tags: string[]; parent: string; name: string; }
export interface BackgroundNode extends GraphNode { type: 'Background'; steps: string[]; parent: string; }
export interface StepNode extends GraphNode { type: 'Step'; text: string; definitionId?: string; parent: string; keyword: string; }
export interface ExampleNode extends GraphNode { type: 'Example'; tags: string[]; parent: string; name: string; }
export interface TagNode extends GraphNode { type: 'Tag'; name: string; targets: string[]; }
export interface StepDefNode extends GraphNode { type: 'StepDefinition'; pattern: string; matcherType: string; pythonFile: string; usages: string[]; }
export interface PythonFileNode extends GraphNode { type: 'PythonFile'; definitions: string[]; }

export class WorkspaceGraph {
    private nodes = new Map<string, GraphNode>();
    private eventBusDisposable?: vscode.Disposable;
    private symbolCache: SymbolCache;

    constructor(symbolCache: SymbolCache) {
        this.symbolCache = symbolCache;
    }

    public setEventBus(eventBus: WorkspaceEventBus) {
        this.eventBusDisposable?.dispose();
        this.eventBusDisposable = eventBus.onEvent(e => {
            if (e.type === 'featureFileChanged' || e.type === 'featureFileCreated') {
                this.indexFeatureFile(e.uri);
            } else if (e.type === 'featureFileDeleted') {
                this.removeNodesByUri(e.uri.toString());
            } else if (e.type === 'stepFileChanged' || e.type === 'stepFileCreated') {
                this.indexPythonFile(e.uri);
            } else if (e.type === 'stepFileDeleted') {
                this.removeNodesByUri(e.uri.toString());
            }
        });
    }

    private isInitialized = false;

    public async initialize(): Promise<void> {
        if (this.isInitialized) return;
        this.isInitialized = true;

        try {
            // Find and index all feature files
            const featureUris = await vscode.workspace.findFiles('**/*.feature', '**/{node_modules,.venv,venv,env,.git}/**');
            for (const uri of featureUris) {
                await this.indexFeatureFile(uri);
            }

            // Find and index all python files that have step definitions
            const allDefs = await this.symbolCache.getAllStepDefinitions();
            const pythonUris = new Set(allDefs.map(d => d.uri.toString()));
            for (const uriStr of pythonUris) {
                await this.indexPythonFile(vscode.Uri.parse(uriStr));
            }
        } catch (err) {
            logger.error(`WorkspaceGraph: Error during initialization`, err);
        }
    }

    private async indexFeatureFile(uri: vscode.Uri) {
        try {
            const uriStr = uri.toString();
            this.removeNodesByUri(uriStr);

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

            if (!docAST || !docAST.feature) return;

            const processTags = (tags: readonly Tag[] | undefined): string[] => {
                if (!tags) return [];
                const tagNames = tags.map(t => t.name);
                tagNames.forEach(t => {
                    let tagNode = this.nodes.get(`Tag:${t}`) as TagNode;
                    if (!tagNode) {
                        tagNode = { id: `Tag:${t}`, type: 'Tag', uri: '', line: 0, name: t, targets: [] };
                        this.nodes.set(tagNode.id, tagNode);
                    }
                });
                return tagNames;
            };

            const featureId = `${uriStr}:${docAST.feature.location.line}`;
            const featureTags = processTags(docAST.feature.tags);
            const featureNode: FeatureNode = {
                id: featureId, type: 'Feature', uri: uriStr, line: docAST.feature.location.line,
                children: [], tags: featureTags, name: docAST.feature.name
            };

            const traverseSteps = (steps: readonly Step[] | undefined, parentId: string): string[] => {
                if (!steps) return [];
                const stepIds: string[] = [];
                for (const step of steps) {
                    const stepId = `${uriStr}:${step.location.line}`;
                    const stepNode: StepNode = {
                        id: stepId, type: 'Step', uri: uriStr, line: step.location.line,
                        text: step.text, parent: parentId, keyword: step.keyword
                    };
                    this.nodes.set(stepId, stepNode);
                    stepIds.push(stepId);
                    
                    this.resolveStepDefinition(stepNode);
                }
                return stepIds;
            };

            if (docAST.feature.children) {
                for (const child of docAST.feature.children) {
                    if (child.background) {
                        const bgId = `${uriStr}:${child.background.location.line}`;
                        const bgNode: BackgroundNode = {
                            id: bgId, type: 'Background', uri: uriStr, line: child.background.location.line,
                            steps: traverseSteps(child.background.steps, bgId), parent: featureId
                        };
                        this.nodes.set(bgId, bgNode);
                        featureNode.children.push(bgId);
                    } else if (child.scenario) {
                        const sc = child.scenario;
                        const scId = `${uriStr}:${sc.location.line}`;
                        const scTags = processTags(sc.tags);
                        const scNode: ScenarioNode = {
                            id: scId, type: 'Scenario', uri: uriStr, line: sc.location.line,
                            steps: traverseSteps(sc.steps, scId), examples: [], tags: scTags, parent: featureId, name: sc.name
                        };

                        if (sc.examples) {
                            for (const ex of sc.examples) {
                                const exId = `${uriStr}:${ex.location.line}`;
                                const exTags = processTags(ex.tags);
                                const exNode: ExampleNode = {
                                    id: exId, type: 'Example', uri: uriStr, line: ex.location.line,
                                    tags: exTags, parent: scId, name: ex.name
                                };
                                this.nodes.set(exId, exNode);
                                scNode.examples.push(exId);
                            }
                        }
                        this.nodes.set(scId, scNode);
                        featureNode.children.push(scId);
                        
                        // Add target to tags
                        const inheritedTags = [...new Set([...featureTags, ...scTags])];
                        inheritedTags.forEach(t => {
                            const tNode = this.nodes.get(`Tag:${t}`) as TagNode;
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
                                        steps: traverseSteps(rChild.background.steps, bgId), parent: rId
                                    };
                                    this.nodes.set(bgId, bgNode);
                                    rNode.children.push(bgId);
                                } else if (rChild.scenario) {
                                    const sc = rChild.scenario;
                                    const scId = `${uriStr}:${sc.location.line}`;
                                    const scTags = processTags(sc.tags);
                                    const scNode: ScenarioNode = {
                                        id: scId, type: 'Scenario', uri: uriStr, line: sc.location.line,
                                        steps: traverseSteps(sc.steps, scId), examples: [], tags: scTags, parent: rId, name: sc.name
                                    };
                                    if (sc.examples) {
                                        for (const ex of sc.examples) {
                                            const exId = `${uriStr}:${ex.location.line}`;
                                            const exTags = processTags(ex.tags);
                                            const exNode: ExampleNode = {
                                                id: exId, type: 'Example', uri: uriStr, line: ex.location.line,
                                                tags: exTags, parent: scId, name: ex.name
                                            };
                                            this.nodes.set(exId, exNode);
                                            scNode.examples.push(exId);
                                        }
                                    }
                                    this.nodes.set(scId, scNode);
                                    rNode.children.push(scId);
                                    
                                    const inheritedTags = [...new Set([...featureTags, ...rTags, ...scTags])];
                                    inheritedTags.forEach(t => {
                                        const tNode = this.nodes.get(`Tag:${t}`) as TagNode;
                                        if (tNode && !tNode.targets.includes(scId)) tNode.targets.push(scId);
                                    });
                                }
                            }
                        }
                        this.nodes.set(rId, rNode);
                        featureNode.children.push(rId);
                    }
                }
            }
            this.nodes.set(featureId, featureNode);

        } catch (err) {
            logger.error(`WorkspaceGraph: Error indexing feature file ${uri.toString()}`, err);
        }
    }

    private async indexPythonFile(uri: vscode.Uri) {
        const uriStr = uri.toString();
        this.removeNodesByUri(uriStr);

        const allDefs = await this.symbolCache.getAllStepDefinitions();
        const fileDefs = allDefs.filter(d => d.uri.toString() === uriStr);
        
        if (fileDefs.length === 0) return;

        const pyFileNode: PythonFileNode = {
            id: uriStr, type: 'PythonFile', uri: uriStr, line: 0, definitions: []
        };

        for (const def of fileDefs) {
            const defId = `${uriStr}:${def.decoratorRange.start.line}`;
            const defNode: StepDefNode = {
                id: defId, type: 'StepDefinition', uri: uriStr, line: def.decoratorRange.start.line,
                pattern: def.rawPattern, matcherType: def.matcherType, pythonFile: uriStr, usages: []
            };
            this.nodes.set(defId, defNode);
            pyFileNode.definitions.push(defId);
        }

        this.nodes.set(uriStr, pyFileNode);
        this.resolveAllSteps();
    }

    private removeNodesByUri(uri: string) {
        const toDelete: string[] = [];
        this.nodes.forEach((node, id) => {
            if (node.uri === uri) {
                toDelete.push(id);
                // Also clean up Tag targets if this was a Feature file
                if (node.type === 'Scenario') {
                    const scNode = node as ScenarioNode;
                    scNode.tags.forEach(t => {
                        const tagNode = this.nodes.get(`Tag:${t}`) as TagNode;
                        if (tagNode) {
                            tagNode.targets = tagNode.targets.filter(tId => tId !== id);
                        }
                    });
                }
                // Also clean up StepDefNode usages if this was a Feature file
                if (node.type === 'Step') {
                    const stNode = node as StepNode;
                    if (stNode.definitionId) {
                        const defNode = this.nodes.get(stNode.definitionId) as StepDefNode;
                        if (defNode) {
                            defNode.usages = defNode.usages.filter(uId => uId !== id);
                        }
                    }
                }
                // If Python file, steps that pointed to its defs lose their definitionId
                if (node.type === 'StepDefinition') {
                    this.nodes.forEach(n => {
                        if (n.type === 'Step') {
                            const step = n as StepNode;
                            if (step.definitionId === id) step.definitionId = undefined;
                        }
                    });
                }
            }
        });
        toDelete.forEach(id => this.nodes.delete(id));
    }

    private async resolveStepDefinition(stepNode: StepNode) {
        if (!stepNode.text) return;
        
        const defs = await this.symbolCache.getStepDefinitions(stepNode.text);
        if (defs.length > 0) {
            const def = defs[0];
            const defId = `${def.uri.toString()}:${def.decoratorRange.start.line}`;
            stepNode.definitionId = defId;
            
            const defNode = this.nodes.get(defId) as StepDefNode | undefined;
            if (defNode && !defNode.usages.includes(stepNode.id)) {
                defNode.usages.push(stepNode.id);
            }
        }
    }

    private async resolveAllSteps() {
        for (const node of this.nodes.values()) {
            if (node.type === 'Step') {
                const step = node as StepNode;
                await this.resolveStepDefinition(step);
            }
        }
    }

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
    
    public dispose() {
        this.eventBusDisposable?.dispose();
        this.nodes.clear();
    }
}
