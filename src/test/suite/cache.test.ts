import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SymbolCache, FeatureCache } from '../../cache';
import { discoveryService } from '../../discovery';
import { astRepository } from '../../ast';

suite('SymbolCache Test Suite', () => {
    let cache: SymbolCache;
    let tempDir: string;

    setup(() => {
        astRepository.clear();
        cache = new SymbolCache();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gherkin-cache-test-'));
    });

    teardown(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('Parses Python step definitions from file', async () => {
        const mockPythonCode = `
@given('I have {count} apples')
def step_impl(context, count):
    """Docstring here"""
    pass

@when(r'I eat (?P<amount>\\d+) apples')
def step_impl_when(context, amount):
    pass
        `;
        
        const tempFile = path.join(tempDir, 'test_steps.py');
        fs.writeFileSync(tempFile, mockPythonCode);

        const uri = vscode.Uri.file(tempFile);
        await cache.updateFile(uri);

        const definitions = await cache.getAllStepDefinitions();
        assert.strictEqual(definitions.length, 2);
        assert.ok(definitions.find(d => d.rawPattern === 'I have {count} apples'));
        assert.ok(definitions.find(d => d.rawPattern === 'I eat (?P<amount>\\d+) apples'));

        // Test matching
        const givenDefs = await cache.getStepDefinitions('I have 5 apples');
        const givenDef = givenDefs[0];
        assert.ok(givenDef);
        assert.strictEqual(givenDef?.documentation, 'Docstring here');
        assert.strictEqual(givenDef?.functionName, 'step_impl');

        const whenDefs = await cache.getStepDefinitions('I eat 2 apples');
        const whenDef = whenDefs[0];
        assert.ok(whenDef);
        assert.strictEqual(whenDef?.functionName, 'step_impl_when');

        const locations = await cache.getStepDefinitions('I have 3 apples');
        assert.strictEqual(locations.length, 1);
        assert.strictEqual(locations[0].uri.toString(), uri.toString());
        assert.strictEqual(locations[0].decoratorRange.start.line, 1);

        // Test multiple ambiguous definitions
        const ambiguousCode = `
@given('I have 10 apples')
def specific(context): pass

@given(r'I have \\d+ apples')
def general(context): pass
        `;
        const ambigFile = path.join(tempDir, 'ambig.py');
        fs.writeFileSync(ambigFile, ambiguousCode);
        await cache.updateFile(vscode.Uri.file(ambigFile));

        const multipleDefs = await cache.getStepDefinitions('I have 10 apples');
        assert.strictEqual(multipleDefs.length, 2, 'Should return both matching definitions');
    });

    test('Removes file from cache', async () => {
        const tempFile = path.join(tempDir, 'remove.py');
        fs.writeFileSync(tempFile, `@given('A step')\ndef step_impl():\n  pass`);
        
        const uri = vscode.Uri.file(tempFile);
        await cache.updateFile(uri);
        
        assert.strictEqual((await cache.getAllStepDefinitions()).length, 1);
        
        cache.removeFile(uri);
        assert.strictEqual((await cache.getAllStepDefinitions()).length, 0);
    });

    test('Handles read errors gracefully', async () => {
        const uri = vscode.Uri.file(path.join(tempDir, 'non_existent.py'));
        
        // Pre-populate so we can see it gets removed
        (cache as any).cache.set(uri.toString(), [{ patternText: 'A step' }]);
        
        // This should trigger the catch block and call removeFile
        await cache.updateFile(uri);
        
        assert.strictEqual((await cache.getAllStepDefinitions()).length, 0);
    });

    test('Handles invalid regex compilation gracefully', async () => {
        const mockPythonCode = `
@given(r'(?P<amount>\\d+)(')
def step_impl(context):
    pass
        `;
        
        const tempFile = path.join(tempDir, 'invalid_regex.py');
        fs.writeFileSync(tempFile, mockPythonCode);

        const uri = vscode.Uri.file(tempFile);
        await cache.updateFile(uri);

        const definitions = await cache.getAllStepDefinitions();
        assert.strictEqual(definitions.length, 1);
        
        const def = definitions[0];
        assert.strictEqual(def.evaluable, false);
        assert.ok(def.compilationError);
        assert.strictEqual(def.rawPattern, '(?P<amount>\\d+)(');

        // Should not match anything because evaluable is false
        const matches = await cache.getStepDefinitions('(?P<amount>\\d+)(');
        const match = matches[0];
        assert.strictEqual(match, undefined);
    });


    test('Filters step definitions by semantic type', async () => {
        const semanticCode = `
@given('I log in')
def given_login(context): pass

@when('I log in')
def when_login(context): pass

@then('I log in')
def then_login(context): pass

@step('a generic step')
def generic_step(context): pass
        `;
        const tempFile = path.join(tempDir, 'semantic.py');
        fs.writeFileSync(tempFile, semanticCode);
        await cache.updateFile(vscode.Uri.file(tempFile));

        // Search with no semantic type (matches everything)
        assert.strictEqual((await cache.getStepDefinitions('I log in')).length, 3);
        
        // Search with specific semantic types
        const givenDefs = await cache.getStepDefinitions('I log in', 'given');
        assert.strictEqual(givenDefs.length, 1);
        assert.strictEqual(givenDefs[0].type, 'given');
        
        const whenDefs = await cache.getStepDefinitions('I log in', 'when');
        assert.strictEqual(whenDefs.length, 1);
        assert.strictEqual(whenDefs[0].type, 'when');
        
        const thenDefs = await cache.getStepDefinitions('I log in', 'then');
        assert.strictEqual(thenDefs.length, 1);
        assert.strictEqual(thenDefs[0].type, 'then');

        // Generic @step matches anything
        assert.strictEqual((await cache.getStepDefinitions('a generic step', 'given')).length, 1);
        assert.strictEqual((await cache.getStepDefinitions('a generic step', 'when')).length, 1);
        assert.strictEqual((await cache.getStepDefinitions('a generic step', 'then')).length, 1);
        assert.strictEqual((await cache.getStepDefinitions('a generic step', 'step')).length, 1);
    });


    test('Handles multiline function signatures and docstrings', async () => {
        const mockPythonCode = `
@then('I have multi')
def step_impl(
    context,
    arg1,
    arg2
):
    '''
    Line 1
    Line 2
    '''
    pass
        `;
        const tempFile = path.join(tempDir, 'multi.py');
        fs.writeFileSync(tempFile, mockPythonCode);
        
        const uri = vscode.Uri.file(tempFile);
        await cache.updateFile(uri);
        
        const defs = await cache.getStepDefinitions('I have multi');
        const def = defs[0];
        assert.ok(def);
        assert.strictEqual(def?.functionName, 'step_impl');
        assert.ok(def?.documentation?.includes('Line 1'));
        assert.ok(def?.documentation?.includes('Line 2'));
    });

    test('Initializes cache from workspace files', async () => {
        const originalGetStepFiles = discoveryService.getStepFiles.bind(discoveryService);
        discoveryService.getStepFiles = async () => [];
        
        // We can't easily mock vscode.workspace.findFiles, but we can verify 
        // that calling initialize() doesn't crash and sets state.
        const p1 = cache.ensureInitialized();
        assert.strictEqual(cache.state, 'initializing');
        
        // Multiple simultaneous calls should return the same promise
        const p2 = cache.ensureInitialized();
        assert.strictEqual(p1, p2, 'Multiple initialize calls should return the exact same promise instance');
        
        await p1;
        assert.strictEqual(cache.state, 'ready');
        
        // Calling it again after ready should also return the resolved promise
        const p3 = cache.ensureInitialized();
        assert.strictEqual(p1, p3);

        discoveryService.getStepFiles = originalGetStepFiles;
    });

    test('Tag Blast Radius: Handles inherited tags from Feature and multiplies by Examples', async () => {
        const featureCache = new FeatureCache();
        const featurePath = path.join(tempDir, 'tags.feature');
        const content = `
@regression
Feature: Blast Radius
  @smoke
  Scenario: Simple Scenario
    Given step

  Scenario Outline: Outline with Examples
    Given step <param>
    Examples:
      | param |
      | 1     |
      | 2     |
      | 3     |
        `;
        fs.writeFileSync(featurePath, content);
        await featureCache.updateFile(vscode.Uri.file(featurePath));
        
        // Feature has @regression, which is inherited by 1 Scenario + 1 Outline (3 examples) = 4 total
        assert.strictEqual(await featureCache.getTagBlastRadius('@regression'), 4, '@regression should inherit down to all 4 executable scenarios');
        
        // @smoke is only on the Simple Scenario
        assert.strictEqual(await featureCache.getTagBlastRadius('@smoke'), 1, '@smoke should only affect 1 scenario');
    });

    test('FeatureCache: Handles Rule tags, empty Example tables, and incremental updates', async () => {
        const featureCache = new FeatureCache();
        const featurePath = path.join(tempDir, 'rules.feature');
        const content = `
@feature_tag
Feature: Rule Feature
  @rule_tag
  Rule: Rule 1
    @scenario_tag
    Scenario: Rule Scenario
      Given step

    Scenario Outline: Empty Outline
      Given step <param>
      Examples:
        | param |
        `;
        fs.writeFileSync(featurePath, content);
        const uri = vscode.Uri.file(featurePath);

        await featureCache.updateFile(uri);

        assert.strictEqual(await featureCache.getTagBlastRadius('@feature_tag'), 2);
        assert.strictEqual(await featureCache.getTagBlastRadius('@rule_tag'), 2);
        assert.strictEqual(await featureCache.getTagBlastRadius('@scenario_tag'), 1);

        // Incremental update: modify content and remove @scenario_tag
        const content2 = `
@feature_tag
Feature: Rule Feature
  Scenario: Updated Scenario
    Given step
        `;
        fs.writeFileSync(featurePath, content2);
        astRepository.clear(); // Clear to simulate actual workspace event bus invalidation
        await featureCache.updateFile(uri);

        assert.strictEqual(await featureCache.getTagBlastRadius('@feature_tag'), 1);
        assert.strictEqual(await featureCache.getTagBlastRadius('@scenario_tag'), 0);
    });

    test('FeatureCache: Handles AST parse throw and preserves partial state', async () => {
        const featureCache = new FeatureCache();
        const uri = vscode.Uri.file(path.join(tempDir, 'parse_throw.feature'));
        fs.writeFileSync(uri.fsPath, '@valid_tag\nFeature: Valid\n  Scenario: S1\n    Given step');

        await featureCache.updateFile(uri);
        assert.strictEqual(await featureCache.getTagBlastRadius('@valid_tag'), 1);

        // Update with non-feature content
        fs.writeFileSync(uri.fsPath, 'Just some garbage');
        astRepository.clear();
        await featureCache.updateFile(uri);

        const state = featureCache.getFileState(uri);
        assert.strictEqual(state?.status, 'partial');
    });

    test('AST Fallback: Retains data even with severe syntax errors and marks partial', async () => {
        const featureCache = new FeatureCache();
        const featurePath = path.join(tempDir, 'syntax_error.feature');
        const content = `
@salvaged
Feature: Fallback Test
  Background:
    Given step
  Background:
    Given step
  Scenario: Broken Scenario
    Given step
        `;
        fs.writeFileSync(featurePath, content);
        
        await featureCache.updateFile(vscode.Uri.file(featurePath));
        
        assert.strictEqual(await featureCache.getTagBlastRadius('@salvaged'), 1, 'Tags should still be parsed via AST fallback');
        
        const state = featureCache.getFileState(vscode.Uri.file(featurePath));
        assert.strictEqual(state?.status, 'partial', 'State should be partial when parsing encounters an error');
        assert.strictEqual(await featureCache.hasStaleOrPartialFilesForTag('@salvaged'), true, 'Should report stale/partial for the tag');
    });

    test('FeatureCache: Uses unsaved open document text instead of disk', async () => {
        const featureCache = new FeatureCache();
        const uri = vscode.Uri.file(path.join(tempDir, 'unsaved.feature'));
        
        // Write old content to disk
        fs.writeFileSync(uri.fsPath, '@old\nFeature: old\n  Scenario: old scenario\n    Given step');

        // Mock vscode.workspace.textDocuments to return unsaved content
        const originalTextDocuments = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');
        Object.defineProperty(vscode.workspace, 'textDocuments', {
            get: () => [{
                uri: uri,
                getText: () => '@new\nFeature: new\n  Scenario: new scenario\n    Given step'
            }]
        });

        await featureCache.updateFile(uri);

        // Restore mock immediately
        if (originalTextDocuments) {
            Object.defineProperty(vscode.workspace, 'textDocuments', originalTextDocuments);
        }

        assert.strictEqual(await featureCache.getTagBlastRadius('@old'), 0, 'Should not use disk content');
        assert.strictEqual(await featureCache.getTagBlastRadius('@new'), 1, 'Should use unsaved document content');
    });

    test('FeatureCache: Handles non-file remote URIs', async () => {
        const featureCache = new FeatureCache();
        const uri = vscode.Uri.parse('vscode-vfs://github/repo/remote.feature');
        
        // We simulate reading this by mocking textDocuments
        const originalTextDocuments = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');
        Object.defineProperty(vscode.workspace, 'textDocuments', {
            get: () => [{
                uri: uri,
                getText: () => '@remote\nFeature: Remote FS\n  Scenario: remote\n    Given step'
            }]
        });

        await featureCache.updateFile(uri);

        if (originalTextDocuments) {
            Object.defineProperty(vscode.workspace, 'textDocuments', originalTextDocuments);
        }

        assert.strictEqual(await featureCache.getTagBlastRadius('@remote'), 1, 'Should handle custom URI schemes');
    });

    test('FeatureCache: Debounces rapid concurrent update requests for the same URI', async () => {
        const featureCache = new FeatureCache();
        const uri = vscode.Uri.file(path.join(tempDir, 'debounce.feature'));
        fs.writeFileSync(uri.fsPath, '@fast\nFeature: fast\n  Scenario: fast\n    Given step');

        // Fire 3 updates rapidly without awaiting the first 2
        const p1 = featureCache.updateFile(uri);
        const p2 = featureCache.updateFile(uri);
        const p3 = featureCache.updateFile(uri);

        await Promise.all([p1, p2, p3]);

        assert.strictEqual(await featureCache.getTagBlastRadius('@fast'), 1, 'Debounce should coalesce updates to 1');
    });

    test('FeatureCache: Retains stale data on temporary read failure', async () => {
        const featureCache = new FeatureCache();
        const uri = vscode.Uri.file(path.join(tempDir, 'missing.feature'));
        
        // First successful pass via mock
        const originalTextDocuments = Object.getOwnPropertyDescriptor(vscode.workspace, 'textDocuments');
        Object.defineProperty(vscode.workspace, 'textDocuments', {
            get: () => [{
                uri: uri,
                getText: () => '@retained\nFeature: Retained\n  Scenario: retained\n    Given step'
            }]
        });
        await featureCache.updateFile(uri);

        // Remove mock and file does not exist on disk
        if (originalTextDocuments) {
            Object.defineProperty(vscode.workspace, 'textDocuments', originalTextDocuments);
        }

        // Second pass fails to read
        await featureCache.updateFile(uri);

        assert.strictEqual(await featureCache.getTagBlastRadius('@retained'), 1, 'Should keep old data when read fails');
        assert.strictEqual(featureCache.getFileState(uri)?.status, 'stale', 'Status should be stale');
    });

    test('FeatureCache: Removes data incrementally on delete', async () => {
        const featureCache = new FeatureCache();
        const uri = vscode.Uri.file(path.join(tempDir, 'deleted.feature'));
        fs.writeFileSync(uri.fsPath, '@del\nFeature: delete me\n  Scenario: del\n    Given step');
        
        await featureCache.updateFile(uri);
        assert.strictEqual(await featureCache.getTagBlastRadius('@del'), 1);

        featureCache.removeFile(uri);
        assert.strictEqual(await featureCache.getTagBlastRadius('@del'), 0, 'Should decrement global tags');
        assert.strictEqual(featureCache.getFileState(uri), undefined);
    });

    test('FeatureCache: removeFile cancels pending debounce updates', async () => {
        const featureCache = new FeatureCache();
        const uri = vscode.Uri.file(path.join(tempDir, 'cancel_debounce.feature'));
        fs.writeFileSync(uri.fsPath, '@pending\nFeature: pending\n  Scenario: p\n    Given step');
        
        // Trigger an update but immediately remove it before debounce fires
        const p = featureCache.updateFile(uri);
        featureCache.removeFile(uri);

        await p;

        // Since it was removed, the file state should be completely empty/undefined, and tag count 0
        assert.strictEqual(await featureCache.getTagBlastRadius('@pending'), 0);
        assert.strictEqual(featureCache.getFileState(uri), undefined);
    });

    test('FeatureCache: hasStaleOrPartialFilesForTag returns false if no such files exist', async () => {
        const featureCache = new FeatureCache();
        const uri = vscode.Uri.file(path.join(tempDir, 'healthy.feature'));
        fs.writeFileSync(uri.fsPath, '@healthy\nFeature: healthy\n  Scenario: h\n    Given step');
        
        await featureCache.updateFile(uri);
        
        // File is healthy ('current')
        assert.strictEqual(featureCache.getFileState(uri)?.status, 'current');
        assert.strictEqual(await featureCache.hasStaleOrPartialFilesForTag('@healthy'), false);
    });
});

