import * as assert from 'assert';
import * as vscode from 'vscode';
import { WorkspaceGraph, StepDefNode, FeatureNode, ScenarioNode, StepNode } from '../../graph';
import { SymbolCache } from '../../cache';
import { ImpactCodeLensProvider } from '../../impactCodeLens';

suite('ImpactCodeLensProvider Test Suite', () => {
    let graph: WorkspaceGraph;
    let symbolCache: SymbolCache;
    let provider: ImpactCodeLensProvider;

    setup(() => {
        symbolCache = new SymbolCache();
        graph = new WorkspaceGraph(symbolCache);
        provider = new ImpactCodeLensProvider(graph);
    });

    teardown(() => {
        graph.dispose();
        symbolCache.dispose();
    });

    test('refresh() should fire onDidChangeCodeLenses event', (done) => {
        const disposable = provider.onDidChangeCodeLenses(() => {
            disposable.dispose();
            done();
        });
        provider.refresh();
    });

    test('provideCodeLenses should return empty array if impactAnalysis is disabled', async () => {
        // Mock vscode configuration to return false for enabled
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        let configKey = '';
        Object.defineProperty(vscode.workspace, 'getConfiguration', {
            value: (section: string) => {
                return {
                    get: (key: string, _defaultValue: any) => {
                        configKey = `${section}.${key}`;
                        return false;
                    }
                };
            },
            writable: true
        });

        try {
            const doc = await vscode.workspace.openTextDocument({ content: '@given("test")\ndef step():\n  pass\n', language: 'python' });
            const lenses = provider.provideCodeLenses(doc, new vscode.CancellationTokenSource().token);
            assert.strictEqual(lenses.length, 0);
            assert.strictEqual(configKey, 'gherkinPowerTools.impactAnalysis.enabled');
        } finally {
            Object.defineProperty(vscode.workspace, 'getConfiguration', { value: originalGetConfiguration, writable: true });
        }
    });

    test('provideCodeLenses should return empty array if no step defs match the URI', async () => {
        const doc = await vscode.workspace.openTextDocument({ content: '@given("test")\ndef step():\n  pass\n', language: 'python' });
        // The graph is empty, so no defs match
        const lenses = provider.provideCodeLenses(doc, new vscode.CancellationTokenSource().token);
        assert.strictEqual(lenses.length, 0);
    });

    test('provideCodeLenses should return correct lenses based on impact severity', async () => {
        const content = `@given("test1")\ndef step1(): pass\n\n@when("test2")\ndef step2(): pass\n`;
        const doc = await vscode.workspace.openTextDocument({ content, language: 'python' });
        const uriStr = doc.uri.toString();

        // Add nodes to graph
        const defNode1: StepDefNode = { id: 'def1', type: 'StepDefinition', uri: uriStr, line: 0, pattern: 'test1', matcherType: 'given', pythonFile: uriStr, usages: ['step1'] };
        const defNode2: StepDefNode = { id: 'def2', type: 'StepDefinition', uri: uriStr, line: 3, pattern: 'test2', matcherType: 'when', pythonFile: uriStr, usages: [] };
        
        const featureNode: FeatureNode = { id: 'f1', type: 'Feature', uri: 'file:///test.feature', line: 1, children: ['s1'], tags: [], name: 'Feature 1' };
        const scNode1: ScenarioNode = { id: 's1', type: 'Scenario', uri: 'file:///test.feature', line: 5, steps: ['step1'], examples: [], tags: [], parent: 'f1', name: 'Scenario 1' };
        const step1: StepNode = { id: 'step1', type: 'Step', uri: 'file:///test.feature', line: 6, text: 'test1', parent: 's1', keyword: 'Given', definitionId: 'def1' };

        // Inject into graph
        graph.setNodeForTest(defNode1 as any);
        graph.setNodeForTest(defNode2 as any);
        graph.setNodeForTest(featureNode as any);
        graph.setNodeForTest(scNode1 as any);
        graph.setNodeForTest(step1 as any);


        // Force enable setting
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        Object.defineProperty(vscode.workspace, 'getConfiguration', {
            value: () => ({ get: () => true }),
            writable: true
        });

        try {
            const lenses = provider.provideCodeLenses(doc, new vscode.CancellationTokenSource().token);
            assert.strictEqual(lenses.length, 2);

            // test1 should have Low impact (1 scenario)
            const lens1 = lenses.find(l => l.range.start.line === 0);
            assert.ok(lens1);
            const resolvedLens1 = provider.resolveCodeLens(lens1, new vscode.CancellationTokenSource().token);
            assert.strictEqual(resolvedLens1?.command?.title, 'Impact: Low (1 Scenario)');
            assert.strictEqual(resolvedLens1?.command?.command, 'gherkinPowerTools.showImpactDetails');
            assert.ok(resolvedLens1?.command?.arguments && resolvedLens1.command.arguments.length > 0);

            // test2 should be Unused
            const lens2 = lenses.find(l => l.range.start.line === 3);
            assert.ok(lens2);
            const resolvedLens2 = provider.resolveCodeLens(lens2, new vscode.CancellationTokenSource().token);
            assert.strictEqual(resolvedLens2?.command?.title, 'Impact: Unused');
        } finally {
            Object.defineProperty(vscode.workspace, 'getConfiguration', { value: originalGetConfiguration, writable: true });
        }
    });

    test('provideCodeLenses should handle plural scenarios (Medium impact)', async () => {
        const content = `@given("test3")\ndef step3(): pass\n`;
        const doc = await vscode.workspace.openTextDocument({ content, language: 'python' });
        const uriStr = doc.uri.toString();

        const defNode: StepDefNode = { id: 'def3', type: 'StepDefinition', uri: uriStr, line: 0, pattern: 'test3', matcherType: 'given', pythonFile: uriStr, usages: ['step1', 'step2', 'step3', 'step4', 'step5'] };
        const featureNode: FeatureNode = { id: 'f1', type: 'Feature', uri: 'file:///test.feature', line: 1, children: ['s1', 's2', 's3', 's4', 's5'], tags: [], name: 'Feature 1' };
        
        graph.setNodeForTest(defNode as any);
        graph.setNodeForTest(featureNode as any);

        for (let i = 1; i <= 5; i++) {
            const scNode: ScenarioNode = { id: `s${i}`, type: 'Scenario', uri: 'file:///test.feature', line: i * 5, steps: [`step${i}`], examples: [], tags: [], parent: 'f1', name: `Scenario ${i}` };
            const stepNode: StepNode = { id: `step${i}`, type: 'Step', uri: 'file:///test.feature', line: i * 5 + 1, text: 'test3', parent: `s${i}`, keyword: 'Given', definitionId: 'def3' };
            graph.setNodeForTest(scNode as any);
            graph.setNodeForTest(stepNode as any);
        }

        const originalGetConfiguration = vscode.workspace.getConfiguration;
        Object.defineProperty(vscode.workspace, 'getConfiguration', {
            value: () => ({ get: () => true }),
            writable: true
        });

        try {
            const lenses = provider.provideCodeLenses(doc, new vscode.CancellationTokenSource().token);
            assert.strictEqual(lenses.length, 1);
            
            const lens = lenses[0];
            const resolvedLens = provider.resolveCodeLens(lens, new vscode.CancellationTokenSource().token);
            assert.strictEqual(resolvedLens?.command?.title, 'Impact: Medium (5 Scenarios)');
        } finally {
            Object.defineProperty(vscode.workspace, 'getConfiguration', { value: originalGetConfiguration, writable: true });
        }
    });

});
