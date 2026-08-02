import * as assert from 'assert';
import * as cp from 'child_process';
import * as path from 'path';

suite('CLI Integration Tests', () => {
    const cliPath = path.resolve(__dirname, '../../../dist/cli.js');
    const cwd = path.resolve(__dirname, '../../../src/test/fixtures/behave');
    const execOptions = {
        cwd,
        encoding: 'utf8' as const,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    };
    
    const nodeExecutable = process.env.npm_node_execpath || 'node';

    test('analyze --json should output valid JSON and exit code 1 if issues found', () => {
        try {
            cp.execFileSync(nodeExecutable, [cliPath, 'analyze', '--json'], execOptions);
            assert.fail('Should have exited with code 1');
        } catch (err: any) {
            assert.strictEqual(err.status, 1);
            // Extract the JSON part from the output (it might have console.logs before it)
            const output = err.stdout;
            const jsonStart = output.indexOf('[\n');
            const jsonStr = output.substring(jsonStart, output.lastIndexOf(']') + 1);
            const data = JSON.parse(jsonStr);
            assert.ok(Array.isArray(data));
            assert.ok(data.length > 0);
            assert.strictEqual(data[0].title, 'Unused Step Definitions');
        }
    });

    test('analyze without --json should output human-readable text and exit code 1 if issues found', () => {
        try {
            cp.execFileSync(nodeExecutable, [cliPath, 'analyze'], execOptions);
            assert.fail('Should have exited with code 1');
        } catch (err: any) {
            assert.strictEqual(err.status, 1);
            const output = err.stdout;
            assert.ok(output.includes('Found'));
            assert.ok(output.includes('recommendation(s)'));
            assert.ok(output.includes('[WARNING]') || output.includes('[ERROR]') || output.includes('[INFO]'));
        }
    });

    test('stats --json should output project statistics', () => {
        const output = cp.execFileSync(nodeExecutable, [cliPath, 'stats', '--json'], execOptions);
        
        const jsonStr = output.substring(output.indexOf('{'), output.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonStr);
        assert.ok(data.totalFiles !== undefined);
        assert.ok(data.totalFeatures !== undefined);
        assert.ok(data.scores !== undefined);
    });

    test('stats without --json should output human-readable report', () => {
        const output = cp.execFileSync(nodeExecutable, [cliPath, 'stats'], execOptions);
        assert.ok(output.includes('--- Gherkin Project Stats ---'));
        assert.ok(output.includes('Files:'));
        assert.ok(output.includes('Features:'));
        assert.ok(output.includes('--- Health Scores ---'));
        assert.ok(output.includes('Overall Health:'));
    });

    test('format --check should exit with code 1 for unformatted files', () => {
        try {
            cp.execFileSync(nodeExecutable, [cliPath, 'format', '--check'], execOptions);
            assert.fail('Should have exited with code 1');
        } catch (err: any) {
            assert.strictEqual(err.status, 1);
            assert.ok(err.stdout.includes('needs formatting'));
        }
    });

    test('--help should output help text and exit with 0', () => {
        const output = cp.execFileSync(nodeExecutable, [cliPath, '--help'], execOptions);
        assert.ok(output.includes('Usage: gherkin-pt'));
        assert.ok(output.includes('analyze'));
        assert.ok(output.includes('stats'));
        assert.ok(output.includes('format'));
    });

    test('unknown command should exit with code 1', () => {
        try {
            // Silence stderr to keep test output clean
            cp.execFileSync(nodeExecutable, [cliPath, 'invalid_command'], { ...execOptions, stdio: 'pipe' });
            assert.fail('Should have exited with code 1');
        } catch (err: any) {
            assert.strictEqual(err.status, 1);
            assert.ok(err.stderr.includes('error: unknown command'));
        }
    });
});
