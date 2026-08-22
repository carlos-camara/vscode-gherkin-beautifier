import * as vscode from 'vscode';

export interface Configuration {
    indentation: { steps: number; };
    tables: { alignToKeyword: boolean; };
    docStrings: { alignToKeyword: boolean; };
    tags: { format: 'wrap' | 'singleLine'; sort: 'preserve' | 'alphabetical'; };
    emptyLines: { betweenScenarios: number; };
    formatter: { enabled: boolean; };
    linter: { enabled: boolean; enabledRules: string[]; };
    behave: { stepGlobs: string[]; ignoreGlobs: string[]; additionalArguments: string[]; execution: { executable: string; arguments: string[] }; localExecutable?: string; };
    featureGlobs: string[];
}

import { DEFAULT_CONFIG, DEFAULT_RULE_CONFIG } from './defaults';

export { DEFAULT_CONFIG, DEFAULT_RULE_CONFIG };

const PROFILES: Record<string, Partial<Configuration>> = {
    custom: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    strict: {
        ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
        tags: { format: 'wrap', sort: 'alphabetical' }
    },
    team: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    minimal: {
        ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
        indentation: { steps: 2 },
        tables: { alignToKeyword: false },
        docStrings: { alignToKeyword: false },
        tags: { format: 'singleLine', sort: 'preserve' },
        emptyLines: { betweenScenarios: 0 }
    },
    legacy: {
        ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
        indentation: { steps: 2 },
        tables: { alignToKeyword: false },
        docStrings: { alignToKeyword: true }
    }
};
interface ConfigError {
    key: string;
    message: string;
}

/**
 * Pure function to validate and merge parsed JSON against the base configuration.
 * Respects precedence when baseConfig is provided (Project > Workspace > User > Default).
 * Extracted to allow CLI/testing usage without depending on VS Code API.
 */
function validateAndMergeConfig(parsed: any, baseConfig?: Configuration): { errors: ConfigError[], config: Configuration } {
    const errors: ConfigError[] = [];
    const config: Configuration = JSON.parse(JSON.stringify(baseConfig || DEFAULT_CONFIG));

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        errors.push({ key: 'root', message: 'Configuration must be a JSON object.' });
        return { errors, config };
    }

    const validSections = ['profile', 'indentation', 'tables', 'docStrings', 'tags', 'emptyLines', 'formatter', 'linter', 'behave'];

    for (const key of Object.keys(parsed)) {
        if (!validSections.includes(key)) {
            errors.push({ key, message: `Unknown configuration section: "${key}".` });
            continue;
        }

        if (key === 'profile') {
            if (typeof parsed[key] !== 'string' || !PROFILES[parsed[key]]) {
                errors.push({ key, message: `"profile" must be one of: custom, strict, team, minimal, legacy.` });
            }
            continue; // Applied before validation
        }

        if (typeof parsed[key] !== 'object' || parsed[key] === null || Array.isArray(parsed[key])) {
            errors.push({ key, message: `Section "${key}" must be an object.` });
            continue;
        }

        const section = parsed[key];

        if (key === 'indentation') {
            for (const subKey of Object.keys(section)) {
                if (subKey === 'steps') {
                    if (typeof section[subKey] !== 'number') {
                        errors.push({ key: subKey, message: `"indentation.steps" must be a number.` });
                    } else {
                        config.indentation.steps = section[subKey];
                    }
                } else {
                    errors.push({ key: subKey, message: `Unknown property in indentation: "${subKey}".` });
                }
            }
        } else if (key === 'tables') {
            for (const subKey of Object.keys(section)) {
                if (subKey === 'alignToKeyword') {
                    if (typeof section[subKey] !== 'boolean') {
                        errors.push({ key: subKey, message: `"tables.alignToKeyword" must be a boolean.` });
                    } else {
                        config.tables.alignToKeyword = section[subKey];
                    }
                } else {
                    errors.push({ key: subKey, message: `Unknown property in tables: "${subKey}".` });
                }
            }
        } else if (key === 'docStrings') {
            for (const subKey of Object.keys(section)) {
                if (subKey === 'alignToKeyword') {
                    if (typeof section[subKey] !== 'boolean') {
                        errors.push({ key: subKey, message: `"docStrings.alignToKeyword" must be a boolean.` });
                    } else {
                        config.docStrings.alignToKeyword = section[subKey];
                    }
                } else {
                    errors.push({ key: subKey, message: `Unknown property in docStrings: "${subKey}".` });
                }
            }
        } else if (key === 'tags') {
            for (const subKey of Object.keys(section)) {
                if (subKey === 'format') {
                    if (section[subKey] !== 'wrap' && section[subKey] !== 'singleLine') {
                        errors.push({ key: subKey, message: `"tags.format" must be 'wrap' or 'singleLine'.` });
                    } else {
                        config.tags.format = section[subKey];
                    }
                } else if (subKey === 'sort') {
                    if (section[subKey] !== 'preserve' && section[subKey] !== 'alphabetical') {
                        errors.push({ key: subKey, message: `"tags.sort" must be 'preserve' or 'alphabetical'.` });
                    } else {
                        config.tags.sort = section[subKey];
                    }
                } else {
                    errors.push({ key: subKey, message: `Unknown property in tags: "${subKey}".` });
                }
            }
        } else if (key === 'emptyLines') {
            for (const subKey of Object.keys(section)) {
                if (subKey === 'betweenScenarios') {
                    if (typeof section[subKey] !== 'number') {
                        errors.push({ key: subKey, message: `"emptyLines.betweenScenarios" must be a number.` });
                    } else {
                        config.emptyLines.betweenScenarios = section[subKey];
                    }
                } else {
                    errors.push({ key: subKey, message: `Unknown property in emptyLines: "${subKey}".` });
                }
            }
        } else if (key === 'formatter') {
            for (const subKey of Object.keys(section)) {
                if (subKey === 'enabled') {
                    if (typeof section[subKey] !== 'boolean') {
                        errors.push({ key: subKey, message: `"formatter.enabled" must be a boolean.` });
                    } else {
                        config.formatter.enabled = section[subKey];
                    }
                } else {
                    errors.push({ key: subKey, message: `Unknown property in formatter: "${subKey}".` });
                }
            }
        } else if (key === 'linter') {
            for (const subKey of Object.keys(section)) {
                if (subKey === 'enabled') {
                    if (typeof section[subKey] !== 'boolean') {
                        errors.push({ key: subKey, message: `"linter.enabled" must be a boolean.` });
                    } else {
                        config.linter.enabled = section[subKey];
                    }
                } else if (subKey === 'enabledRules') {
                    const validRules = ['MISSING_COLON', 'INVALID_KEYWORD', 'SEMANTIC_ERROR', 'TABLE_INCONSISTENCY', 'UNDEFINED_STEP', 'AMBIGUOUS_STEP'];
                    if (!Array.isArray(section[subKey]) || !section[subKey].every((r: any) => typeof r === 'string' && validRules.includes(r))) {
                        errors.push({ key: subKey, message: `"linter.enabledRules" must be an array of valid rule IDs: ${validRules.join(', ')}.` });
                    } else {
                        config.linter.enabledRules = section[subKey];
                    }
                } else {
                    errors.push({ key: subKey, message: `Unknown property in linter: "${subKey}".` });
                }
            }
        } else if (key === 'behave') {
            for (const subKey of Object.keys(section)) {
                if (subKey === 'stepGlobs' || subKey === 'ignoreGlobs' || subKey === 'additionalArguments') {
                    if (!Array.isArray(section[subKey]) || !section[subKey].every((i: any) => typeof i === 'string')) {
                        errors.push({ key: subKey, message: `"behave.${subKey}" must be an array of strings.` });
                    } else {
                        if (subKey === 'stepGlobs') { config.behave.stepGlobs = section[subKey]; }
                        if (subKey === 'ignoreGlobs') { config.behave.ignoreGlobs = section[subKey]; }
                        if (subKey === 'additionalArguments') { config.behave.additionalArguments = section[subKey]; }
                    }
                } else if (subKey === 'execution') {
                    const execObj = section[subKey];
                    if (typeof execObj !== 'object' || execObj === null || Array.isArray(execObj)) {
                        errors.push({ key: subKey, message: `"behave.execution" must be an object.` });
                    } else {
                        if (typeof execObj.executable === 'string') {
                            config.behave.execution.executable = execObj.executable;
                        } else if (execObj.executable !== undefined) {
                            errors.push({ key: 'execution.executable', message: `"behave.execution.executable" must be a string.` });
                        }
                        
                        if (Array.isArray(execObj.arguments) && execObj.arguments.every((i: any) => typeof i === 'string')) {
                            config.behave.execution.arguments = execObj.arguments;
                        } else if (execObj.arguments !== undefined) {
                            errors.push({ key: 'execution.arguments', message: `"behave.execution.arguments" must be an array of strings.` });
                        }
                    }
                } else if (subKey === 'localExecutable') {
                    errors.push({ key: subKey, message: `"behave.localExecutable" is a machine-specific override and cannot be defined in the portable project configuration.` });
                } else {
                    errors.push({ key: subKey, message: `Unknown property in behave: "${subKey}".` });
                }
            }
        }
    }

    return { errors, config };
}

export interface ProjectConfiguration {
    content: string;
    parsed: any | null;
    uri?: vscode.Uri;
}

export interface ConfigurationLoader {
    load(workspaceFolder: vscode.WorkspaceFolder | undefined): Promise<ProjectConfiguration | null>;
}

export class ConfigurationService {
    private cache = new Map<string, Configuration>();
    private projectConfigs = new Map<string, ProjectConfiguration>();
    private diagnosticCollection: vscode.DiagnosticCollection;
    private loader: ConfigurationLoader;

    constructor(diagnosticCollection: vscode.DiagnosticCollection, loader: ConfigurationLoader) {
        this.diagnosticCollection = diagnosticCollection;
        this.loader = loader;
    }

    public async initialize(): Promise<void> {
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                await this.loadConfiguration(folder.uri);
            }
        } else {
            await this.loadConfiguration(undefined);
        }
    }

    public async loadConfiguration(uri?: vscode.Uri): Promise<void> {
        const workspaceFolder = uri ? vscode.workspace.getWorkspaceFolder(uri) : undefined;
        const folderUri = workspaceFolder ? workspaceFolder.uri.toString() : 'global';
        
        try {
            const projectConfig = await this.loader.load(workspaceFolder);
            if (projectConfig) {
                this.projectConfigs.set(folderUri, projectConfig);
            } else {
                this.projectConfigs.delete(folderUri);
            }
        } catch (e) {
            this.projectConfigs.delete(folderUri);
        }
        
        // Invalidate and re-resolve
        this.cache.set(folderUri, this.resolveConfiguration(workspaceFolder, uri));
    }

    public getConfiguration(uri: vscode.Uri | undefined): Configuration {
        const workspaceFolder = uri ? vscode.workspace.getWorkspaceFolder(uri) : undefined;
        const folderUri = workspaceFolder ? workspaceFolder.uri.toString() : 'global';

        if (this.cache.has(folderUri)) {
            return this.cache.get(folderUri)!;
        }

        const config = this.resolveConfiguration(workspaceFolder, uri);
        this.cache.set(folderUri, config);
        return config;
    }

    public invalidateCache(uri?: vscode.Uri) {
        if (uri) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            if (workspaceFolder) {
                const folderUriStr = workspaceFolder.uri.toString();
                this.cache.delete(folderUriStr);
                const projectConfig = this.projectConfigs.get(folderUriStr);
                if (projectConfig && projectConfig.uri) {
                    this.diagnosticCollection.delete(projectConfig.uri);
                }
            }
        } else {
            this.cache.clear();
            this.diagnosticCollection.clear();
        }
    }

    private resolveConfiguration(workspaceFolder: vscode.WorkspaceFolder | undefined, uri: vscode.Uri | undefined): Configuration {
        const folderUriStr = workspaceFolder ? workspaceFolder.uri.toString() : 'global';
        const projectConfig = this.projectConfigs.get(folderUriStr);

        let parsedProjectConfig: any = null;
        let projectProfile: string | undefined = undefined;
        let fileContent = '';

        if (projectConfig) {
            fileContent = projectConfig.content;
            parsedProjectConfig = projectConfig.parsed;
            if (parsedProjectConfig && typeof parsedProjectConfig.profile === 'string') {
                projectProfile = parsedProjectConfig.profile;
            }
        }

        const vsCodeConfig = this.getVsCodeSettings(uri, projectProfile);

        if (!parsedProjectConfig) {
            if (projectConfig && projectConfig.uri && fileContent.trim() !== '') {
                const range = new vscode.Range(0, 0, 0, 100);
                const diag = new vscode.Diagnostic(range, `Invalid JSON`, vscode.DiagnosticSeverity.Error);
                this.diagnosticCollection.set(projectConfig.uri, [diag]);
            } else if (projectConfig && projectConfig.uri) {
                this.diagnosticCollection.delete(projectConfig.uri);
            }
            return vsCodeConfig;
        }

        const { errors, config } = validateAndMergeConfig(parsedProjectConfig, vsCodeConfig);
        
        if (errors.length > 0 && projectConfig && projectConfig.uri) {
            const diagnostics = errors.map(err => {
                let line = 0;
                const lines = fileContent.split('\n');
                const idx = lines.findIndex(l => l.includes(`"${err.key}"`));
                if (idx >= 0) { line = idx; }
                const range = new vscode.Range(line, 0, line, 100);
                return new vscode.Diagnostic(range, err.message, vscode.DiagnosticSeverity.Error);
            });
            this.diagnosticCollection.set(projectConfig.uri, diagnostics);
        } else if (projectConfig && projectConfig.uri) {
            this.diagnosticCollection.delete(projectConfig.uri);
        }
        
        return config;
    }

    private getVsCodeSettings(uri: vscode.Uri | undefined, projectProfile?: string): Configuration {
        const workspaceConfig = vscode.workspace.getConfiguration('gherkinPowerTools', uri);
        const profileName = projectProfile || workspaceConfig.get<string>('profile') || 'custom';
        const baseConfig = PROFILES[profileName] || PROFILES['custom'];
        const config: Configuration = JSON.parse(JSON.stringify(baseConfig));

        const getOverride = <T>(key: string): T | undefined => {
            const inspect = workspaceConfig.inspect<T>(key);
            if (inspect) {
                if (inspect.workspaceFolderValue !== undefined) return inspect.workspaceFolderValue;
                if (inspect.workspaceValue !== undefined) return inspect.workspaceValue;
                if (inspect.globalValue !== undefined) return inspect.globalValue;
            }
            return undefined;
        };

        const indentationSteps = getOverride<number>('indentation.steps');
        if (indentationSteps !== undefined && typeof indentationSteps === 'number') {
            config.indentation.steps = indentationSteps;
        }

        const alignToKeyword = getOverride<boolean>('tables.alignToKeyword');
        if (alignToKeyword !== undefined && typeof alignToKeyword === 'boolean') {
            config.tables.alignToKeyword = alignToKeyword;
        }

        const docStringsAlignToKeyword = getOverride<boolean>('docStrings.alignToKeyword');
        if (docStringsAlignToKeyword !== undefined && typeof docStringsAlignToKeyword === 'boolean') {
            config.docStrings.alignToKeyword = docStringsAlignToKeyword;
        }

        const tagsFormat = getOverride<'wrap' | 'singleLine'>('tags.format');
        if (tagsFormat !== undefined && (tagsFormat === 'wrap' || tagsFormat === 'singleLine')) {
            config.tags.format = tagsFormat;
        }

        const tagsSort = getOverride<'preserve' | 'alphabetical'>('tags.sort');
        if (tagsSort !== undefined && (tagsSort === 'preserve' || tagsSort === 'alphabetical')) {
            config.tags.sort = tagsSort;
        }

        const emptyLinesBetween = getOverride<number>('emptyLines.betweenScenarios');
        if (emptyLinesBetween !== undefined && typeof emptyLinesBetween === 'number') {
            config.emptyLines.betweenScenarios = emptyLinesBetween;
        }

        const formatterEnabled = getOverride<boolean>('formatter.enabled');
        if (formatterEnabled !== undefined && typeof formatterEnabled === 'boolean') {
            config.formatter.enabled = formatterEnabled;
        }

        const linterEnabled = getOverride<boolean>('linter.enabled');
        if (linterEnabled !== undefined && typeof linterEnabled === 'boolean') {
            config.linter.enabled = linterEnabled;
        }

        const linterEnabledRules = getOverride<string[]>('linter.enabledRules');
        const validRules = ['MISSING_COLON', 'INVALID_KEYWORD', 'SEMANTIC_ERROR', 'TABLE_INCONSISTENCY', 'UNDEFINED_STEP', 'AMBIGUOUS_STEP'];
        if (linterEnabledRules !== undefined && Array.isArray(linterEnabledRules) && linterEnabledRules.every(r => validRules.includes(r))) {
            config.linter.enabledRules = linterEnabledRules;
        }

        const stepGlobs = getOverride<string[]>('behave.stepGlobs');
        if (stepGlobs !== undefined && Array.isArray(stepGlobs) && stepGlobs.every(i => typeof i === 'string')) {
            config.behave.stepGlobs = stepGlobs;
        }

        const ignoreGlobs = getOverride<string[]>('behave.ignoreGlobs');
        if (ignoreGlobs !== undefined && Array.isArray(ignoreGlobs) && ignoreGlobs.every(i => typeof i === 'string')) {
            config.behave.ignoreGlobs = ignoreGlobs;
        }

        const additionalArguments = getOverride<string[]>('behave.additionalArguments');
        if (additionalArguments !== undefined && Array.isArray(additionalArguments) && additionalArguments.every(i => typeof i === 'string')) {
            config.behave.additionalArguments = additionalArguments;
        }

        const execution = getOverride<{ executable: string; arguments: string[] }>('behave.execution');
        if (execution !== undefined && typeof execution === 'object' && execution !== null) {
            if (typeof execution.executable === 'string') {
                config.behave.execution.executable = execution.executable;
            }
            if (Array.isArray(execution.arguments) && execution.arguments.every(i => typeof i === 'string')) {
                config.behave.execution.arguments = execution.arguments;
            }
        }

        const localExecutable = getOverride<string>('behave.localExecutable');
        if (localExecutable !== undefined && typeof localExecutable === 'string') {
            config.behave.localExecutable = localExecutable;
        }

        return config;
    }
}

