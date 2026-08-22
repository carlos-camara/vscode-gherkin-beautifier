import { WorkspaceGraph, FeatureNode, ScenarioNode, StepNode } from './graph';
import { ProjectHealthMetrics } from './statistics';

type AntiPatternSeverity = 'error' | 'warning' | 'info' | 'hint' | 'off';

export interface AntiPattern {
    id: string;
    title: string;
    explanation: string;
    severity: AntiPatternSeverity;
    affectedFiles: string[]; // Generic fallback
    affectedItems?: { label: string; uri: string; line?: number; description?: string; subItems?: { label: string; uri: string; line?: number }[] }[]; // Detailed actionable items
    suggestedFix: string;
}

interface AntiPatternRule {
    id: string;
    analyze(graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[];
}

class OversizedFeatureRule implements AntiPatternRule {
    id = 'oversized-feature';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off') return [];
        const antiPatterns: AntiPattern[] = [];
        const oversized = metrics.largestFeatures.filter(f => f.size > 50);
        if (oversized.length > 0) {
            antiPatterns.push({
                id: this.id,
                title: 'Oversized Feature',
                explanation: `Found ${oversized.length} feature(s) containing more than 50 steps, which makes them hard to read and maintain. Large features often indicate that too many concerns are mixed into one file.`,
                severity,
                affectedFiles: oversized.map(f => f.uri),
                affectedItems: oversized.map(f => ({
                    label: `${f.name || 'Unnamed'} (${f.size} steps)`,
                    description: `This feature contains ${f.size} steps, which is considered too large (limit is 50).`,
                    uri: f.uri,
                    line: 0
                })),
                suggestedFix: 'Break down these features into multiple smaller, more focused feature files (ideally under 10-15 steps per feature).'
            });
        }
        return antiPatterns;
    }
}

class OversizedScenarioRule implements AntiPatternRule {
    id = 'oversized-scenario';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off') return [];
        const antiPatterns: AntiPattern[] = [];
        const oversized = metrics.largestScenarios.filter(s => s.size > 15);
        if (oversized.length > 0) {
            antiPatterns.push({
                id: this.id,
                title: 'Oversized Scenario',
                explanation: `Found ${oversized.length} scenario(s) containing more than 15 steps. Long scenarios are brittle, hard to debug, and usually violate the single-responsibility principle of BDD.`,
                severity,
                affectedFiles: oversized.map(s => s.uri),
                affectedItems: oversized.map(s => ({
                    label: `${s.name || 'Unnamed'} (${s.size} steps)`,
                    description: `This scenario contains ${s.size} steps, which is considered too large (limit is 15).`,
                    uri: s.uri,
                    line: s.line
                })),
                suggestedFix: 'Split the scenario into multiple independent scenarios or use a Scenario Outline if you are repeating steps with different data.'
            });
        }
        return antiPatterns;
    }
}

class DuplicatedStepsRule implements AntiPatternRule {
    id = 'duplicated-steps';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off') return [];
        const antiPatterns: AntiPattern[] = [];
        for (const dupGroup of metrics.stepAnalysis.duplicatedSteps) {
            antiPatterns.push({
                id: this.id,
                title: `Duplicate Step Definition: ${dupGroup.pattern}`,
                explanation: `The step pattern "${dupGroup.pattern}" is defined in ${dupGroup.stepDefs.length} places. This will cause ambiguous step errors during execution.`,
                severity,
                affectedFiles: Array.from(new Set(dupGroup.stepDefs.map(sd => sd.uri))),
                affectedItems: dupGroup.stepDefs.map(sd => ({
                    label: sd.uri.split('/').pop() + `:${sd.line + 1}`,
                    description: `This step pattern "${dupGroup.pattern}" is defined multiple times.`,
                    uri: sd.uri,
                    line: sd.line + 1
                })),
                suggestedFix: 'Remove or consolidate the duplicate definitions so the pattern is only defined once.'
            });
        }
        return antiPatterns;
    }
}

class UnusedStepsRule implements AntiPatternRule {
    id = 'unused-steps';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off') return [];
        const antiPatterns: AntiPattern[] = [];
        if (metrics.stepAnalysis.unusedSteps.length > 0) {
            antiPatterns.push({
                id: this.id,
                title: 'Unused Step Definitions',
                explanation: `Found ${metrics.stepAnalysis.unusedSteps.length} step definitions that are never used in any feature file. This adds dead code to the project.`,
                severity,
                affectedFiles: Array.from(new Set(metrics.stepAnalysis.unusedSteps.map(u => u.stepDef.uri))),
                affectedItems: metrics.stepAnalysis.unusedSteps.map(u => ({
                    label: u.stepDef.pattern,
                    description: `This step definition is never used in any feature file.`,
                    uri: u.stepDef.uri,
                    line: u.stepDef.line + 1
                })),
                suggestedFix: 'Delete the unused step definitions to keep the codebase clean.'
            });
        }
        return antiPatterns;
    }
}

class AmbiguousStepsRule implements AntiPatternRule {
    id = 'ambiguous-steps';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off' || metrics.stepAnalysis.ambiguousSteps.length === 0) return [];
        return [{
            id: this.id,
            title: 'Ambiguous Steps in Feature Files',
            explanation: `Found ${metrics.stepAnalysis.ambiguousSteps.length} step(s) that match multiple step definitions. This can lead to unpredictable test execution.`,
            severity,
            affectedFiles: [],
            affectedItems: metrics.stepAnalysis.ambiguousSteps.map(a => ({
                label: `Step: ${a.step.keyword} ${a.step.text} (Matches ${a.matchingDefs.length} defs)`,
                uri: a.step.uri,
                line: a.step.line,
                description: 'Matches the following definitions:',
                subItems: a.matchingDefs.map(d => ({
                    label: d.pattern,
                    uri: d.uri,
                    line: d.line + 1
                }))
            })),
            suggestedFix: 'Refine your step definition regex patterns to be more specific, so they do not overlap.'
        }];
    }
}

class UndefinedStepsRule implements AntiPatternRule {
    id = 'undefined-steps';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off' || metrics.undefinedSteps.length === 0) return [];
        return [{
            id: this.id,
            title: 'Undefined Steps',
            explanation: `Found ${metrics.undefinedSteps.length} step(s) that do not match any step definition. These steps will fail during test execution.`,
            severity,
            affectedFiles: Array.from(new Set(metrics.undefinedSteps.map(u => u.uri))),
            affectedItems: metrics.undefinedSteps.map(u => ({
                label: `Step: ${u.keyword} ${u.text}`,
                description: `This step does not match any known step definition.`,
                uri: u.uri,
                line: u.line
            })),
            suggestedFix: 'Implement the missing step definitions in your step files.'
        }];
    }
}

class ExcessiveTagsRule implements AntiPatternRule {
    id = 'excessive-tags';
    analyze(graph: WorkspaceGraph, _metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off') return [];
        const antiPatterns: AntiPattern[] = [];
        const allNodes = graph.currentGeneration.getAllNodes();
        const features = allNodes.filter(n => n.type === 'Feature') as FeatureNode[];
        const scenarios = allNodes.filter(n => n.type === 'Scenario') as ScenarioNode[];
        
        const heavyFeatures = features.filter(f => f.tags.length > 5);
        if (heavyFeatures.length > 0) {
            antiPatterns.push({
                id: this.id,
                title: 'Excessive Tags on Feature',
                explanation: `Found ${heavyFeatures.length} feature(s) with more than 5 tags. Heavy tagging at the feature level is often a sign of over-categorization.`,
                severity,
                affectedFiles: heavyFeatures.map(f => f.uri),
                affectedItems: heavyFeatures.map(f => ({
                    label: `${f.name || 'Unnamed'} (${f.tags.length} tags)`,
                    description: `This feature has ${f.tags.length} tags, which exceeds the recommended limit of 5.`,
                    uri: f.uri,
                    line: f.line
                })),
                suggestedFix: 'Review and consolidate feature tags. Consider grouping related functionality into separate files rather than using tags to differentiate them.'
            });
        }
        
        const heavyScenarios = scenarios.filter(s => s.tags.length > 5);
        if (heavyScenarios.length > 0) {
            antiPatterns.push({
                id: this.id,
                title: 'Excessive Tags on Scenario',
                explanation: `Found ${heavyScenarios.length} scenario(s) with more than 5 tags.`,
                severity,
                affectedFiles: heavyScenarios.map(s => s.uri),
                affectedItems: heavyScenarios.map(s => ({
                    label: `${s.name || 'Unnamed'} (${s.tags.length} tags)`,
                    description: `This scenario has ${s.tags.length} tags, which exceeds the recommended limit of 5.`,
                    uri: s.uri,
                    line: s.line
                })),
                suggestedFix: 'Reduce the number of tags by utilizing Feature-level tags or unifying overlapping tags.'
            });
        }
        return antiPatterns;
    }
}

class PoorMaintainabilityRule implements AntiPatternRule {
    id = 'poor-maintainability';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off') return [];
        if (metrics.scores.maintainability < 60) {
            return [{
                id: this.id,
                title: 'Low Maintainability Score',
                explanation: `The project maintainability score is ${metrics.scores.maintainability}/100. This is typically caused by high numbers of unused, duplicated, or undefined steps.`,
                severity,
                affectedFiles: [],
                suggestedFix: 'Resolve the unused and undefined steps issues to improve maintainability.'
            }];
        }
        return [];
    }
}

class InconsistentFormattingRule implements AntiPatternRule {
    id = 'inconsistent-formatting';
    analyze(graph: WorkspaceGraph, _metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off') return [];
        const antiPatterns: AntiPattern[] = [];
        const allNodes = graph.currentGeneration.getAllNodes();
        const steps = allNodes.filter(n => n.type === 'Step') as StepNode[];
        
        const stepsWithTrailingSpaces = steps.filter(s => s.text.endsWith(' '));
        if (stepsWithTrailingSpaces.length > 0) {
            const uris = Array.from(new Set(stepsWithTrailingSpaces.map(s => s.uri)));
            antiPatterns.push({
                id: this.id,
                title: 'Inconsistent Formatting: Trailing Spaces',
                explanation: `Found ${stepsWithTrailingSpaces.length} step(s) with trailing spaces. This can cause parsing issues or mismatch with step definitions.`,
                severity,
                affectedFiles: uris,
                suggestedFix: 'Format the Gherkin documents to remove trailing whitespaces.'
            });
        }
        return antiPatterns;
    }
}

class SyntaxErrorsRule implements AntiPatternRule {
    id = 'syntax-errors';
    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off' || !metrics.parseErrors || metrics.parseErrors.length === 0) return [];
        
        const antiPatterns: AntiPattern[] = [];
        
        for (const fileErrors of metrics.parseErrors) {
            if (fileErrors.errors.length > 0) {
                antiPatterns.push({
                    id: this.id,
                    title: `Syntax Error`,
                    explanation: `Found ${fileErrors.errors.length} parsing error(s). Gherkin structure is compromised.`,
                    severity,
                    affectedFiles: [fileErrors.uri],
                    affectedItems: fileErrors.errors.map((e: any) => ({
                        label: e.message || 'Syntax Error',
                        uri: fileErrors.uri,
                        line: e.line ? e.line - 1 : 0
                    })),
                    suggestedFix: 'Fix the Gherkin syntax errors highlighted in the file to allow proper parsing and validation.'
                });
            }
        }
        
        return antiPatterns;
    }
}

export class AntiPatternEngine {
    private rules: AntiPatternRule[] = [];

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
        this.registerRule(new SyntaxErrorsRule());
    }

    registerRule(rule: AntiPatternRule) {
        this.rules.push(rule);
    }

    generateAntiPatterns(graph: WorkspaceGraph, metrics: ProjectHealthMetrics, ruleConfig: Record<string, string>): AntiPattern[] {
        const antiPatterns: AntiPattern[] = [];
        for (const rule of this.rules) {
            const configuredSeverity = (ruleConfig[rule.id] as AntiPatternSeverity) || 'warning';
            antiPatterns.push(...rule.analyze(graph, metrics, configuredSeverity));
        }
        
        const severityOrder = { 'error': 4, 'warning': 3, 'info': 2, 'hint': 1, 'off': 0 };
        return antiPatterns.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
    }
}
