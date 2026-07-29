import * as assert from 'assert';
import { StepAnalyzer } from '../../stepAnalyzer';
import { WorkspaceGraph, StepNode, StepDefNode } from '../../graph';
import { SymbolCache } from '../../cache';
import * as vscode from 'vscode';

suite('StepAnalyzer Test Suite', () => {
    let mockGraph: any;
    let mockSymbolCache: any;

    setup(() => {
        const stepDef1: StepDefNode = {
            id: 'def1', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 10,
            pattern: 'I have {count:d} cucumbers', matcherType: 'parse', pythonFile: 'file:///tests/steps.py', usages: ['step1']
        };
        const stepDef2: StepDefNode = {
            id: 'def2', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 15,
            pattern: 'I have an unused step', matcherType: 'parse', pythonFile: 'file:///tests/steps.py', usages: []
        };
        const stepDef3: StepDefNode = { // Duplicated with def4
            id: 'def3', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 20,
            pattern: 'a duplicated step', matcherType: 're', pythonFile: 'file:///tests/steps.py', usages: ['step2']
        };
        const stepDef4: StepDefNode = {
            id: 'def4', type: 'StepDefinition', uri: 'file:///tests/other_steps.py', line: 5,
            pattern: 'a duplicated step', matcherType: 're', pythonFile: 'file:///tests/other_steps.py', usages: ['step3']
        };
        const stepDef5: StepDefNode = { // Suspiciously similar to def6
            id: 'def5', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 25,
            pattern: 'I open the browser window', matcherType: 'parse', pythonFile: 'file:///tests/steps.py', usages: []
        };
        const stepDef6: StepDefNode = {
            id: 'def6', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 30,
            pattern: 'I open the browser windows', matcherType: 'parse', pythonFile: 'file:///tests/steps.py', usages: []
        };

        const step1: StepNode = {
            id: 'step1', type: 'Step', uri: 'file:///tests/test.feature', line: 5,
            text: 'I have 5 cucumbers', keyword: 'Given', parent: 'scen1', definitionId: 'def1'
        };
        // Ambiguous step matching def3 and def4
        const step2: StepNode = {
            id: 'step2', type: 'Step', uri: 'file:///tests/test.feature', line: 6,
            text: 'a duplicated step', keyword: 'When', parent: 'scen1'
        };

        mockGraph = {
            getAllStepDefNodes: () => [stepDef1, stepDef2, stepDef3, stepDef4, stepDef5, stepDef6],
            getAllStepNodes: () => [step1, step2]
        };

        mockSymbolCache = {
            getStepDefinitions: async (text: string) => {
                if (text === 'a duplicated step') {
                    return [
                        { uri: vscode.Uri.parse('file:///tests/steps.py'), decoratorRange: new vscode.Range(10, 0, 10, 0) }, // Maps to def3 because stepDef3 is at line 20, wait, this mock range line should match the node's line. Let's fix line to 20.
                        { uri: vscode.Uri.parse('file:///tests/other_steps.py'), decoratorRange: new vscode.Range(5, 0, 5, 0) }
                    ];
                }
                return [];
            }
        };

        // Fix mock symbol cache lines
        mockSymbolCache.getStepDefinitions = async (text: string) => {
            if (text === 'a duplicated step') {
                return [
                    { uri: vscode.Uri.parse('file:///tests/steps.py'), decoratorRange: new vscode.Range(20, 0, 20, 0) },
                    { uri: vscode.Uri.parse('file:///tests/other_steps.py'), decoratorRange: new vscode.Range(5, 0, 5, 0) }
                ];
            }
            return [];
        };
    });

    test('Should identify unused steps', async () => {
        const analyzer = new StepAnalyzer(mockGraph as WorkspaceGraph, mockSymbolCache as SymbolCache);
        const result = await analyzer.analyze();

        // def2, def5, def6 are unused
        assert.strictEqual(result.unusedSteps.length, 3);
        const unusedPatterns = result.unusedSteps.map(u => u.stepDef.pattern).sort();
        assert.deepStrictEqual(unusedPatterns, ['I have an unused step', 'I open the browser window', 'I open the browser windows']);
    });

    test('Should identify duplicated implementations', async () => {
        const analyzer = new StepAnalyzer(mockGraph as WorkspaceGraph, mockSymbolCache as SymbolCache);
        const result = await analyzer.analyze();

        assert.strictEqual(result.duplicatedSteps.length, 1);
        assert.strictEqual(result.duplicatedSteps[0].pattern, 'a duplicated step');
        assert.strictEqual(result.duplicatedSteps[0].matcherType, 're');
        assert.strictEqual(result.duplicatedSteps[0].stepDefs.length, 2);
    });

    test('Should identify ambiguous steps', async () => {
        const analyzer = new StepAnalyzer(mockGraph as WorkspaceGraph, mockSymbolCache as SymbolCache);
        const result = await analyzer.analyze();

        assert.strictEqual(result.ambiguousSteps.length, 1);
        assert.strictEqual(result.ambiguousSteps[0].step.text, 'a duplicated step');
        assert.strictEqual(result.ambiguousSteps[0].matchingDefs.length, 2);
    });

    test('Should identify suspiciously similar steps', async () => {
        const analyzer = new StepAnalyzer(mockGraph as WorkspaceGraph, mockSymbolCache as SymbolCache);
        const result = await analyzer.analyze();

        assert.strictEqual(result.suspiciousSimilarities.length, 1);
        const sim = result.suspiciousSimilarities[0];
        // 'window' vs 'windows'
        assert.ok(sim.similarity > 0.85);
        assert.ok((sim.stepDef1.pattern === 'I open the browser window' && sim.stepDef2.pattern === 'I open the browser windows') || 
                  (sim.stepDef2.pattern === 'I open the browser window' && sim.stepDef1.pattern === 'I open the browser windows'));
    });
});
