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

    test('stats --json should output project statistics', () => {
        const output = cp.execFileSync(nodeExecutable, [cliPath, 'stats', '--json'], execOptions);
        
        const jsonStr = output.substring(output.indexOf('{'), output.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonStr);
        assert.ok(data.totalFiles !== undefined);
        assert.ok(data.totalFeatures !== undefined);
        assert.ok(data.scores !== undefined);
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
});
