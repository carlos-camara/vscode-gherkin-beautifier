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
        const groupedByMatcher = new Map<string, Map<string, Map<string, StepDefNode[]>>>();

        for (const def of stepDefs) {
            const matcherType = def.matcherType;
            const pattern = def.pattern;
            const semanticType = def.semanticType || '';

            if (!groupedByMatcher.has(matcherType)) groupedByMatcher.set(matcherType, new Map());
            const byPattern = groupedByMatcher.get(matcherType)!;

            if (!byPattern.has(pattern)) byPattern.set(pattern, new Map());
            const bySemanticType = byPattern.get(pattern)!;

            if (!bySemanticType.has(semanticType)) bySemanticType.set(semanticType, []);
            bySemanticType.get(semanticType)!.push(def);
        }

        const duplicatedSteps: DuplicatedStep[] = [];
        for (const [matcherType, byPattern] of groupedByMatcher.entries()) {
            for (const [pattern, bySemanticType] of byPattern.entries()) {
                for (const [semanticType, defs] of bySemanticType.entries()) {
                    if (defs.length > 1) {
                        duplicatedSteps.push({
                            matcherType,
                            pattern,
                            semanticType: semanticType ? (semanticType as 'given' | 'when' | 'then' | 'step') : undefined,
                            stepDefs: defs
                        });
                    }
                }
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
