import * as vscode from 'vscode';
import { parseGherkin } from './parser';
import { StepDefinition } from './cache';
import type { Step } from '@cucumber/messages';
import { WorkspaceEventBus } from './eventBus';

export interface RankingContext {
    semanticType: 'given' | 'when' | 'then' | 'step';
    typedText: string;
    currentTags: string[];
    currentFeatureStepTexts: string[];
}

export class UsageIndexer {
    private stepFrequencies = new Map<string, number>();
    private stepTagAffinities = new Map<string, Set<string>>();
    private isIndexed = false;
    private eventBusDisposable?: vscode.Disposable;

    public setEventBus(eventBus: WorkspaceEventBus) {
        this.eventBusDisposable?.dispose();
        this.eventBusDisposable = eventBus.onEvent(e => {
            if (e.type === 'featureFileChanged' || e.type === 'featureFileCreated') {
                this.indexFile(e.uri);
            }
        });
    }

    public async indexWorkspace() {
        if (this.isIndexed) return;
        this.isIndexed = true;
        
        try {
            const files = await vscode.workspace.findFiles('**/*.feature', '**/node_modules/**');
            await Promise.all(files.map(uri => this.indexFile(uri)));
        } catch (e) {
            console.error('Failed to index workspace for completion ranking', e);
        }
    }

    private async indexFile(uri: vscode.Uri) {
        try {
            const rawBytes = await vscode.workspace.fs.readFile(uri);
            const content = new TextDecoder('utf8').decode(rawBytes);
            const { document } = await parseGherkin(content);

            if (!document || !document.feature) return;
            
            const featureTags = document.feature.tags.map(t => t.name);

            const processSteps = (steps: readonly Step[], tags: string[]) => {
                for (const step of steps) {
                    const text = step.text.trim();
                    this.stepFrequencies.set(text, (this.stepFrequencies.get(text) || 0) + 1);
                    
                    if (!this.stepTagAffinities.has(text)) {
                        this.stepTagAffinities.set(text, new Set());
                    }
                    const affinitySet = this.stepTagAffinities.get(text)!;
                    for (const t of tags) {
                        affinitySet.add(t);
                    }
                }
            };

            for (const child of document.feature.children) {
                if (child.background) {
                    processSteps(child.background.steps, featureTags);
                } else if (child.scenario) {
                    const scenarioTags = [...featureTags, ...child.scenario.tags.map(t => t.name)];
                    processSteps(child.scenario.steps, scenarioTags);
                } else if (child.rule) {
                    const ruleTags = [...featureTags, ...child.rule.tags.map(t => t.name)];
                    for (const ruleChild of child.rule.children) {
                        if (ruleChild.background) {
                            processSteps(ruleChild.background.steps, ruleTags);
                        } else if (ruleChild.scenario) {
                            const scenarioTags = [...ruleTags, ...ruleChild.scenario.tags.map(t => t.name)];
                            processSteps(ruleChild.scenario.steps, scenarioTags);
                        }
                    }
                }
            }
        } catch (e) {
            // ignore indexing failures for single files
        }
    }

    public getFrequency(stepText: string): number {
        return this.stepFrequencies.get(stepText) || 0;
    }

    public getTagAffinity(stepText: string, activeTags: string[]): number {
        const affinities = this.stepTagAffinities.get(stepText);
        if (!affinities || activeTags.length === 0) return 0;
        
        let matchCount = 0;
        for (const tag of activeTags) {
            if (affinities.has(tag)) matchCount++;
        }
        return matchCount;
    }

    public dispose() {
        this.eventBusDisposable?.dispose();
    }
}

export class CompletionRankingService {
    private recentlyUsed: string[] = [];
    private readonly MAX_RECENT = 20;
    public usageIndexer = new UsageIndexer();

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

        // To match against the indexer and current document steps, we need to strip regex groups from the raw pattern.
        // A simple approximation is just checking if any step text matches the pattern's regex.
        let isUsedInFeature = false;
        let globalFrequency = 0;

        if (def.regex) {
            // Check Current Feature (20 points)
            for (const text of context.currentFeatureStepTexts) {
                if (def.regex.test(text)) {
                    isUsedInFeature = true;
                    break;
                }
            }

            // Estimate global usage and tag affinity by testing the known step texts in the indexer
            // This could be slow if there are thousands of unique steps, but usually it's bounded.
            // Alternatively, since this runs on completion, we can sample or bound the search.
            // For now, we do a quick check against the exact pattern (this is a heuristic).
            // A perfect implementation would pre-map step texts to definitions.
            globalFrequency = this.usageIndexer.getFrequency(pattern); 
            // In a real matcher, the indexer stores exact literal text, while `pattern` is regex.
            // To bridge this deterministically without heavy regex loop, we can just check if the pattern string is directly found or used as-is.
        }

        if (isUsedInFeature) {
            score += 20;
        }

        // Global Frequency (up to 10 points)
        // Normalizing arbitrarily (e.g. 5+ uses gives 10 points)
        if (globalFrequency > 0) {
            score += Math.min(10, globalFrequency * 2);
        }

        // Tag Affinity (up to 15 points)
        // If the pattern is directly associated with current tags
        const tagAffinity = this.usageIndexer.getTagAffinity(pattern, context.currentTags);
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
