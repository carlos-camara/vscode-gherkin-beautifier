import { WorkspaceGraph, FeatureNode, ScenarioNode, StepNode } from './graph';
import { ProjectHealthMetrics } from './statistics';

export type RecommendationSeverity = 'low' | 'medium' | 'high';

export interface Recommendation {
    title: string;
    explanation: string;
    severity: RecommendationSeverity;
    affectedFiles: string[]; // Generic fallback
    affectedItems?: { label: string; uri: string; line?: number }[]; // Detailed actionable items
    suggestedFix: string;
}

export interface RecommendationRule {
    id: string;
    analyze(graph: WorkspaceGraph, metrics: ProjectHealthMetrics): Recommendation[];
}

export class OversizedFeatureRule implements RecommendationRule {
    id = 'oversized-feature';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics): Recommendation[] {
        const recommendations: Recommendation[] = [];
        for (const feature of metrics.largestFeatures) {
            if (feature.size > 20) {
                recommendations.push({
                    title: `Oversized Feature: ${feature.name}`,
                    explanation: `This feature contains ${feature.size} steps, which makes it hard to read and maintain. Large features often indicate that too many concerns are mixed into one file.`,
                    severity: 'medium',
                    affectedFiles: [feature.uri],
                    suggestedFix: 'Split the feature into multiple, smaller feature files focused on specific business capabilities.'
                });
            }
        }
        return recommendations;
    }
}

export class OversizedScenarioRule implements RecommendationRule {
    id = 'oversized-scenario';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics): Recommendation[] {
        const recommendations: Recommendation[] = [];
        for (const scenario of metrics.largestScenarios) {
            if (scenario.size > 10) {
                recommendations.push({
                    title: `Oversized Scenario: ${scenario.name || 'Unnamed'}`,
                    explanation: `This scenario contains ${scenario.size} steps. Long scenarios are harder to understand, debug, and maintain.`,
                    severity: 'high',
                    affectedFiles: [scenario.uri],
                    suggestedFix: 'Refactor the scenario by using Background steps for common setup, extracting reusable logic into higher-level step definitions, or splitting the scenario.'
                });
            }
        }
        return recommendations;
    }
}

export class DuplicatedStepsRule implements RecommendationRule {
    id = 'duplicated-steps';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics): Recommendation[] {
        if (metrics.stepAnalysis.duplicatedSteps.length === 0) return [];
        return [{
            title: 'Duplicated Step Definitions',
            explanation: `Found ${metrics.stepAnalysis.duplicatedSteps.length} step definition(s) that share identical regex patterns, causing conflicts during execution.`,
            severity: 'high',
            affectedFiles: [],
            affectedItems: metrics.stepAnalysis.duplicatedSteps.flatMap(d => d.stepDefs.map(sd => ({
                label: `Duplicated pattern: ${d.pattern}`,
                uri: sd.uri,
                line: sd.line
            }))),
            suggestedFix: 'Remove or consolidate the duplicate step definitions. Ensure pattern uniqueness.'
        }];
    }
}

export class UnusedStepsRule implements RecommendationRule {
    id = 'unused-steps';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics): Recommendation[] {
        if (metrics.stepAnalysis.unusedSteps.length === 0) return [];
        return [{
            title: 'Unused Step Definitions',
            explanation: `Found ${metrics.stepAnalysis.unusedSteps.length} step definition(s) that are never used in any feature file. This bloats the codebase and increases maintenance cost.`,
            severity: 'low',
            affectedFiles: [],
            affectedItems: metrics.stepAnalysis.unusedSteps.map(u => ({
                label: u.stepDef.pattern,
                uri: u.stepDef.uri,
                line: u.stepDef.line
            })),
            suggestedFix: 'Delete the unused step definitions or verify if they are meant to be used in upcoming features.'
        }];
    }
}

export class AmbiguousStepsRule implements RecommendationRule {
    id = 'ambiguous-steps';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics): Recommendation[] {
        if (metrics.stepAnalysis.ambiguousSteps.length === 0) return [];
        return [{
            title: 'Ambiguous Steps in Feature Files',
            explanation: `Found ${metrics.stepAnalysis.ambiguousSteps.length} step(s) that match multiple step definitions. This can lead to unpredictable test execution.`,
            severity: 'high',
            affectedFiles: [],
            affectedItems: metrics.stepAnalysis.ambiguousSteps.map(a => ({
                label: `Step: ${a.step.keyword} ${a.step.text} (Matches ${a.matchingDefs.length} defs)`,
                uri: a.step.uri,
                line: a.step.line
            })),
            suggestedFix: 'Refine your step definition regex patterns to be more specific, so they do not overlap.'
        }];
    }
}

export class UndefinedStepsRule implements RecommendationRule {
    id = 'undefined-steps';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics): Recommendation[] {
        if (metrics.undefinedSteps.length === 0) return [];
        return [{
            title: 'Undefined Steps',
            explanation: `Found ${metrics.undefinedSteps.length} step(s) that do not match any step definition. These steps will fail during test execution.`,
            severity: 'high',
            affectedFiles: [],
            affectedItems: metrics.undefinedSteps.map(u => ({
                label: `Step: ${u.keyword} ${u.text}`,
                uri: u.uri,
                line: u.line
            })),
            suggestedFix: 'Implement the missing step definitions using the "Create Step Definition" command.'
        }];
    }
}

export class ExcessiveTagsRule implements RecommendationRule {
    id = 'excessive-tags';
    analyze(graph: WorkspaceGraph, _metrics: ProjectHealthMetrics): Recommendation[] {
        const recommendations: Recommendation[] = [];
        const allNodes = graph.getAllNodes();
        const features = allNodes.filter(n => n.type === 'Feature') as FeatureNode[];
        const scenarios = allNodes.filter(n => n.type === 'Scenario') as ScenarioNode[];
        
        for (const feature of features) {
            if (feature.tags.length > 5) {
                recommendations.push({
                    title: `Excessive Tags on Feature: ${feature.name}`,
                    explanation: `This feature has ${feature.tags.length} tags. Too many tags can make execution filtering confusing and indicates poor tag taxonomy.`,
                    severity: 'low',
                    affectedFiles: [feature.uri],
                    suggestedFix: 'Review and consolidate tags. Group related tags or remove obsolete ones.'
                });
            }
        }
        
        for (const scenario of scenarios) {
            if (scenario.tags.length > 5) {
                recommendations.push({
                    title: `Excessive Tags on Scenario: ${scenario.name || 'Unnamed'}`,
                    explanation: `This scenario has ${scenario.tags.length} tags.`,
                    severity: 'low',
                    affectedFiles: [scenario.uri],
                    suggestedFix: 'Reduce the number of tags by utilizing Feature-level tags or unifying overlapping tags.'
                });
            }
        }
        return recommendations;
    }
}

export class PoorMaintainabilityRule implements RecommendationRule {
    id = 'poor-maintainability';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics): Recommendation[] {
        if (metrics.scores.maintainability < 60) {
            return [{
                title: 'Poor Project Maintainability',
                explanation: `The project maintainability score is ${metrics.scores.maintainability}/100. This is typically caused by high numbers of unused, duplicated, or undefined steps.`,
                severity: 'medium',
                affectedFiles: [],
                suggestedFix: 'Focus on cleaning up the step definition library and implementing missing steps to improve the score.'
            }];
        }
        return [];
    }
}

export class InconsistentFormattingRule implements RecommendationRule {
    id = 'inconsistent-formatting';
    analyze(graph: WorkspaceGraph, _metrics: ProjectHealthMetrics): Recommendation[] {
        const recommendations: Recommendation[] = [];
        const allNodes = graph.getAllNodes();
        const steps = allNodes.filter(n => n.type === 'Step') as StepNode[];
        
        const stepsWithTrailingSpaces = steps.filter(s => s.text.endsWith(' '));
        if (stepsWithTrailingSpaces.length > 0) {
            const uris = Array.from(new Set(stepsWithTrailingSpaces.map(s => s.uri)));
            recommendations.push({
                title: 'Inconsistent Formatting: Trailing Spaces',
                explanation: `Found ${stepsWithTrailingSpaces.length} step(s) with trailing spaces. This can cause parsing issues or mismatch with step definitions.`,
                severity: 'low',
                affectedFiles: uris,
                suggestedFix: 'Format the Gherkin documents to remove trailing whitespaces.'
            });
        }
        return recommendations;
    }
}

export class RecommendationEngine {
    private rules: RecommendationRule[] = [];

    constructor() {
        this.registerRule(new OversizedFeatureRule());
        this.registerRule(new OversizedScenarioRule());
        this.registerRule(new DuplicatedStepsRule());
        this.registerRule(new UnusedStepsRule());
        this.registerRule(new AmbiguousStepsRule());
        this.registerRule(new UndefinedStepsRule());
        this.registerRule(new ExcessiveTagsRule());
        this.registerRule(new PoorMaintainabilityRule());
        this.registerRule(new InconsistentFormattingRule());
    }

    registerRule(rule: RecommendationRule) {
        this.rules.push(rule);
    }

    generateRecommendations(graph: WorkspaceGraph, metrics: ProjectHealthMetrics): Recommendation[] {
        const recommendations: Recommendation[] = [];
        for (const rule of this.rules) {
            recommendations.push(...rule.analyze(graph, metrics));
        }
        
        const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return recommendations.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
    }
}


