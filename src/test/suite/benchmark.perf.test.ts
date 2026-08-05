import { WorkspaceGraph } from '../../graph';
import { ImpactCodeLensProvider } from '../../impactCodeLens';
import * as vscode from 'vscode';
import { SymbolCache } from '../../cache';

const suiteOrSkip = process.env.RUN_BENCHMARKS === 'true' ? suite : suite.skip;

suiteOrSkip('CodeLens Performance Benchmarks', function () {
    this.timeout(60000);

    const generateGraph = (stepCount: number, scenarioCount: number) => {
        const symbolCache = new SymbolCache();
        const graph = new WorkspaceGraph(symbolCache);
        
        // Mock nodes directly
        const nodes = (graph as any).nodes as Map<string, any>;
        
        // Generate Scenarios
        for (let i = 0; i < scenarioCount; i++) {
            nodes.set(`Scenario:${i}`, {
                id: `Scenario:${i}`,
                type: 'Scenario',
                uri: 'file:///features/test.feature',
                line: i * 10,
                parent: `Feature:0`,
                steps: []
            });
        }
        
        // Generate StepDefs
        for (let i = 0; i < stepCount; i++) {
            nodes.set(`Def:${i}`, {
                id: `Def:${i}`,
                type: 'StepDefinition',
                uri: 'file:///steps/test.py',
                line: i * 5,
                pattern: `step pattern ${i}`,
                usages: []
            });
        }
        
        // Generate Usages (Each step def is used in (scenarioCount / stepCount) scenarios)
        const usagesPerDef = Math.floor(scenarioCount / stepCount);
        let scenarioIdx = 0;
        
        for (let i = 0; i < stepCount; i++) {
            const defId = `Def:${i}`;
            const defNode = nodes.get(defId);
            
            for (let j = 0; j < usagesPerDef; j++) {
                if (scenarioIdx >= scenarioCount) break;
                
                const stepId = `Step:${i}_${j}`;
                nodes.set(stepId, {
                    id: stepId,
                    type: 'Step',
                    uri: 'file:///features/test.feature',
                    line: scenarioIdx * 10 + 1,
                    parent: `Scenario:${scenarioIdx}`,
                    definitionId: defId
                });
                
                defNode.usages.push(stepId);
                scenarioIdx++;
            }
        }
        
        // High impact step (used in 20+ scenarios)
        const highImpactDef = nodes.get('Def:0');
        for(let j=0; j<25; j++) {
            const stepId = `Step:High_${j}`;
            nodes.set(stepId, {
                id: stepId,
                type: 'Step',
                uri: 'file:///features/test.feature',
                line: j * 10 + 2,
                parent: `Scenario:${j}`,
                definitionId: 'Def:0'
            });
            highImpactDef.usages.push(stepId);
        }

        return { graph, nodes };
    };

    const mockDocument = (stepCount: number): vscode.TextDocument => {
        let content = '';
        for (let i = 0; i < stepCount; i++) {
            content += `@given("step pattern ${i}")\ndef step_${i}(context): pass\n\n`;
        }
        return {
            uri: vscode.Uri.parse('file:///steps/test.py'),
            getText: () => content,
            positionAt: () => new vscode.Position(0, 0)
        } as any;
    };
    
    const mockToken = (): vscode.CancellationToken => ({
        isCancellationRequested: false,
        onCancellationRequested: new vscode.EventEmitter<any>().event
    });

    const runBenchmark = async (stepCount: number, scenarioCount: number, label: string) => {
        console.log(`\n--- Benchmark: ${label} (${stepCount} defs / ${scenarioCount} scenarios) ---`);
        const { graph } = generateGraph(stepCount, scenarioCount);
        
        const doc = mockDocument(stepCount);
        const token = mockToken();
        const provider = new ImpactCodeLensProvider(graph);

        const start = performance.now();
        const lenses = await provider.provideCodeLenses(doc, token);
        const discoveryTime = performance.now() - start;
        console.log(`Discovery Time: ${discoveryTime.toFixed(2)} ms`);
        
        // Check memory
        const mem = process.memoryUsage();
        console.log(`Heap Used: ${Math.round(mem.heapUsed / 1024 / 1024)} MB`);
        
        // Resolve time (assuming resolveCodeLens will be implemented)
        let resolveTime = 0;
        if (typeof (provider as any).resolveCodeLens === 'function') {
            const rStart = performance.now();
            for (const lens of lenses) {
                await (provider as any).resolveCodeLens(lens, token);
            }
            resolveTime = performance.now() - rStart;
            console.log(`Resolution Time (all lenses): ${resolveTime.toFixed(2)} ms`);
        }
        
        console.log(`Total Lenses: ${lenses.length}`);
    };

    test('Benchmark: 100 defs / 500 scenarios', async () => await runBenchmark(100, 500, 'Small'));
    test('Benchmark: 1000 defs / 5000 scenarios', async () => await runBenchmark(1000, 5000, 'Medium'));
    test('Benchmark: 5000 defs / 25000 scenarios', async () => await runBenchmark(5000, 25000, 'Large'));
});
