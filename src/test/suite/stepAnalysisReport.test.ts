import * as assert from 'assert';
import { getReportHtml } from '../../stepAnalysisReport';
import { StepDefNode, StepNode } from '../../graph';

suite('StepAnalysisReport Test Suite', () => {

    test('getReportHtml generates correct empty state', () => {
        const result = {
            totalStepDefs: 0,
            unusedSteps: [],
            duplicatedSteps: [],
            ambiguousSteps: [],
            suspiciousSimilarities: []
        };
        const html = getReportHtml(result);

        assert.ok(html.includes('0</div>'));
        assert.ok(html.includes('No unused step definitions found!'));
        assert.ok(html.includes('No duplicated step definitions found!'));
        assert.ok(html.includes('No ambiguous step usages found'));
        assert.ok(html.includes('No suspiciously similar step definitions found!'));
    });

    test('getReportHtml generates correct HTML for unused steps', () => {
        const def1: StepDefNode = { id: '1', type: 'StepDefinition', uri: 'file:///a/file1.py', line: 10, pattern: 'test <pattern>', matcherType: 'parse', pythonFile: 'file:///a/file1.py', usages: [] };
        const def2: StepDefNode = { id: '2', type: 'StepDefinition', uri: 'file:///a/file1.py', line: 20, pattern: 'another test', matcherType: 're', pythonFile: 'file:///a/file1.py', usages: [] };
        const def3: StepDefNode = { id: '3', type: 'StepDefinition', uri: 'file:///b/file2.py', line: 5, pattern: 'file2 test', matcherType: 'parse', pythonFile: 'file:///b/file2.py', usages: [] };

        const result = {
            totalStepDefs: 3,
            unusedSteps: [{ stepDef: def1 }, { stepDef: def2 }, { stepDef: def3 }],
            duplicatedSteps: [],
            ambiguousSteps: [],
            suspiciousSimilarities: []
        };
        const html = getReportHtml(result);

        // Check if files are grouped correctly (file1.py should appear once in group header, with count 2)
        assert.ok(html.includes("onclick=\"openFile('file:///a/file1.py', 0)\">file1.py</a>"));
        assert.ok(html.match(/<span class="badge badge-count">2 steps<\/span>/));

        // file2.py should appear with count 1
        assert.ok(html.includes("onclick=\"openFile('file:///b/file2.py', 0)\">file2.py</a>"));
        assert.ok(html.match(/<span class="badge badge-count">1 steps<\/span>/));

        // Check HTML escaping for 'test <pattern>' -> 'test &lt;pattern&gt;'
        assert.ok(html.includes('test &lt;pattern&gt;'));

        // Check that 're' matcher badge exists
        assert.ok(html.includes('<span class="badge badge-keyword">re</span>'));
    });

    test('getReportHtml generates correct HTML for duplicated steps', () => {
        const def1: StepDefNode = { id: '1', type: 'StepDefinition', uri: 'file:///a/file1.py', line: 10, pattern: 'dup test', matcherType: 'parse', pythonFile: 'file:///a/file1.py', usages: [] };
        const def2: StepDefNode = { id: '2', type: 'StepDefinition', uri: 'file:///b/file2.py', line: 20, pattern: 'dup test', matcherType: 'parse', pythonFile: 'file:///b/file2.py', usages: [] };
        
        const result = {
            totalStepDefs: 2,
            unusedSteps: [],
            duplicatedSteps: [{ pattern: 'dup test', matcherType: 'parse', stepDefs: [def1, def2] }],
            ambiguousSteps: [],
            suspiciousSimilarities: []
        };
        const html = getReportHtml(result);

        assert.ok(html.includes('dup test'));
        assert.ok(html.includes("onclick=\"openFile('file:///a/file1.py', 10)\""));
        assert.ok(html.includes("onclick=\"openFile('file:///b/file2.py', 20)\""));
        assert.ok(html.includes('Implemented in multiple locations:'));
    });

    test('getReportHtml generates correct HTML for ambiguous steps', () => {
        const step: StepNode = { id: 's1', type: 'Step', uri: 'file:///a/test.feature', line: 5, text: 'dup test', keyword: 'Given ', parent: 'scen1' };
        const def1: StepDefNode = { id: '1', type: 'StepDefinition', uri: 'file:///a/file1.py', line: 10, pattern: 'dup test', matcherType: 'parse', pythonFile: 'file:///a/file1.py', usages: [] };
        
        const result = {
            totalStepDefs: 1,
            unusedSteps: [],
            duplicatedSteps: [],
            ambiguousSteps: [{ step, matchingDefs: [def1, def1] }],
            suspiciousSimilarities: []
        };
        const html = getReportHtml(result);

        // Check keyword stripping/formatting
        assert.ok(html.includes('<span class="badge badge-keyword">Given</span>'));
        assert.ok(html.includes("onclick=\"openFile('file:///a/test.feature', 5)\""));
        assert.ok(html.includes('Matches 2 definitions:'));
    });

});
