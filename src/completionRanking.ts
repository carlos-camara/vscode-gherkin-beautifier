
import { StepDefinition } from './cache';
import { ResourceIdentity } from './utils/resourceIdentity';

export interface RankingContext {
    semanticType: 'given' | 'when' | 'then' | 'step';
    typedText: string;
    currentTags: string[];
    currentFeatureStepTexts: string[];
}

import { WorkspaceGraph, StepDefNode, ScenarioNode } from './graph';

export class CompletionRankingService {
    private recentlyUsed: string[] = [];
    private readonly MAX_RECENT = 20;
    
    constructor(private workspaceGraph: WorkspaceGraph) {}

    public recordCompletion(pattern: string) {
        // Remove if it exists
        this.recentlyUsed = this.recentlyUsed.filter(p => p !== pattern);
        // Add to front
        this.recentlyUsed.unshift(pattern);
        if (this.recentlyUsed.length > this.MAX_RECENT) {
            this.recentlyUsed.pop();
        }
    }

    public scoreItem(def: StepDefinition, context: RankingContext): number {
        let score = 0;
        const pattern = def.rawPattern;

        // 1. Textual Match (15 points if exactly typed prefix)
        if (context.typedText && pattern.startsWith(context.typedText)) {
            score += 15;
        }

        // 2. Semantic Category Match (10 points)
        if (def.type === context.semanticType) {
            score += 10;
        }

        // 3. Recent Usage (Up to 30 points)
        const recentIndex = this.recentlyUsed.indexOf(pattern);
        if (recentIndex !== -1) {
            // 30 for most recent, decreasing
            score += Math.max(1, 30 - recentIndex * 2);
        }

        // To match against the current document steps, we need to strip regex groups from the raw pattern.
        // A simple approximation is just checking if any step text matches the pattern's regex.
        let isUsedInFeature = false;
        
        if (def.regex) {
            // Check Current Feature (20 points)
            for (const text of context.currentFeatureStepTexts) {
                if (def.regex.test(text)) {
                    isUsedInFeature = true;
                    break;
                }
            }
        }

        if (isUsedInFeature) {
            score += 20;
        }

        // Calculate global frequency and tag affinity dynamically from the graph
        let globalFrequency = 0;
        let tagAffinity = 0;

        const defUriStr = ResourceIdentity.getCanonicalUriString(def.uri);
        const defId = `${defUriStr}:${def.decoratorRange.start.line}`;
        const defNode = this.workspaceGraph.currentGeneration.getNode(defId) as StepDefNode | undefined;

        if (defNode) {
            globalFrequency = defNode.usages.length;

            if (context.currentTags.length > 0) {
                // To calculate tag affinity, we evaluate the scenario tags for every usage
                const activeTagsSet = new Set(context.currentTags);
                for (const usageId of defNode.usages) {
                    let currentId: string | undefined = usageId;
                    while (currentId) {
                        const node = this.workspaceGraph.currentGeneration.getNode(currentId);
                        if (!node) break;
                        if (node.type === 'Scenario') {
                            const scNode = node as ScenarioNode;
                            let matches = false;
                            for (const t of scNode.tags) {
                                if (activeTagsSet.has(t)) {
                                    tagAffinity++;
                                    matches = true;
                                }
                            }
                            // Only count each usage once towards affinity, even if multiple tags match
                            if (matches) break;
                        } else if (node.type === 'Background') {
                            currentId = (node as any).parent;
                            continue;
                        }
                        currentId = (node as any).parent;
                    }
                }
            }
        }

        // Global Frequency (up to 10 points)
        // Normalizing arbitrarily (e.g. 5+ uses gives 10 points)
        if (globalFrequency > 0) {
            score += Math.min(10, globalFrequency * 2);
        }

        if (tagAffinity > 0) {
            score += Math.min(15, tagAffinity * 5);
        }

        return score;
    }

    /**
     * Converts a numerical score (higher is better) into a lexicographical string (lower is better for VS Code).
     * e.g., score 100 -> "000_pattern"
     *       score 50  -> "050_pattern"
     */
    public getSortText(score: number, pattern: string): string {
        // Invert the score (assuming max realistic score is ~100)
        // We use 999 - score so higher scores get lower numbers.
        const inverted = Math.max(0, 999 - score);
        const prefix = inverted.toString().padStart(3, '0');
        return `${prefix}_${pattern}`;
    }
}
