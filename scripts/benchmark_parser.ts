import * as fs from 'fs';
import * as path from 'path';
import { performance, monitorEventLoopDelay } from 'perf_hooks';

const fixtures: Record<string, string> = {};

function generateFixtures() {
    console.log('Generating deterministic fixtures in memory...');

    // 100 Scenarios
    let scenarios100 = 'Feature: 100 Scenarios\n';
    for (let i = 0; i < 100; i++) {
        scenarios100 += `\n  Scenario: Scenario ${i}\n    Given a step\n    When an action\n    Then an outcome\n`;
    }
    fixtures['100_scenarios'] = scenarios100;

    // 1000 Scenarios
    let scenarios1000 = 'Feature: 1000 Scenarios\n';
    for (let i = 0; i < 1000; i++) {
        scenarios1000 += `\n  Scenario: Scenario ${i}\n    Given a step\n    When an action\n    Then an outcome\n`;
    }
    fixtures['1000_scenarios'] = scenarios1000;

    // 10000 Scenarios
    let scenarios10000 = 'Feature: 10000 Scenarios\n';
    for (let i = 0; i < 10000; i++) {
        scenarios10000 += `\n  Scenario: Scenario ${i}\n    Given a step\n    When an action\n    Then an outcome\n`;
    }
    fixtures['10000_scenarios'] = scenarios10000;

    // Large Examples Table
    let largeExamples = 'Feature: Large Examples\n  Scenario Outline: Large\n    Given <param>\n  Examples:\n    | param |\n';
    for (let i = 0; i < 5000; i++) {
        largeExamples += `    | val${i} |\n`;
    }
    fixtures['large_examples'] = largeExamples;

    // Very large data tables
    let largeDataTable = 'Feature: Data Table\n  Scenario: Table\n    Given the table:\n';
    for (let i = 0; i < 5000; i++) {
        largeDataTable += `      | row${i}col1 | row${i}col2 | row${i}col3 |\n`;
    }
    fixtures['large_data_tables'] = largeDataTable;

    // Large Docstrings (1MB)
    const largeText = 'A'.repeat(1024 * 1024);
    fixtures['large_docstrings'] = `Feature: Docstring\n  Scenario: string\n    Given a docstring:\n      """\n${largeText}\n      """\n`;

    // Malformed EOF
    fixtures['malformed_eof'] = scenarios10000 + '\n  Scenario: Broken scenario\n    Given something\n    When'; // unexpected eof

    // Very long lines
    const longLine = 'a '.repeat(5000);
    fixtures['long_lines'] = `Feature: Long lines\n  Scenario: Long\n    Given ${longLine}\n    When ${longLine}\n`;

    // Multiple dialects
    let multiDialect = '# language: es\nCaracterística: Español\n  Escenario: Hola\n    Dado un paso\n    Cuando una acción\n    Entonces un resultado\n';
    multiDialect += '\n# language: fr\nFonctionnalité: Francais\n  Scénario: Bonjour\n    Soit une étape\n';
    fixtures['multiple_dialects'] = multiDialect;
    
    console.log('Fixtures generated.');
}

async function runBenchmarks() {
    generateFixtures();

    console.log('\n--- MODULE LOAD BENCHMARK ---');
    let loadStart = performance.now();
    const gherkin = require('@cucumber/gherkin');
    const messages = require('@cucumber/messages');
    let loadEnd = performance.now();
    console.log(`Cold Module Load: ${(loadEnd - loadStart).toFixed(2)}ms`);
    
    loadStart = performance.now();
    require('@cucumber/gherkin');
    require('@cucumber/messages');
    loadEnd = performance.now();
    console.log(`Warm Module Load: ${(loadEnd - loadStart).toFixed(2)}ms`);

    console.log('\n--- PARSING BENCHMARKS ---');
    console.log('Fixture | Size (KB) | Parse Time (ms) | Event Loop Delay (ms) | Heap Delta (MB)');
    console.log('---|---|---|---|---');

    for (const [name, content] of Object.entries(fixtures)) {
        const sizeKb = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(1);
        
        // Setup parser
        const uuidFn = messages.IdGenerator.uuid();
        const builder = new gherkin.AstBuilder(uuidFn);
        const matcher = new gherkin.GherkinClassicTokenMatcher();
        const parser = new gherkin.Parser(builder, matcher);
        
        // Setup monitors
        const monitor = monitorEventLoopDelay({ resolution: 1 });
        monitor.enable();
        global.gc && global.gc(); // force GC if available
        const heapBefore = process.memoryUsage().heapUsed;
        
        const start = performance.now();
        try {
            parser.parse(content);
        } catch(e) {
            // Expected for malformed
        }
        const end = performance.now();
        
        const heapAfter = process.memoryUsage().heapUsed;
        monitor.disable();
        
        const parseTime = (end - start).toFixed(2);
        const elDelay = (monitor.max / 1e6).toFixed(2); // ns to ms
        const heapDelta = ((heapAfter - heapBefore) / (1024 * 1024)).toFixed(2);
        
        console.log(`${name} | ${sizeKb} | ${parseTime} | ${elDelay} | ${heapDelta}`);
    }

    console.log('\n--- CANCELLATION SEMANTICS ---');
    console.log('The @cucumber/gherkin parse() method is fully synchronous.');
    console.log('Once invoked, it iterates the token stream in a while-loop internally, blocking the Node.js event loop.');
    console.log('It is NOT natively cancellable. Attempting to interrupt it requires either a Worker Thread or terminating the host process.');
}

runBenchmarks().catch(console.error);
