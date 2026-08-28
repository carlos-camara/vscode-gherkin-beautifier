import * as assert from 'assert';
import * as vscode from 'vscode';
import { CompletionContextCache } from '../../completion';

suite('Completion Hot Path Benchmark', function () {
    this.timeout(20000); // 20s timeout for large benchmarks
    
    // Helper to generate a dummy gherkin document
    function generateGherkin(linesCount: number): string {
        let content = '@ui @fast\nFeature: Benchmark Feature\n\n';
        const linesPerScenario = 5;
        const scenarios = Math.floor((linesCount - 3) / linesPerScenario);
        
        for (let i = 0; i < scenarios; i++) {
            content += `  @scenario_${i}\n`;
            content += `  Scenario: Benchmark Scenario ${i}\n`;
            content += `    Given I have ${i} apples\n`;
            content += `    When I eat 1 apple\n`;
            content += `    Then I should have ${i - 1} apples\n\n`;
        }
        return content;
    }
    
    class MockTextDocument {
        public uri: vscode.Uri;
        public version: number;
        public lineCount: number;
        private content: string;
        private lines: string[];

        constructor(uriStr: string, version: number, content: string) {
            this.uri = vscode.Uri.file(uriStr);
            this.version = version;
            this.content = content;
            this.lines = content.split('\n');
            this.lineCount = this.lines.length;
        }

        getText(): string {
            return this.content;
        }

        lineAt(line: number): { text: string } {
            return { text: this.lines[line] || '' };
        }
    }

    const stepRegex = new RegExp(`^(\\s*(?:Given |When |Then |And |But |\\* ))`);

    async function runBenchmark(lines: number, iterations: number) {
        const text = generateGherkin(lines);
        const doc = new MockTextDocument(`/test-${lines}.feature`, 1, text) as unknown as vscode.TextDocument;
        
        const cache = new CompletionContextCache();

        // Warm up / build initial snapshot
        await cache.getSnapshot(doc, stepRegex);

        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const start = process.hrtime.bigint();
            
            // Simulating a keystroke asking for completion context
            await cache.getSnapshot(doc, stepRegex);
            
            const end = process.hrtime.bigint();
            latencies.push(Number(end - start) / 1000000); // ms
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.50)];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];

        console.log(`\nBenchmark: ${lines} lines, ${iterations} iterations`);
        console.log(`  p50 latency: ${p50.toFixed(4)} ms`);
        console.log(`  p95 latency: ${p95.toFixed(4)} ms`);
        
        // Assertions just to make it a valid passing test
        assert.ok(p50 < 50, `p50 should be < 50ms, got ${p50}ms`);
    }

    test('Benchmark 100 lines', async () => {
        await runBenchmark(100, 100);
    });

    test('Benchmark 1,000 lines', async () => {
        await runBenchmark(1000, 100);
    });

    test('Benchmark 10,000 lines', async () => {
        // Lower iterations to prevent OOM in test runner
        await runBenchmark(10000, 10);
    });
});
