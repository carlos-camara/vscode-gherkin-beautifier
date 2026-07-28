import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { OnboardingEngine, BehaveDetector, mergeSettingsJson, mergeProjectConfigFile } from '../../onboarding';

suite('Onboarding Engine Test Suite', () => {
    let tempDir: string;

    setup(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gherkin-onboarding-test-'));
    });

    teardown(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore
        }
    });

    test('BehaveDetector detects manifest files with behave', async () => {
        const folderUri = vscode.Uri.file(tempDir);
        fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'behave==1.2.6\npytest\n');

        const result = await BehaveDetector.detectBehaveUsage(folderUri);
        assert.strictEqual(result.isBehaveProject, true);
        assert.strictEqual(result.hasManifest, true);
    });

    test('BehaveDetector detects non-Behave project with zero notifications', async () => {
        const folderUri = vscode.Uri.file(tempDir);
        fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name": "cucumber-js-project"}');
        fs.mkdirSync(path.join(tempDir, 'features'), { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'features', 'sample.feature'), 'Feature: Sample');

        const engine = new OnboardingEngine();
        const analysis = await engine.analyzeWorkspaceFolder(folderUri, ['**/steps/**/*.py'], []);
        assert.strictEqual(analysis.isBehaveProject, false);
        assert.strictEqual(analysis.uncoveredStepFiles.length, 0);
    });

    test('OnboardingEngine detects standard layout and computes stepGlobs coverage', async () => {
        const folderUri = vscode.Uri.file(tempDir);
        const stepsDir = path.join(tempDir, 'features', 'steps');
        fs.mkdirSync(stepsDir, { recursive: true });
        fs.writeFileSync(path.join(stepsDir, 'login_steps.py'), '@given("user logs in")\ndef step_impl(context):\n    pass\n');

        const engine = new OnboardingEngine();
        const currentGlobs = ['**/steps/**/*.py'];
        const analysis = await engine.analyzeWorkspaceFolder(folderUri, currentGlobs, []);

        assert.strictEqual(analysis.isBehaveProject, true);
        assert.strictEqual(analysis.uncoveredStepFiles.length, 0);
    });

    test('OnboardingEngine detects custom src-based layout and suggests updated stepGlobs', async () => {
        const folderUri = vscode.Uri.file(tempDir);
        const customDir = path.join(tempDir, 'src', 'custom_bdd', 'steps');
        fs.mkdirSync(customDir, { recursive: true });
        fs.writeFileSync(path.join(customDir, 'auth_steps.py'), '@when("user clicks auth")\ndef step_impl(context):\n    pass\n');

        const engine = new OnboardingEngine();
        const currentGlobs = ['**/features/steps/**/*.py'];
        const analysis = await engine.analyzeWorkspaceFolder(folderUri, currentGlobs, []);

        assert.strictEqual(analysis.isBehaveProject, true);
        assert.strictEqual(analysis.uncoveredStepFiles.length, 1);
        assert.ok(analysis.uncoveredStepFiles[0].includes('auth_steps.py'));
        assert.ok(analysis.suggestedStepGlobs.some(g => g.includes('custom_bdd')));
    });

    test('OnboardingEngine handles monorepos with multiple step directories', async () => {
        const folderUri = vscode.Uri.file(tempDir);
        const serviceADir = path.join(tempDir, 'services', 'service_a', 'steps');
        const serviceBDir = path.join(tempDir, 'services', 'service_b', 'steps');
        fs.mkdirSync(serviceADir, { recursive: true });
        fs.mkdirSync(serviceBDir, { recursive: true });
        fs.writeFileSync(path.join(serviceADir, 'steps_a.py'), '@then("check a")\ndef step_a(context):\n    pass\n');
        fs.writeFileSync(path.join(serviceBDir, 'steps_b.py'), '@then("check b")\ndef step_b(context):\n    pass\n');

        const engine = new OnboardingEngine();
        const analysis = await engine.analyzeWorkspaceFolder(folderUri, ['**/features/steps/**/*.py'], []);

        assert.strictEqual(analysis.isBehaveProject, true);
        assert.strictEqual(analysis.uncoveredStepFiles.length, 2);
    });

    test('mergeSettingsJson safely adds stepGlobs without overwriting other user settings', () => {
        const existing = JSON.stringify({
            'editor.formatOnSave': true,
            'files.autoSave': 'afterDelay'
        }, null, 2);

        const newGlobs = ['**/steps/**/*.py', '**/src/steps/**/*.py'];
        const merged = mergeSettingsJson(existing, newGlobs);

        const parsed = JSON.parse(merged);
        assert.strictEqual(parsed['editor.formatOnSave'], true);
        assert.strictEqual(parsed['files.autoSave'], 'afterDelay');
        assert.deepStrictEqual(parsed['gherkinPowerTools.behave.stepGlobs'], newGlobs);
    });

    test('mergeProjectConfigFile safely merges behave.stepGlobs into existing project config', () => {
        const existing = JSON.stringify({
            behave: {
                command: 'behave --tags=@wip'
            },
            linter: {
                enabled: true
            }
        }, null, 2);

        const newGlobs = ['**/steps/**/*.py', '**/custom/steps/**/*.py'];
        const merged = mergeProjectConfigFile(existing, newGlobs);

        const parsed = JSON.parse(merged);
        assert.strictEqual(parsed.behave.command, 'behave --tags=@wip');
        assert.strictEqual(parsed.linter.enabled, true);
        assert.deepStrictEqual(parsed.behave.stepGlobs, newGlobs);
    });

    test('mergeProjectConfigFile retains existing profile and does not overwrite it', () => {
        const existing = JSON.stringify({
            profile: 'legacy',
            behave: {}
        }, null, 2);

        const newGlobs = ['**/steps/**/*.py'];
        const merged = mergeProjectConfigFile(existing, newGlobs);

        const parsed = JSON.parse(merged);
        assert.strictEqual(parsed.profile, 'legacy');
        assert.deepStrictEqual(parsed.behave.stepGlobs, newGlobs);
    });

    test('mergeSettingsJson handles empty or malformed JSON gracefully', () => {
        const newGlobs = ['**/steps/**/*.py'];

        const fromEmpty = mergeSettingsJson('', newGlobs);
        const parsedEmpty = JSON.parse(fromEmpty);
        assert.deepStrictEqual(parsedEmpty['gherkinPowerTools.behave.stepGlobs'], newGlobs);

        const fromMalformed = mergeSettingsJson('{ invalid json', newGlobs);
        const parsedMalformed = JSON.parse(fromMalformed);
        assert.deepStrictEqual(parsedMalformed['gherkinPowerTools.behave.stepGlobs'], newGlobs);
    });

    test('mergeProjectConfigFile handles empty or malformed JSON gracefully and defaults to strict profile', () => {
        const newGlobs = ['**/steps/**/*.py'];

        const fromEmpty = mergeProjectConfigFile('', newGlobs);
        const parsedEmpty = JSON.parse(fromEmpty);
        assert.deepStrictEqual(parsedEmpty.behave.stepGlobs, newGlobs);
        assert.strictEqual(parsedEmpty.profile, 'strict');

        const fromMalformed = mergeProjectConfigFile('{ invalid json', newGlobs);
        const parsedMalformed = JSON.parse(fromMalformed);
        assert.deepStrictEqual(parsedMalformed.behave.stepGlobs, newGlobs);
        assert.strictEqual(parsedMalformed.profile, 'strict');
    });

    test('OnboardingEngine ignores step files matching ignoreGlobs', async () => {
        const folderUri = vscode.Uri.file(tempDir);
        const venvDir = path.join(tempDir, '.venv', 'lib', 'python3.10', 'site-packages', 'pkg', 'steps');
        fs.mkdirSync(venvDir, { recursive: true });
        fs.writeFileSync(path.join(venvDir, 'vendor_steps.py'), '@given("vendor step")\ndef step_impl(context):\n    pass\n');

        const engine = new OnboardingEngine();
        const analysis = await engine.analyzeWorkspaceFolder(folderUri, ['**/features/steps/**/*.py'], ['**/.venv/**']);

        assert.strictEqual(analysis.uncoveredStepFiles.length, 0);
    });
});
