import { CompletionRankingService, RankingContext } from '../../completionRanking';
import { StepDefinition } from '../../cache';
import * as vscode from 'vscode';
import { WorkspaceGraph } from '../../graph';

async function runBenchmark() {
    console.log('Starting Ranking Benchmark...');
    
    // Mock graph
    const mockGraph = {
        currentGeneration: {
            getNode: () => undefined
        }
    } as any;
    
    const service = new CompletionRankingService(mockGraph);
    
    const defs: StepDefinition[] = [];
    for (let i = 0; i < 10000; i++) {
        defs.push({
            type: 'given',
            rawPattern: `I have ${i} apples`,
            matcherType: 'parse',
            evaluable: true,
            decoratorRange: new vscode.Range(0, 0, 0, 0),
            uri: vscode.Uri.file('/test.py')
        } as StepDefinition);
    }

    const context: RankingContext = {
        semanticType: 'given',
        typedText: 'I have 5',
        currentTags: ['@ui', '@fast'],
        currentFeatureStepTexts: ['Given I have 5 apples']
    };

    const start = process.hrtime.bigint();

    for (const def of defs) {
        const score = service.scoreItem(def, context);
        service.getSortText(score);
    }

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;

    console.log(`Ranked 10,000 items in ${durationMs.toFixed(2)} ms`);
    console.log(`Average latency per item: ${(durationMs / 10000).toFixed(4)} ms`);
}

runBenchmark().catch(console.error);
