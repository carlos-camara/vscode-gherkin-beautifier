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
            pattern: 'I have {count:d} cucumbers', matcherType: 'parse', pythonFile: 'file:///tests/steps.py', usages: ['step1'], semanticType: 'given'
        };
        const stepDef2: StepDefNode = {
            id: 'def2', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 15,
            pattern: 'I have an unused step', matcherType: 'parse', pythonFile: 'file:///tests/steps.py', usages: [], semanticType: 'given'
        };
        const stepDef3: StepDefNode = { // Duplicated with def4
            id: 'def3', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 20,
            pattern: 'a duplicated step', matcherType: 're', pythonFile: 'file:///tests/steps.py', usages: ['step2'], semanticType: 'when'
        };
        const stepDef4: StepDefNode = {
            id: 'def4', type: 'StepDefinition', uri: 'file:///tests/other_steps.py', line: 5,
            pattern: 'a duplicated step', matcherType: 're', pythonFile: 'file:///tests/other_steps.py', usages: ['step3'], semanticType: 'when'
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

        const stepDef7: StepDefNode = {
            id: 'def7', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 40,
            pattern: 'an ambiguous step resolved by semantics', matcherType: 'parse', pythonFile: 'file:///tests/steps.py', usages: ['step3'], semanticType: 'given'
        };
        const stepDef8: StepDefNode = {
            id: 'def8', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 45,
            pattern: 'an ambiguous step resolved by semantics', matcherType: 're', pythonFile: 'file:///tests/steps.py', usages: ['step4'], semanticType: 'given'
        };

        const step3: StepNode = {
            id: 'step3', type: 'Step', uri: 'file:///tests/test.feature', line: 7,
            text: 'an ambiguous step resolved by semantics', keyword: 'Given', parent: 'scen1', semanticType: 'given'
        };
        const step4: StepNode = {
            id: 'step4', type: 'Step', uri: 'file:///tests/test.feature', line: 8,
            text: 'an ambiguous step resolved by semantics', keyword: 'Then', parent: 'scen1', semanticType: 'then'
        };

        mockGraph = { currentGeneration: { getAllStepDefNodes: () => [stepDef1, stepDef2, stepDef3, stepDef4, stepDef7, stepDef8],
            getAllStepNodes: () => [step1, step2, step3, step4] } as any } as any;

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
        mockSymbolCache.getStepDefinitions = async (text: string, semanticType?: string) => {
            if (text === 'a duplicated step') {
                return [
                    { uri: vscode.Uri.parse('file:///tests/steps.py'), decoratorRange: new vscode.Range(20, 0, 20, 0) },
                    { uri: vscode.Uri.parse('file:///tests/other_steps.py'), decoratorRange: new vscode.Range(5, 0, 5, 0) }
                ];
            }
            if (text === 'an ambiguous step resolved by semantics') {
                if (semanticType === 'given') {
                    return [{ uri: vscode.Uri.parse('file:///tests/steps.py'), decoratorRange: new vscode.Range(40, 0, 40, 0) }];
                } else if (semanticType === 'then') {
                    return [{ uri: vscode.Uri.parse('file:///tests/steps.py'), decoratorRange: new vscode.Range(45, 0, 45, 0) }];
                }
                // No semanticType provided, it would return both
                return [
                    { uri: vscode.Uri.parse('file:///tests/steps.py'), decoratorRange: new vscode.Range(40, 0, 40, 0) },
                    { uri: vscode.Uri.parse('file:///tests/steps.py'), decoratorRange: new vscode.Range(45, 0, 45, 0) }
                ];
            }
            return [];
        };
    });

    test('Should identify unused steps', async () => {
        const analyzer = new StepAnalyzer(mockGraph as WorkspaceGraph, mockSymbolCache as SymbolCache);
        const result = await analyzer.analyze();

        // def2 is unused
        assert.strictEqual(result.unusedSteps.length, 1);
        const unusedPatterns = result.unusedSteps.map(u => u.stepDef.pattern).sort();
        assert.deepStrictEqual(unusedPatterns, ['I have an unused step']);
    });

    test('Should identify duplicated implementations', async () => {
        const analyzer = new StepAnalyzer(mockGraph as WorkspaceGraph, mockSymbolCache as SymbolCache);
        const result = await analyzer.analyze();

        assert.strictEqual(result.duplicatedSteps.length, 1);
        assert.strictEqual(result.duplicatedSteps[0].pattern, 'a duplicated step');
        assert.strictEqual(result.duplicatedSteps[0].matcherType, 're');
        assert.strictEqual(result.duplicatedSteps[0].stepDefs.length, 2);
    });

    test('Should not identify steps with different semantic types as duplicated', async () => {
        const defGiven: StepDefNode = {
            id: 'def_given', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 100,
            pattern: 'the application is running', matcherType: 'parse', pythonFile: 'file:///tests/steps.py', usages: [], semanticType: 'given'
        };
        const defThen: StepDefNode = {
            id: 'def_then', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 101,
            pattern: 'the application is running', matcherType: 'parse', pythonFile: 'file:///tests/steps.py', usages: [], semanticType: 'then'
        };
        const customGraph = {
            currentGeneration: {
                getAllStepDefNodes: () => [defGiven, defThen],
                getAllStepNodes: () => []
            }
        };
        const analyzer = new StepAnalyzer(customGraph as unknown as WorkspaceGraph, mockSymbolCache as SymbolCache);
        const result = await analyzer.analyze();

        assert.strictEqual(result.duplicatedSteps.length, 0);
    });


    test('Should identify ambiguous steps', async () => {
        const analyzer = new StepAnalyzer(mockGraph as WorkspaceGraph, mockSymbolCache as SymbolCache);
        const result = await analyzer.analyze();

        assert.strictEqual(result.ambiguousSteps.length, 1);
        assert.strictEqual(result.ambiguousSteps[0].step.text, 'a duplicated step');
        assert.strictEqual(result.ambiguousSteps[0].matchingDefs.length, 2);
    });
    test('Should handle case-insensitive URIs when identifying ambiguous steps', async () => {
        const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
        try {
            Object.defineProperty(process, 'platform', { value: 'win32' });
        // Create an ambiguous step where the SymbolCache returns an uppercase URI
        const stepCase: StepNode = {
            id: 'step_case', type: 'Step', uri: 'file:///tests/test.feature', line: 10,
            text: 'a case ambiguous step', keyword: 'When', parent: 'scen1'
        };
        const defCase1: StepDefNode = {
            id: 'def_case1', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 100,
            pattern: 'a case ambiguous step', matcherType: 're', pythonFile: 'file:///tests/steps.py', usages: ['step_case'], semanticType: 'given'
        };
        const defCase2: StepDefNode = {
            id: 'def_case2', type: 'StepDefinition', uri: 'file:///tests/steps.py', line: 105,
            pattern: 'a case ambiguous step', matcherType: 're', pythonFile: 'file:///tests/steps.py', usages: ['step_case'], semanticType: 'given'
        };

        const customMockGraph = {
            currentGeneration: {
                getAllStepDefNodes: () => [defCase1, defCase2],
                getAllStepNodes: () => [stepCase]
            }
        };

        const customMockCache = {
            getStepDefinitions: async (text: string) => {
                if (text === 'a case ambiguous step') {
                    return [
                        // Return uppercase URI which should match the lowercase ones in the graph
                        { uri: vscode.Uri.parse('file:///TESTS/STEPS.PY'), decoratorRange: new vscode.Range(100, 0, 100, 0) },
                        { uri: vscode.Uri.parse('file:///TESTS/STEPS.PY'), decoratorRange: new vscode.Range(105, 0, 105, 0) }
                    ];
                }
                return [];
            }
        };

        const analyzer = new StepAnalyzer(customMockGraph as WorkspaceGraph, customMockCache as SymbolCache);
        const result = await analyzer.analyze();

        assert.strictEqual(result.ambiguousSteps.length, 1);
        assert.strictEqual(result.ambiguousSteps[0].step.text, 'a case ambiguous step');
        assert.strictEqual(result.ambiguousSteps[0].matchingDefs.length, 2);
        } finally {
            if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
        }
    });


    test('Should disambiguate ambiguous steps using semantic type', async () => {
        const analyzer = new StepAnalyzer(mockGraph as WorkspaceGraph, mockSymbolCache as SymbolCache);
        const result = await analyzer.analyze();

        // step3 and step4 are ambiguous by text alone, but with semanticType they should uniquely map
        // so they should NOT appear in ambiguousSteps.
        const ambiguousTexts = result.ambiguousSteps.map(a => a.step.text);
        assert.ok(!ambiguousTexts.includes('an ambiguous step resolved by semantics'));
    });
});
