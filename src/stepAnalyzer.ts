import { WorkspaceGraph, StepNode, StepDefNode } from './graph';
import { ResourceIdentity } from './utils/resourceIdentity';
import { SymbolCache } from './cache';

interface UnusedStep {
    stepDef: StepDefNode;
}

interface DuplicatedStep {
    pattern: string;
    matcherType: string;
    semanticType?: 'given' | 'when' | 'then' | 'step';
    stepDefs: StepDefNode[];
}

interface AmbiguousStep {
    step: StepNode;
    matchingDefs: StepDefNode[];
}

export interface StepAnalysisResult {
    totalStepDefs: number;
    unusedSteps: UnusedStep[];
    duplicatedSteps: DuplicatedStep[];
    ambiguousSteps: AmbiguousStep[];
}

export class StepAnalyzer {
    constructor(private graph: WorkspaceGraph, private symbolCache: SymbolCache) {}

    public async analyze(): Promise<StepAnalysisResult> {
        const stepDefs = this.graph.currentGeneration.getAllStepDefNodes();
        const steps = this.graph.currentGeneration.getAllStepNodes();

        // 1. Unused steps
        const unusedSteps = stepDefs.filter(d => d.usages.length === 0).map(d => ({ stepDef: d }));

        // 2. Duplicated steps
        const groupedByPattern = new Map<string, StepDefNode[]>();
        for (const def of stepDefs) {
            const key = `${def.matcherType}:${def.pattern}:${def.semanticType || ''}`;
            if (!groupedByPattern.has(key)) groupedByPattern.set(key, []);
            groupedByPattern.get(key)!.push(def);
        }
        const duplicatedSteps: DuplicatedStep[] = [];
        for (const [key, defs] of groupedByPattern.entries()) {
            if (defs.length > 1) {
                const parts = key.split(':', 3);
                duplicatedSteps.push({ matcherType: parts[0], pattern: parts[1], semanticType: parts[2] as any, stepDefs: defs });
            }
        }

        // 3. Ambiguous steps
        const ambiguousSteps: AmbiguousStep[] = [];
        for (const step of steps) {
            if (step.text) {
                const matches = await this.symbolCache.getStepDefinitions(step.text, step.semanticType);
                if (matches.length > 1) {
                    const matchingDefs = matches.map(m => stepDefs.find(n => ResourceIdentity.getCanonicalUriString(n.uri) === ResourceIdentity.getCanonicalUriString(m.uri.toString()) && n.line === m.decoratorRange.start.line)).filter(n => !!n) as StepDefNode[];
                    if (matchingDefs.length > 1) {
                        ambiguousSteps.push({ step, matchingDefs });
                    }
                }
            }
        }



        return {
            totalStepDefs: stepDefs.length,
            unusedSteps,
            duplicatedSteps,
            ambiguousSteps
        };
    }

}
