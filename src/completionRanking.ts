
import { StepDefinition } from './cache';
import { ResourceIdentity } from './utils/resourceIdentity';

export interface RankingContext {
    semanticType: 'given' | 'when' | 'then' | 'step';
    typedText: string;
    currentTags: string[];
    currentFeatureStepTexts: string[];
}

import { WorkspaceGraph, StepDefNode, ScenarioNode } from './graph';

export enum TextMatchQuality {
    EXACT = 5,
    EXACT_PREFIX = 4,
    TOKEN_PREFIX = 3,
    PARTIAL = 2,
    UNRELATED = 1,
}

export enum SemanticMatchQuality {
    EXACT = 3,
    GENERIC = 2,
    INCOMPATIBLE = 1,
}

export interface RankingScore {
    textMatch: TextMatchQuality;
    semanticMatch: SemanticMatchQuality;
    matcherQuality: number;
    localContext: number;
    historicalUsage: number;
    tagAffinity: number;
    tieBreaker: string;
}

import * as vscode from 'vscode';
export class CompletionRankingService {
    private recentlyUsed: string[] = [];
    private readonly MAX_RECENT = 20;
    private readonly STORAGE_KEY = 'gherkin-powertools.recentCompletions';

    constructor(
        private workspaceGraph: WorkspaceGraph,
        private memento?: vscode.Memento
    ) {
        if (this.memento) {
            const stored = this.memento.get<string[]>(this.STORAGE_KEY, []) || [];
            this.recentlyUsed = this.migrateStoredPatterns(stored);
            if (this.recentlyUsed.length !== stored.length) {
                this.memento.update(this.STORAGE_KEY, this.recentlyUsed);
            }
        }
    }

    private migrateStoredPatterns(stored: string[]): string[] {
        const migrated: string[] = [];
        for (const item of stored) {
            // Check if it's already a new StepDefinitionId (contains colons)
            if (item.includes(':')) {
                migrated.push(item);
                continue;
            }

            // Old rawPattern: try to migrate by querying the graph
            // Best effort: find definitions with this pattern
            const matches = this.workspaceGraph.currentGeneration.getAllStepDefNodes().filter((n: any) => n.pattern === item);

            // If exactly one match, safely migrate. If ambiguous (multiple) or orphaned (0), discard.
            if (matches.length === 1) {
                migrated.push(matches[0].id);
            }
        }
        return migrated;
    }

    public recordCompletion(ids: string | string[]) {
        const idArray = Array.isArray(ids) ? ids : [ids];

        for (const id of idArray) {
            this.recentlyUsed = this.recentlyUsed.filter(p => p !== id);
            this.recentlyUsed.unshift(id);
        }

        // Trim back to MAX_RECENT
        if (this.recentlyUsed.length > this.MAX_RECENT) {
            this.recentlyUsed = this.recentlyUsed.slice(0, this.MAX_RECENT);
        }

        if (this.memento) {
            this.memento.update(this.STORAGE_KEY, this.recentlyUsed);
        }
    }

    private normalizeText(text: string): string {
        return text.trim().toLowerCase().replace(/\s+/g, ' ');
    }

    private calculateTextMatch(typedText: string, pattern: string): TextMatchQuality {
        if (!typedText) return TextMatchQuality.UNRELATED;

        const normTyped = this.normalizeText(typedText);
        const normPattern = this.normalizeText(pattern);

        if (normTyped === normPattern) {
            return TextMatchQuality.EXACT;
        }

        if (normPattern.startsWith(normTyped)) {
            // Check if it's a token boundary or just a substring prefix
            // If the next character in pattern after the match is a space or end of string, it's a token prefix
            // Otherwise it's an exact prefix but maybe mid-word.
            // Actually, EXACT_PREFIX could mean it starts with it precisely. TOKEN_PREFIX could mean partial word.
            // Let's simplify:
            if (normPattern.charAt(normTyped.length) === ' ' || normPattern.charAt(normTyped.length) === '') {
                return TextMatchQuality.EXACT_PREFIX;
            }
            return TextMatchQuality.TOKEN_PREFIX;
        }

        // Partial means it contains the text but not as a prefix
        if (normPattern.includes(normTyped)) {
            return TextMatchQuality.PARTIAL;
        }

        return TextMatchQuality.UNRELATED;
    }

    public scoreItem(def: StepDefinition, context: RankingContext): RankingScore {
        const pattern = def.rawPattern;

        // Tier 1 - Textual Match
        const textMatch = this.calculateTextMatch(context.typedText, pattern);

        // Tier 2 - Semantic Category Match
        let semanticMatch = SemanticMatchQuality.INCOMPATIBLE;
        if (def.type === context.semanticType) {
            semanticMatch = SemanticMatchQuality.EXACT;
        } else if (def.type === 'step') { // generic @step
            semanticMatch = SemanticMatchQuality.GENERIC;
        }

        // Tier 3 - Matcher Quality
        // E.g., plaintext > simple regex > complex regex
        // We'll give higher points to simple strings.
        // A simple proxy is whether it has regex groups or not.
        let matcherQuality = 0;
        if (!pattern.includes('{') && !pattern.includes('(')) {
            matcherQuality = 2; // Plain text
        } else if (pattern.includes('{')) {
            matcherQuality = 1; // Parse expressions
        } else {
            matcherQuality = 0; // Raw regex
        }

        // Tier 4 - Local Project Context
        let localContext = 0;
        let isUsedInFeature = false;
        if (def.regex) {
            for (const text of context.currentFeatureStepTexts) {
                if (def.regex.test(text)) {
                    isUsedInFeature = true;
                    break;
                }
            }
        }
        if (isUsedInFeature) {
            localContext = 2; // High relevance if already used in this feature
        } else {
            // Check folder? For now we just use current feature
            localContext = 0;
        }

        // Tier 5 - Learned Signals (Recent Use, Global Frequency, Tag Affinity)
        let historicalUsage = 0;
        let tagAffinity = 0;
        
        // Recent usage
        const recentIndex = this.recentlyUsed.indexOf(def.id);
        if (recentIndex !== -1) {
            historicalUsage += Math.max(1, 30 - recentIndex * 2);
        }

        const defUriStr = ResourceIdentity.getCanonicalUriString(def.uri);
        const defId = `${defUriStr}:${def.decoratorRange.start.line}`;
        const defNode = this.workspaceGraph.currentGeneration.getNode(defId) as StepDefNode | undefined;

        if (defNode) {
            historicalUsage += Math.min(10, defNode.usages.length * 2);

            if (context.currentTags.length > 0) {
                let currentTagAffinity = 0;
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
                                    currentTagAffinity++;
                                    matches = true;
                                }
                            }
                            if (matches) break;
                        } else if (node.type === 'Background') {
                            currentId = (node as any).parent;
                            continue;
                        }
                        currentId = (node as any).parent;
                    }
                }
                tagAffinity += Math.min(15, currentTagAffinity * 5);
            }
        }

        return {
            textMatch,
            semanticMatch,
            matcherQuality,
            localContext,
            historicalUsage,
            tagAffinity,
            tieBreaker: pattern
        };
    }

    public getSortText(score: RankingScore): string {
        // We invert the numbers so higher quality -> smaller string lexicographically (VS Code sorts A-Z).
        // e.g. textMatch: 5 -> "0", textMatch: 1 -> "4"
        const invert = (val: number, max: number) => Math.max(0, max - val).toString().padStart(2, '0');

        const learnedSignals = score.historicalUsage + score.tagAffinity;

        return [
            invert(score.textMatch, 5),
            invert(score.semanticMatch, 3),
            invert(score.matcherQuality, 2),
            invert(score.localContext, 2),
            invert(learnedSignals, 99),
            score.tieBreaker
        ].join('-');
    }
}
