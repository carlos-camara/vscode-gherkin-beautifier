import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationService, DEFAULT_CONFIG, ConfigurationLoader, ProjectConfiguration } from '../../configuration';

suite('ConfigurationService Test Suite', () => {
    let configService: ConfigurationService;
    let mockDiagnostics: vscode.DiagnosticCollection;
    let workspacePath: string;

    setup(() => {
        mockDiagnostics = {
            name: 'mock',
            set: () => {},
            delete: () => {},
            clear: () => {},
            forEach: () => {},
            get: () => [],
            has: () => false,
            dispose: () => {}
        } as any;
        
        const testLoader: ConfigurationLoader = {
            async load(workspaceFolder: vscode.WorkspaceFolder | undefined): Promise<ProjectConfiguration | null> {
                if (!workspaceFolder) return null;
                const configPath = path.join(workspaceFolder.uri.fsPath, '.gherkin-powertoolsrc.json');
                if (!fs.existsSync(configPath)) return null;
                const content = fs.readFileSync(configPath, 'utf8');
                let parsed = null;
                try {
                    parsed = JSON.parse(content);
                } catch (e) {}
                return { content, parsed, uri: vscode.Uri.file(configPath) };
            }
        };

        configService = new ConfigurationService(mockDiagnostics, testLoader);

        workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
    });

    teardown(() => {
        configService.invalidateCache();
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
    });

    test('1. Default configuration is returned when no overrides exist and file is missing', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }

        const originalGetConfig = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => ({
            get: () => undefined,
            inspect: () => undefined
        } as any);

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        assert.deepStrictEqual(config, DEFAULT_CONFIG);

        vscode.workspace.getConfiguration = originalGetConfig;
    });

    test('2. Workspace settings override defaults', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }

        const originalGetConfig = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => ({
            get: () => undefined,
            inspect: (key: string) => {
                if (key === 'indentation.steps') return { workspaceValue: 2 };
                if (key === 'tags.format') return { workspaceValue: 'singleLine' };
                return undefined;
            }
        } as any);

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        assert.strictEqual(config.indentation.steps, 2);
        assert.strictEqual(config.tags.format, 'singleLine');
        assert.strictEqual(config.tables.alignToKeyword, true); // default fallback

        vscode.workspace.getConfiguration = originalGetConfig;
    });

    test('3. Precedence hierarchy: project .gherkin-powertoolsrc.json > workspace settings > defaults', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        
        fs.writeFileSync(configPath, JSON.stringify({
            indentation: { steps: 8 },
            tables: { alignToKeyword: false }
        }));

        const originalGetConfig = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => ({
            get: () => undefined,
            inspect: (key: string) => {
                // Workspace setting which should be overridden by project config
                if (key === 'indentation.steps') return { workspaceValue: 2 };
                // Workspace setting which should apply because it's not in project config
                if (key === 'tags.format') return { workspaceValue: 'singleLine' };
                return undefined;
            }
        } as any);

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        assert.strictEqual(config.indentation.steps, 8); // Project overrides workspace
        assert.strictEqual(config.tables.alignToKeyword, false); // Project overrides default
        assert.strictEqual(config.tags.format, 'singleLine'); // Workspace setting preserved for non-project property

        vscode.workspace.getConfiguration = originalGetConfig;
    });

    test('4. Handles missing configuration file gracefully without crashing', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }

        let diagnosticSetCount = 0;
        mockDiagnostics.set = () => { diagnosticSetCount++; };

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        assert.ok(config);
        assert.strictEqual(config.indentation.steps, 4);
    });

    test('5. Handles invalid JSON syntax in project configuration gracefully', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        fs.writeFileSync(configPath, '{ invalid json');

        let diagnosticSetCount = 0;
        mockDiagnostics.set = () => { diagnosticSetCount++; };

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        // Fallback to defaults/vscode settings
        assert.strictEqual(config.indentation.steps, 4);
        assert.strictEqual(diagnosticSetCount, 1);
    });

    test('6. Handles invalid value types and enum options in project configuration gracefully', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        
        fs.writeFileSync(configPath, JSON.stringify({
            indentation: { steps: "not a number" },
            tags: { format: "invalidFormat" },
            behave: {
                execution: { executable: 456, arguments: "not array" },
                additionalArguments: "not an array",
                localExecutable: "C:\\Python39\\python.exe"
            }
        }));

        let diagnostics: vscode.Diagnostic[] = [];
        mockDiagnostics.set = ((_uri: any, diags: vscode.Diagnostic[]) => { diagnostics = diags; }) as any;

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        // Fallbacks to default
        assert.strictEqual(config.indentation.steps, 4);
        assert.strictEqual(config.tags.format, 'wrap');
        assert.strictEqual(config.behave.execution.executable, 'behave');
        assert.deepStrictEqual(config.behave.execution.arguments, []);
        assert.deepStrictEqual(config.behave.additionalArguments, []);
        assert.strictEqual(diagnostics.length, 6); // indentation, tags, and 4 for behave (execution.executable, execution.args, additionalArgs, localExecutable)
    });

    test('7. Handles unknown keys and unknown root sections gracefully', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        
        fs.writeFileSync(configPath, JSON.stringify({
            unknownSection: { foo: 'bar' },
            indentation: { steps: 2, unknownSubKey: 10 }
        }));

        let diagnostics: vscode.Diagnostic[] = [];
        mockDiagnostics.set = ((_uri: any, diags: vscode.Diagnostic[]) => { diagnostics = diags; }) as any;

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        assert.strictEqual(config.indentation.steps, 2);
        assert.strictEqual(diagnostics.length, 2);
    });

    test('8. Loads behave execution settings correctly', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        
        fs.writeFileSync(configPath, JSON.stringify({
            behave: {
                execution: {
                    executable: 'poetry',
                    arguments: ['run', 'behave']
                },
                additionalArguments: ['-f', 'json']
            }
        }));

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        assert.strictEqual(config.behave.execution.executable, 'poetry');
        assert.deepStrictEqual(config.behave.execution.arguments, ['run', 'behave']);
        assert.deepStrictEqual(config.behave.additionalArguments, ['-f', 'json']);
    });

    test('9. Live configuration changes and cache invalidation', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        fs.writeFileSync(configPath, JSON.stringify({ indentation: { steps: 8 } }));
        
        const uri = vscode.workspace.workspaceFolders?.[0].uri;
        await configService.loadConfiguration(uri);
        let config = configService.getConfiguration(uri);
        assert.strictEqual(config.indentation.steps, 8);

        // Modify file and invalidate cache
        fs.writeFileSync(configPath, JSON.stringify({ indentation: { steps: 2 } }));
        await configService.loadConfiguration(uri);
        
        config = configService.getConfiguration(uri);
        assert.strictEqual(config.indentation.steps, 2);
    });

    test('10. Validates all invalid property values and unknown subkeys in config schema', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        
        fs.writeFileSync(configPath, JSON.stringify({
            tables: { alignToKeyword: "not_a_bool", unknownTableKey: true },
            tags: { sort: "alphabetical", unknownTagKey: 1 },
            emptyLines: { betweenScenarios: "not_a_number", unknownEmptyKey: 2 },
            behave: { stepGlobs: "not_an_array", unknownBehaveKey: "foo" }
        }));

        let diagnostics: vscode.Diagnostic[] = [];
        mockDiagnostics.set = ((_uri: any, diags: vscode.Diagnostic[]) => { diagnostics = diags; }) as any;

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        assert.strictEqual(config.tags.sort, 'alphabetical');
        assert.strictEqual(config.tables.alignToKeyword, true); // fallback
        assert.strictEqual(config.emptyLines.betweenScenarios, 1); // fallback
        assert.ok(diagnostics.length >= 5);
    });

    test('11. Handles non-object JSON values gracefully', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        fs.writeFileSync(configPath, JSON.stringify([1, 2, 3]));

        let diagnostics: vscode.Diagnostic[] = [];
        mockDiagnostics.set = ((_uri: any, diags: vscode.Diagnostic[]) => { diagnostics = diags; }) as any;

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        assert.strictEqual(config.indentation.steps, 4);
        assert.ok(diagnostics.length > 0);
    });

    test('12. Profile settings provide base defaults that are overridden by explicit user settings', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }

        const originalGetConfig = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => ({
            get: (key: string) => {
                if (key === 'profile') return 'strict';
                return undefined;
            },
            inspect: (key: string) => {
                // Override strict profile's indentation
                if (key === 'indentation.steps') return { workspaceValue: 8 };
                return undefined;
            }
        } as any);

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        // Strict profile sets tags.sort to alphabetical
        assert.strictEqual(config.tags.sort, 'alphabetical');
        
        // Strict profile defaults to 4, but user overrides to 8
        assert.strictEqual(config.indentation.steps, 8);

        vscode.workspace.getConfiguration = originalGetConfig;
    });

    test('13. Loads behave execution settings from workspace configuration correctly', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }

        const originalGetConfig = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => ({
            get: () => undefined,
            inspect: (key: string) => {
                if (key === 'behave.execution') return { workspaceValue: { executable: 'pipenv', arguments: ['run', 'behave'] } };
                if (key === 'behave.additionalArguments') return { workspaceValue: ['--no-capture'] };
                if (key === 'behave.ignoreGlobs') return { workspaceValue: ['**/venv/**'] };
                return undefined;
            }
        } as any);

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        assert.strictEqual(config.behave.execution.executable, 'pipenv');
        assert.deepStrictEqual(config.behave.execution.arguments, ['run', 'behave']);
        assert.deepStrictEqual(config.behave.additionalArguments, ['--no-capture']);
        assert.deepStrictEqual(config.behave.ignoreGlobs, ['**/venv/**']);

        vscode.workspace.getConfiguration = originalGetConfig;
    });

    test('14. localExecutable overrides execution.executable', async () => {
        const configPath = path.join(workspacePath, '.gherkin-powertoolsrc.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }

        const originalGetConfig = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => ({
            get: () => undefined,
            inspect: (key: string) => {
                if (key === 'behave.execution') return { workspaceValue: { executable: 'poetry', arguments: ['run', 'behave'] } };
                if (key === 'behave.localExecutable') return { globalValue: '/absolute/path/to/venv/bin/behave' };
                return undefined;
            }
        } as any);

        await configService.loadConfiguration(vscode.workspace.workspaceFolders?.[0].uri);
        const config = configService.getConfiguration(vscode.workspace.workspaceFolders?.[0].uri);

        assert.strictEqual(config.behave.execution.executable, 'poetry');
        assert.strictEqual(config.behave.localExecutable, '/absolute/path/to/venv/bin/behave');

        vscode.workspace.getConfiguration = originalGetConfig;
    });
});
