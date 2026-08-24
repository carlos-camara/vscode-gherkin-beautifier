import * as vscode from 'vscode';
import { parseGherkin } from './parser';
import { StepDefinition } from './cache';
import type { Step } from '@cucumber/messages';
import { WorkspaceEventBus } from './eventBus';
import { featureDiscoveryService } from './featureDiscovery';

import { ResourceIdentity } from './utils/resourceIdentity';

export interface RankingContext {
    semanticType: 'given' | 'when' | 'then' | 'step';
    typedText: string;
    currentTags: string[];
    currentFeatureStepTexts: string[];
}

export interface FeatureSnapshot {
    uri: string;
    status: 'success' | 'failure';
    stepFrequencies: Map<string, number>;
    stepTagAffinities: Map<string, Set<string>>;
}

export class UsageIndexer {
    private globalStepFrequencies = new Map<string, number>();
    private globalStepTagAffinities = new Map<string, Map<string, number>>();
    private snapshots = new Map<string, FeatureSnapshot>();
    private isIndexed = false;
    private eventBusDisposable?: vscode.Disposable;

    public setEventBus(eventBus: WorkspaceEventBus) {
        this.eventBusDisposable?.dispose();
        this.eventBusDisposable = eventBus.onEvent(e => {
            if (e.type === 'featureFileChanged' || e.type === 'featureFileCreated') {
                this.indexFile(e.uri);
            } else if (e.type === 'featureFileDeleted') {
                this.removeSnapshot(ResourceIdentity.getCanonicalUriString(e.uri));
            } else if (e.type === 'configurationChanged') {
                this.reindexAll();
            }
        });
    }

    private async reindexAll() {
        this.snapshots.clear();
        this.globalStepFrequencies.clear();
        this.globalStepTagAffinities.clear();
        this.isIndexed = false;
        await this.indexWorkspace();
    }

    public async indexWorkspace() {
        if (this.isIndexed) return;
        this.isIndexed = true;
        
        try {
            const files = await featureDiscoveryService.getFeatureFiles();
            await Promise.all(files.map(uri => this.indexFile(uri)));
        } catch (e) {
            console.error('Failed to index workspace for completion ranking', e);
        }
    }

    private removeSnapshot(canonicalUri: string) {
        const oldSnapshot = this.snapshots.get(canonicalUri);
        if (!oldSnapshot) return;

        // Subtract frequencies
        for (const [text, freq] of oldSnapshot.stepFrequencies.entries()) {
            const current = this.globalStepFrequencies.get(text) || 0;
            const next = current - freq;
            if (next <= 0) {
                this.globalStepFrequencies.delete(text);
            } else {
                this.globalStepFrequencies.set(text, next);
            }
        }

        // Subtract tag affinities
        for (const [text, tags] of oldSnapshot.stepTagAffinities.entries()) {
            const tagMap = this.globalStepTagAffinities.get(text);
            if (tagMap) {
                for (const tag of tags) {
                    const currentCount = tagMap.get(tag) || 0;
                    const nextCount = currentCount - 1;
                    if (nextCount <= 0) {
                        tagMap.delete(tag);
                    } else {
                        tagMap.set(tag, nextCount);
                    }
                }
                if (tagMap.size === 0) {
                    this.globalStepTagAffinities.delete(text);
                }
            }
        }

        this.snapshots.delete(canonicalUri);
    }

    private applySnapshot(newSnapshot: FeatureSnapshot) {
        this.removeSnapshot(newSnapshot.uri);

        // Add frequencies
        for (const [text, freq] of newSnapshot.stepFrequencies.entries()) {
            const current = this.globalStepFrequencies.get(text) || 0;
            this.globalStepFrequencies.set(text, current + freq);
        }

        // Add tag affinities
        for (const [text, tags] of newSnapshot.stepTagAffinities.entries()) {
            let tagMap = this.globalStepTagAffinities.get(text);
            if (!tagMap) {
                tagMap = new Map<string, number>();
                this.globalStepTagAffinities.set(text, tagMap);
            }
            for (const tag of tags) {
                const currentCount = tagMap.get(tag) || 0;
                tagMap.set(tag, currentCount + 1);
            }
        }

        this.snapshots.set(newSnapshot.uri, newSnapshot);
    }

    // Exported for invariant testing
    public async indexFile(uri: vscode.Uri) {
        const canonicalUri = ResourceIdentity.getCanonicalUriString(uri);
        
        try {
            let content = '';
            const openDoc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
            if (openDoc) {
                content = openDoc.getText();
            } else {
                const rawBytes = await vscode.workspace.fs.readFile(uri);
                content = new TextDecoder('utf8').decode(rawBytes);
            }

            const { document } = await parseGherkin(content);

            if (!document || !document.feature) {
                return; // Parsing failure: keep last known good snapshot
            }
            
            const featureTags = document.feature.tags.map(t => t.name);
            const snapshot: FeatureSnapshot = {
                uri: canonicalUri,
                status: 'success',
                stepFrequencies: new Map(),
                stepTagAffinities: new Map()
            };

            const processSteps = (steps: readonly Step[], tags: string[]) => {
                for (const step of steps) {
                    const text = step.text.trim();
                    snapshot.stepFrequencies.set(text, (snapshot.stepFrequencies.get(text) || 0) + 1);
                    
                    if (!snapshot.stepTagAffinities.has(text)) {
                        snapshot.stepTagAffinities.set(text, new Set());
                    }
                    const affinitySet = snapshot.stepTagAffinities.get(text)!;
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

            this.applySnapshot(snapshot);
        } catch (e) {
            // ignore indexing failures
        }
    }

    public getFrequency(stepText: string): number {
        return this.globalStepFrequencies.get(stepText) || 0;
    }

    public getTagAffinity(stepText: string, activeTags: string[]): number {
        const tagMap = this.globalStepTagAffinities.get(stepText);
        if (!tagMap || activeTags.length === 0) return 0;
        
        let matchCount = 0;
        for (const tag of activeTags) {
            if (tagMap.has(tag)) matchCount++;
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
