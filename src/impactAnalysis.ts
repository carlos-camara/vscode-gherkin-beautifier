import { WorkspaceGraph, ScenarioNode } from './graph';

type ImpactSeverity = 'Low' | 'Medium' | 'High';

export interface ImpactReport {
    affectedFeatures: number;
    affectedScenarios: number;
    severity: ImpactSeverity;
    scenarios: ScenarioNode[];
    usages: import('./graph').StepNode[];
    isAmbiguous: boolean;
}

export class ImpactAnalyzer {
    private cache = new Map<string, { version: number, report: ImpactReport }>();

    constructor(private graph: WorkspaceGraph) {}

    public calculateImpact(stepDefId: string): ImpactReport {
        const cached = this.cache.get(stepDefId);
        if (cached && cached.version === this.graph.currentGeneration.version) {
            return cached.report;
        }

        const usages = this.graph.currentGeneration.getUsages(stepDefId);
        
        const affectedScenarios = new Set<string>();
        const affectedFeatures = new Set<string>();
        const scenarioNodes: ScenarioNode[] = [];

        const addScenariosUnder = (parentId: string) => {
            const pNode = this.graph.currentGeneration.getNode(parentId);
            if (!pNode) return;
            if (pNode.type === 'Feature' || pNode.type === 'Rule') {
                const fr = pNode as any;
                for (const childId of fr.children) {
                    const childNode = this.graph.currentGeneration.getNode(childId);
                    if (childNode) {
                        if (childNode.type === 'Scenario') {
                            if (!affectedScenarios.has(childNode.id)) {
                                affectedScenarios.add(childNode.id);
                                scenarioNodes.push(childNode as ScenarioNode);
                            }
                        } else if (childNode.type === 'Rule') {
                            addScenariosUnder(childNode.id);
                        }
                    }
                }
            }
        };

        for (const usage of usages) {
            let currentId: string | undefined = usage.parent;
            while (currentId) {
                const node = this.graph.currentGeneration.getNode(currentId);
                if (node) {
                    if (node.type === 'Scenario') {
                        if (!affectedScenarios.has(node.id)) {
                            affectedScenarios.add(node.id);
                            scenarioNodes.push(node as ScenarioNode);
                        }
                    } else if (node.type === 'Background') {
                        addScenariosUnder((node as any).parent);
                    } else if (node.type === 'Feature' || node.type === 'Rule') {
                        if (node.type === 'Feature') {
                            affectedFeatures.add(node.id);
                        }
                    }
                    currentId = (node as any).parent;
                } else {
                    break;
                }
            }
        }

        const numScenarios = affectedScenarios.size;
        let severity: ImpactSeverity = 'Low';
        if (numScenarios >= 20) severity = 'High';
        else if (numScenarios >= 5) severity = 'Medium';

        const isAmbiguous = usages.some(u => (u as any).ambiguousCandidates && (u as any).ambiguousCandidates.length > 1);

        const report = {
            affectedFeatures: affectedFeatures.size,
            affectedScenarios: numScenarios,
            severity,
            scenarios: scenarioNodes,
            usages,
            isAmbiguous
        };

        this.cache.set(stepDefId, { version: this.graph.currentGeneration.version, report });
        return report;
    }
}
