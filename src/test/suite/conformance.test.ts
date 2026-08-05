import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

import { SymbolCache } from '../../cache';
import { WorkspaceGraph } from '../../graph';
import { calculateHealthMetrics } from '../../statistics';
import { AntiPatternEngine } from '../../antiPatternEngine';

suite('CLI Parity & Conformance Test Suite', () => {
    const fixturesDir = path.resolve(__dirname, '../../../src/test/suite/cli-parity/fixtures');
    const cliPath = path.resolve(__dirname, '../../../dist/cli.js');
    
    // We run the CLI directly via node
    const runCli = (cmd: string, cwd: string) => {
        const cmdArgs = [cliPath, ...cmd.split(' ')];
        try {
            const nodePath = process.env.NVM_BIN ? `${process.env.NVM_BIN}/node` : '/Users/carlos/.nvm/versions/node/v20.20.2/bin/node';
            const result = require('child_process').spawnSync(nodePath, cmdArgs, { cwd, encoding: 'utf8', env: process.env });
            if (result.error) throw result.error;
            if (result.status !== 0 && !result.stdout) throw new Error(result.stderr || 'Command failed');
            return result.stdout;
        } catch (e: any) {
            if (e.stdout) return e.stdout;
            throw e;
        }
    };

    const getVsCodeMetrics = async (fixturePath: string) => {
        const symbolCache = new SymbolCache();
        const graph = new WorkspaceGraph(symbolCache);
        
        const originalFindFiles = vscode.workspace.findFiles;
        (vscode.workspace as any).findFiles = async (include: any, exclude?: any, max?: any, token?: any) => {
            // Rewrite any relative patterns to use our fixturePath base
            if (include && typeof include !== 'string' && include.baseUri) {
                include = new vscode.RelativePattern(vscode.Uri.file(fixturePath), include.pattern);
            } else if (typeof include === 'string') {
                include = new vscode.RelativePattern(vscode.Uri.file(fixturePath), include);
            }
            return await originalFindFiles(include, exclude, max, token);
        };
        
        const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(vscode.workspace, 'workspaceFolders');
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            get: () => [{
                uri: vscode.Uri.file(fixturePath),
                name: path.basename(fixturePath),
                index: 0
            }],
            configurable: true
        });

        await graph.initialize();
        const metrics = await calculateHealthMetrics(graph, symbolCache);
        const engine = new AntiPatternEngine();

        const ruleConfig = {
            "oversized-scenario": "warning",
            "oversized-feature": "info",
            "duplicated-steps": "error",
            "unused-steps": "info",
            "ambiguous-steps": "error",
            "undefined-steps": "error",
            "excessive-tags": "info",
            "inconsistent-formatting": "info",
            "poor-maintainability": "warning"
        };
        const antiPatterns = engine.generateAntiPatterns(graph, metrics, ruleConfig as any);
        
        // Restore
        (vscode.workspace as any).findFiles = originalFindFiles;
        if (originalWorkspaceFolders) {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
        }
        
        return { metrics, antiPatterns };
    };

    test('Valid Gherkin Conformance', async () => {
        const fixturePath = path.join(fixturesDir, 'valid');
        const cliOutput = JSON.parse(runCli('stats --json', fixturePath));
        const extData = await getVsCodeMetrics(fixturePath);
        
        assert.strictEqual(cliOutput.totalFeatures, extData.metrics.totalFeatures, 'Feature count mismatch');
        assert.strictEqual(cliOutput.totalSteps, extData.metrics.totalSteps, 'Step count mismatch');
    });

    test('Undefined Steps Conformance', async () => {
        const fixturePath = path.join(fixturesDir, 'undefined');
        const cliOutput = JSON.parse(runCli('analyze --json', fixturePath));
        const extData = await getVsCodeMetrics(fixturePath);
        
        const cliUndefined = cliOutput.find((ap: any) => ap.title.includes('Undefined'));
        const extUndefined = extData.antiPatterns.find(ap => ap.title.includes('Undefined'));
        
        assert.ok(cliUndefined, 'CLI failed to detect undefined steps');
        assert.ok(extUndefined, 'Extension failed to detect undefined steps');
        assert.strictEqual(cliUndefined.affectedItems?.length, extUndefined?.affectedItems?.length, 'Affected items mismatch');
    });

    test('Unused Steps Conformance', async () => {
        const fixturePath = path.join(fixturesDir, 'unused');
        const cliOutput = JSON.parse(runCli('analyze --json', fixturePath));
        const extData = await getVsCodeMetrics(fixturePath);
        
        const cliUnused = cliOutput.find((ap: any) => ap.title.includes('Unused'));
        const extUnused = extData.antiPatterns.find(ap => ap.title.includes('Unused'));
        
        assert.ok(cliUnused, 'CLI failed to detect unused steps');
        assert.ok(extUnused, 'Extension failed to detect unused steps');
        assert.strictEqual(cliUnused.affectedItems?.length, extUnused?.affectedItems?.length, 'Affected items mismatch');
    });

});
