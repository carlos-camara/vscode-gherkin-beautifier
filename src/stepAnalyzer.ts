import { WorkspaceGraph, StepNode, StepDefNode } from './graph';
import { SymbolCache } from './cache';

export interface UnusedStep {
    stepDef: StepDefNode;
}

export interface DuplicatedStep {
    pattern: string;
    matcherType: string;
    stepDefs: StepDefNode[];
}

export interface AmbiguousStep {
    step: StepNode;
    matchingDefs: StepDefNode[];
}

export interface SuspiciousSimilarity {
    stepDef1: StepDefNode;
    stepDef2: StepDefNode;
    similarity: number;
}

export interface StepAnalysisResult {
    totalStepDefs: number;
    unusedSteps: UnusedStep[];
    duplicatedSteps: DuplicatedStep[];
    ambiguousSteps: AmbiguousStep[];
    suspiciousSimilarities: SuspiciousSimilarity[];
}

export class StepAnalyzer {
    constructor(private graph: WorkspaceGraph, private symbolCache: SymbolCache) {}

    public async analyze(): Promise<StepAnalysisResult> {
        const stepDefs = this.graph.getAllStepDefNodes();
        const steps = this.graph.getAllStepNodes();

        // 1. Unused steps
        const unusedSteps = stepDefs.filter(d => d.usages.length === 0).map(d => ({ stepDef: d }));

        // 2. Duplicated steps
        const groupedByPattern = new Map<string, StepDefNode[]>();
        for (const def of stepDefs) {
            const key = `${def.matcherType}:${def.pattern}`;
            if (!groupedByPattern.has(key)) groupedByPattern.set(key, []);
            groupedByPattern.get(key)!.push(def);
        }
        const duplicatedSteps: DuplicatedStep[] = [];
        for (const [key, defs] of groupedByPattern.entries()) {
            if (defs.length > 1) {
                const parts = key.split(':', 2);
                duplicatedSteps.push({ matcherType: parts[0], pattern: parts[1], stepDefs: defs });
            }
        }

        // 3. Ambiguous steps
        const ambiguousSteps: AmbiguousStep[] = [];
        for (const step of steps) {
            if (step.text) {
                const matches = await this.symbolCache.getStepDefinitions(step.text);
                if (matches.length > 1) {
                    const matchingDefs = matches.map(m => stepDefs.find(n => n.uri === m.uri.toString() && n.line === m.decoratorRange.start.line)).filter(n => !!n) as StepDefNode[];
                    if (matchingDefs.length > 1) {
                        ambiguousSteps.push({ step, matchingDefs });
                    }
                }
            }
        }

        // 4. Suspicious similarities
        const suspiciousSimilarities: SuspiciousSimilarity[] = [];
        for (let i = 0; i < stepDefs.length; i++) {
            for (let j = i + 1; j < stepDefs.length; j++) {
                const d1 = stepDefs[i];
                const d2 = stepDefs[j];
                if (d1.pattern !== d2.pattern) {
                    const sim = this.calculateSimilarity(d1.pattern, d2.pattern);
                    if (sim > 0.85) {
                        suspiciousSimilarities.push({ stepDef1: d1, stepDef2: d2, similarity: sim });
                    }
                }
            }
        }

        return {
            totalStepDefs: stepDefs.length,
            unusedSteps,
            duplicatedSteps,
            ambiguousSteps,
            suspiciousSimilarities
        };
    }

    private calculateSimilarity(s1: string, s2: string): number {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        if (longer.length === 0) return 1.0;
        const dist = this.levenshtein(longer, shorter);
        return (longer.length - dist) / longer.length;
    }

    private levenshtein(s1: string, s2: string): number {
        const costs = new Array();
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i == 0)
                    costs[j] = j;
                else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) != s2.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue),
                                costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0)
                costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }
}
