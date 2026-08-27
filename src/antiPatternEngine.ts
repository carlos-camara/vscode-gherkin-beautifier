import { WorkspaceGraph, FeatureNode, ScenarioNode, StepNode, StepDefNode } from './graph';
import { ProjectHealthMetrics } from './statistics';

type AntiPatternSeverity = 'error' | 'warning' | 'info' | 'hint' | 'off';
type AntiPatternCategory = 'Correctness' | 'Reliability' | 'Maintainability' | 'Style';

interface RuleMetadata<T = any> {
    id: string;
    title: string;
    category: AntiPatternCategory;
    rationale: string;
    defaultSeverity: AntiPatternSeverity;
    defaultParams?: T;
}

export interface AntiPattern {
    id: string;
    title: string;
    category: AntiPatternCategory;
    explanation: string;
    rationale: string;
    severity: AntiPatternSeverity;
    affectedFiles: string[];
    affectedItems?: { label: string; uri: string; line?: number; description?: string; subItems?: { label: string; uri: string; line?: number }[]; scopeType?: 'feature' | 'scenario' | 'step'; scopeValue?: string; }[];
    suggestedFix: string;
}

interface AntiPatternRule<T = any> {
    metadata: RuleMetadata<T>;
    analyze(graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity, params?: T): AntiPattern[];
}

interface OversizedFeatureParams { maxSteps: number; }
class OversizedFeatureRule implements AntiPatternRule<OversizedFeatureParams> {
    metadata: RuleMetadata<OversizedFeatureParams> = {
        id: 'oversized-feature',
        title: 'Oversized Feature',
        category: 'Maintainability',
        rationale: 'Large features often indicate that too many concerns are mixed into one file, making them hard to read and maintain.',
        defaultSeverity: 'info',
        defaultParams: { maxSteps: 50 }
    };

    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity, params?: OversizedFeatureParams): AntiPattern[] {
        if (severity === 'off') return [];
        const limit = params?.maxSteps ?? this.metadata.defaultParams!.maxSteps;
        const antiPatterns: AntiPattern[] = [];
        const oversized = metrics.largestFeatures.filter(f => f.size > limit);
        if (oversized.length > 0) {
            antiPatterns.push({
                id: this.metadata.id,
                title: this.metadata.title,
                category: this.metadata.category,
                rationale: this.metadata.rationale,
                explanation: `Found ${oversized.length} feature(s) containing more than ${limit} steps.`,
                severity,
                affectedFiles: oversized.map(f => f.uri),
                affectedItems: oversized.map(f => ({
                    label: `${f.name || 'Unnamed'} (${f.size} steps)`,
                    description: `This feature contains ${f.size} steps, exceeding the threshold of ${limit}.`,
                    uri: f.uri,
                    line: 0,
                    scopeType: 'feature',
                    scopeValue: f.name || 'Unnamed'
                })),
                suggestedFix: 'Break down these features into multiple smaller, more focused feature files.'
            });
        }
        return antiPatterns;
    }
}

interface OversizedScenarioParams { maxSteps: number; }
class OversizedScenarioRule implements AntiPatternRule<OversizedScenarioParams> {
    metadata: RuleMetadata<OversizedScenarioParams> = {
        id: 'oversized-scenario',
        title: 'Oversized Scenario',
        category: 'Reliability',
        rationale: 'Long scenarios test too many behaviors, making them brittle and harder to debug when they fail.',
        defaultSeverity: 'warning',
        defaultParams: { maxSteps: 15 }
    };

    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity, params?: OversizedScenarioParams): AntiPattern[] {
        if (severity === 'off') return [];
        const limit = params?.maxSteps ?? this.metadata.defaultParams!.maxSteps;
        const antiPatterns: AntiPattern[] = [];
        const oversized = metrics.largestScenarios.filter(s => s.size > limit);
        if (oversized.length > 0) {
            antiPatterns.push({
                id: this.metadata.id,
                title: this.metadata.title,
                category: this.metadata.category,
                rationale: this.metadata.rationale,
                explanation: `Found ${oversized.length} scenario(s) containing more than ${limit} steps.`,
                severity,
                affectedFiles: oversized.map(s => s.uri),
                affectedItems: oversized.map(s => ({
                    label: `${s.name || 'Unnamed'} (${s.size} steps)`,
                    description: `This scenario contains ${s.size} steps, exceeding the threshold of ${limit}.`,
                    uri: s.uri,
                    line: s.line,
                    scopeType: 'scenario',
                    scopeValue: s.name || 'Unnamed'
                })),
                suggestedFix: 'Split the scenario into multiple independent scenarios or use a Scenario Outline if you are repeating steps with different data.'
            });
        }
        return antiPatterns;
    }
}

class DuplicatedStepsRule implements AntiPatternRule {
    metadata: RuleMetadata = {
        id: 'duplicated-steps',
        title: 'Duplicate Step Definition',
        category: 'Correctness',
        rationale: 'Multiple step definitions matching the same pattern will cause ambiguous step errors during execution.',
        defaultSeverity: 'error'
    };

    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off') return [];
        const antiPatterns: AntiPattern[] = [];
        for (const dupGroup of metrics.stepAnalysis.duplicatedSteps) {
            antiPatterns.push({
                id: this.metadata.id,
                title: `${this.metadata.title}: ${dupGroup.pattern}`,
                category: this.metadata.category,
                rationale: this.metadata.rationale,
                explanation: `The step pattern "${dupGroup.pattern}" is defined in ${dupGroup.stepDefs.length} places.`,
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
    metadata: RuleMetadata = {
        id: 'unused-steps',
        title: 'Unused Step Definitions',
        category: 'Maintainability',
        rationale: 'Step definitions that are never used add dead code to the project and increase maintenance overhead.',
        defaultSeverity: 'info'
    };

    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off') return [];
        const antiPatterns: AntiPattern[] = [];
        if (metrics.stepAnalysis.unusedSteps.length > 0) {
            antiPatterns.push({
                id: this.metadata.id,
                title: this.metadata.title,
                category: this.metadata.category,
                rationale: this.metadata.rationale,
                explanation: `Found ${metrics.stepAnalysis.unusedSteps.length} step definition(s) that are never used in any feature file.`,
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
    metadata: RuleMetadata = {
        id: 'ambiguous-step',
        title: 'Ambiguous Steps in Feature Files',
        category: 'Correctness',
        rationale: 'Steps matching multiple step definitions lead to unpredictable test execution.',
        defaultSeverity: 'error'
    };

    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off' || metrics.stepAnalysis.ambiguousSteps.length === 0) return [];
        return [{
            id: this.metadata.id,
            title: this.metadata.title,
            category: this.metadata.category,
            rationale: this.metadata.rationale,
            explanation: `Found ${metrics.stepAnalysis.ambiguousSteps.length} step(s) that match multiple step definitions.`,
            severity,
            affectedFiles: [],
            affectedItems: metrics.stepAnalysis.ambiguousSteps.map(a => ({
                label: `Step: ${a.step.keyword} ${a.step.text} (Matches ${a.matchingDefs.length} defs)`,
                uri: a.step.uri,
                line: a.step.line,
                scopeType: 'step',
                scopeValue: a.step.text,
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

class AmbiguousStepDefinitionsRule implements AntiPatternRule {
    metadata: RuleMetadata = {
        id: 'ambiguous-step-definition',
        title: 'Ambiguous Step Definition',
        category: 'Correctness',
        rationale: 'This step definition overlaps with others, causing ambiguous matches during execution.',
        defaultSeverity: 'error'
    };

    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off' || metrics.stepAnalysis.ambiguousSteps.length === 0) return [];
        
        const defCollisions = new Map<StepDefNode, Set<StepDefNode>>();
        const defToSteps = new Map<StepDefNode, Set<string>>();

        for (const a of metrics.stepAnalysis.ambiguousSteps) {
            for (const def of a.matchingDefs) {
                if (!defCollisions.has(def)) defCollisions.set(def, new Set());
                if (!defToSteps.has(def)) defToSteps.set(def, new Set());
                
                defToSteps.get(def)!.add(a.step.text);

                for (const other of a.matchingDefs) {
                    if (other !== def) {
                        defCollisions.get(def)!.add(other);
                    }
                }
            }
        }

        const antiPatterns: AntiPattern[] = [];
        for (const [def, others] of defCollisions.entries()) {
            const steps = Array.from(defToSteps.get(def)!);
            const otherList = Array.from(others);
            
            const stepExamples = steps.slice(0, 3).map(s => `"${s}"`).join(', ') + (steps.length > 3 ? '...' : '');
            
            const explanation = `This step definition is ambiguous because it matches step(s) (e.g. ${stepExamples}) that are also matched by:\n` + 
                otherList.map(o => `- ${o.uri.split('/').pop()}:${o.line + 1} (${o.pattern})`).join('\n');

            antiPatterns.push({
                id: this.metadata.id,
                title: this.metadata.title,
                category: this.metadata.category,
                rationale: this.metadata.rationale,
                explanation: explanation,
                severity,
                affectedFiles: [def.uri],
                affectedItems: [{
                    label: def.pattern,
                    description: `Collides with ${others.size} other definition(s):`,
                    uri: def.uri,
                    line: def.line + 1,
                    scopeType: 'step',
                    scopeValue: def.pattern,
                    subItems: otherList.map(o => ({
                        label: o.pattern,
                        uri: o.uri,
                        line: o.line + 1
                    }))
                }],
                suggestedFix: 'Refine the regex pattern to be more specific and avoid overlapping with other step definitions.'
            });
        }
        return antiPatterns;
    }
}

class UndefinedStepsRule implements AntiPatternRule {
    metadata: RuleMetadata = {
        id: 'undefined-steps',
        title: 'Undefined Steps',
        category: 'Correctness',
        rationale: 'Steps without a matching definition will fail during test execution.',
        defaultSeverity: 'error'
    };

    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off' || metrics.undefinedSteps.length === 0) return [];
        return [{
            id: this.metadata.id,
            title: this.metadata.title,
            category: this.metadata.category,
            rationale: this.metadata.rationale,
            explanation: `Found ${metrics.undefinedSteps.length} step(s) that do not match any step definition.`,
            severity,
            affectedFiles: Array.from(new Set(metrics.undefinedSteps.map(u => u.uri))),
            affectedItems: metrics.undefinedSteps.map(u => ({
                label: `Step: ${u.keyword} ${u.text}`,
                description: `This step does not match any known step definition.`,
                uri: u.uri,
                line: u.line,
                scopeType: 'step',
                scopeValue: u.text
            })),
            suggestedFix: 'Implement the missing step definitions in your step files.'
        }];
    }
}

interface ExcessiveTagsParams { maxFeatureTags: number; maxScenarioTags: number; }
class ExcessiveTagsRule implements AntiPatternRule<ExcessiveTagsParams> {
    metadata: RuleMetadata<ExcessiveTagsParams> = {
        id: 'excessive-tags',
        title: 'Excessive Tags',
        category: 'Style',
        rationale: 'Heavy tagging is often a sign of over-categorization, which clutters the test suite and makes execution filtering difficult.',
        defaultSeverity: 'hint',
        defaultParams: { maxFeatureTags: 5, maxScenarioTags: 5 }
    };

    analyze(graph: WorkspaceGraph, _metrics: ProjectHealthMetrics, severity: AntiPatternSeverity, params?: ExcessiveTagsParams): AntiPattern[] {
        if (severity === 'off') return [];
        const limitFeature = params?.maxFeatureTags ?? this.metadata.defaultParams!.maxFeatureTags;
        const limitScenario = params?.maxScenarioTags ?? this.metadata.defaultParams!.maxScenarioTags;
        const antiPatterns: AntiPattern[] = [];
        
        const allNodes = graph.currentGeneration.getAllNodes();
        const features = allNodes.filter(n => n.type === 'Feature') as FeatureNode[];
        const scenarios = allNodes.filter(n => n.type === 'Scenario') as ScenarioNode[];
        
        const heavyFeatures = features.filter(f => f.tags.length > limitFeature);
        if (heavyFeatures.length > 0) {
            antiPatterns.push({
                id: this.metadata.id,
                title: 'Excessive Tags on Feature',
                category: this.metadata.category,
                rationale: this.metadata.rationale,
                explanation: `Found ${heavyFeatures.length} feature(s) with more than ${limitFeature} tags.`,
                severity,
                affectedFiles: heavyFeatures.map(f => f.uri),
                affectedItems: heavyFeatures.map(f => ({
                    label: `${f.name || 'Unnamed'} (${f.tags.length} tags)`,
                    description: `This feature has ${f.tags.length} tags, exceeding the threshold of ${limitFeature}.`,
                    uri: f.uri,
                    line: f.line,
                    scopeType: 'feature',
                    scopeValue: f.name || 'Unnamed'
                })),
                suggestedFix: 'Review and consolidate feature tags. Consider grouping related functionality into separate files.'
            });
        }
        
        const heavyScenarios = scenarios.filter(s => s.tags.length > limitScenario);
        if (heavyScenarios.length > 0) {
            antiPatterns.push({
                id: this.metadata.id,
                title: 'Excessive Tags on Scenario',
                category: this.metadata.category,
                rationale: this.metadata.rationale,
                explanation: `Found ${heavyScenarios.length} scenario(s) with more than ${limitScenario} tags.`,
                severity,
                affectedFiles: heavyScenarios.map(s => s.uri),
                affectedItems: heavyScenarios.map(s => ({
                    label: `${s.name || 'Unnamed'} (${s.tags.length} tags)`,
                    description: `This scenario has ${s.tags.length} tags, exceeding the threshold of ${limitScenario}.`,
                    uri: s.uri,
                    line: s.line,
                    scopeType: 'scenario',
                    scopeValue: s.name || 'Unnamed'
                })),
                suggestedFix: 'Reduce the number of tags by utilizing Feature-level tags or unifying overlapping tags.'
            });
        }
        return antiPatterns;
    }
}



class InconsistentFormattingRule implements AntiPatternRule {
    metadata: RuleMetadata = {
        id: 'inconsistent-formatting',
        title: 'Inconsistent Formatting: Trailing Spaces',
        category: 'Style',
        rationale: 'Trailing whitespaces cause parsing issues and degrade the readability of source control diffs.',
        defaultSeverity: 'hint'
    };

    analyze(graph: WorkspaceGraph, _metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off') return [];
        const antiPatterns: AntiPattern[] = [];
        const allNodes = graph.currentGeneration.getAllNodes();
        const steps = allNodes.filter(n => n.type === 'Step') as StepNode[];
        
        const stepsWithTrailingSpaces = steps.filter(s => s.text.endsWith(' '));
        if (stepsWithTrailingSpaces.length > 0) {
            const uris = Array.from(new Set(stepsWithTrailingSpaces.map(s => s.uri)));
            antiPatterns.push({
                id: this.metadata.id,
                title: this.metadata.title,
                category: this.metadata.category,
                rationale: this.metadata.rationale,
                explanation: `Found ${stepsWithTrailingSpaces.length} step(s) with trailing spaces.`,
                severity,
                affectedFiles: uris,
                suggestedFix: 'Format the Gherkin documents to remove trailing whitespaces.'
            });
        }
        return antiPatterns;
    }
}

class SyntaxErrorsRule implements AntiPatternRule {
    metadata: RuleMetadata = {
        id: 'syntax-errors',
        title: 'Syntax Error',
        category: 'Correctness',
        rationale: 'Gherkin documents with syntax errors cannot be parsed or executed by test runners.',
        defaultSeverity: 'error'
    };

    analyze(_graph: WorkspaceGraph, metrics: ProjectHealthMetrics, severity: AntiPatternSeverity): AntiPattern[] {
        if (severity === 'off' || !metrics.parseErrors || metrics.parseErrors.length === 0) return [];
        
        const antiPatterns: AntiPattern[] = [];
        for (const fileErrors of metrics.parseErrors) {
            if (fileErrors.errors.length > 0) {
                antiPatterns.push({
                    id: this.metadata.id,
                    title: this.metadata.title,
                    category: this.metadata.category,
                    rationale: this.metadata.rationale,
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

type TeamProfile = 'default' | 'strict' | 'relaxed';

interface AntiPatternRuleConfig {
    severity?: AntiPatternSeverity;
    params?: any;
}

interface AntiPatternConfiguration {
    profile?: TeamProfile;
    rules?: Record<string, AntiPatternRuleConfig | AntiPatternSeverity>;
}

export class AntiPatternEngine {
    private rules: AntiPatternRule[] = [];

    constructor() {
        this.registerRule(new OversizedFeatureRule());
        this.registerRule(new OversizedScenarioRule());
        this.registerRule(new DuplicatedStepsRule());
        this.registerRule(new UnusedStepsRule());
        this.registerRule(new AmbiguousStepsRule());
        this.registerRule(new AmbiguousStepDefinitionsRule());
        this.registerRule(new UndefinedStepsRule());
        this.registerRule(new ExcessiveTagsRule());

        this.registerRule(new InconsistentFormattingRule());
        this.registerRule(new SyntaxErrorsRule());
    }

    registerRule(rule: AntiPatternRule) {
        this.rules.push(rule);
    }

    private resolveProfileSeverity(category: AntiPatternCategory, profile: TeamProfile, defaultSeverity: AntiPatternSeverity): AntiPatternSeverity {
        if (profile === 'relaxed') {
            if (category === 'Style' || category === 'Maintainability') return 'off';
            if (category === 'Reliability') return 'info';
        } else if (profile === 'strict') {
            if (category === 'Maintainability') return 'warning';
            if (category === 'Style') return 'warning';
        }
        return defaultSeverity;
    }

    generateAntiPatterns(graph: WorkspaceGraph, metrics: ProjectHealthMetrics, config: AntiPatternConfiguration): AntiPattern[] {
        const antiPatterns: AntiPattern[] = [];
        const profile = config.profile || 'default';
        const rulesConfig = config.rules || {};

        for (const rule of this.rules) {
            let severity: AntiPatternSeverity = this.resolveProfileSeverity(rule.metadata.category, profile, rule.metadata.defaultSeverity);
            let params: any = rule.metadata.defaultParams;

            const ruleOverride = rulesConfig[rule.metadata.id];
            if (ruleOverride) {
                if (typeof ruleOverride === 'string') {
                    severity = ruleOverride as AntiPatternSeverity;
                } else {
                    if (ruleOverride.severity !== undefined) severity = ruleOverride.severity;
                    if (ruleOverride.params !== undefined) params = { ...params, ...ruleOverride.params };
                }
            }

            antiPatterns.push(...rule.analyze(graph, metrics, severity, params));
        }
        
        const severityOrder = { 'error': 4, 'warning': 3, 'info': 2, 'hint': 1, 'off': 0 };
        return antiPatterns.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
    }
}
