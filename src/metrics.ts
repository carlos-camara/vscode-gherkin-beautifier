import * as vscode from 'vscode';

export class MetricsLogger {
    private parseRequests = 0;
    private cacheHits = 0;
    private cacheMisses = 0;
    private totalParseTimeMs = 0;
    private totalAstGenerationTimeMs = 0;
    private totalFeatures = 0;
    private totalScenarios = 0;
    private totalSteps = 0;
    private parserFailures = 0;

    private outputChannel?: vscode.OutputChannel;

    public isEnabled(): boolean {
        return vscode.workspace
            .getConfiguration('gherkinPowerTools.diagnostics')
            .get<boolean>('metricsEnabled', false);
    }

    public recordCacheHit(): void {
        if (!this.isEnabled()) return;
        this.parseRequests++;
        this.cacheHits++;
    }

    public recordCacheMiss(): void {
        if (!this.isEnabled()) return;
        this.parseRequests++;
        this.cacheMisses++;
    }

    public recordParse(
        totalDurationMs: number,
        astGenTimeMs: number,
        features: number,
        scenarios: number,
        steps: number,
        errors: number
    ): void {
        if (!this.isEnabled()) return;

        this.totalParseTimeMs += totalDurationMs;
        this.totalAstGenerationTimeMs += astGenTimeMs;
        this.totalFeatures += features;
        this.totalScenarios += scenarios;
        this.totalSteps += steps;

        if (errors > 0) {
            this.parserFailures++;
        }
    }

    public showMetrics(): void {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('Gherkin PowerTools - Developer Metrics');
        }

        this.outputChannel.clear();
        this.outputChannel.appendLine('=== Gherkin PowerTools Parser Metrics ===');
        
        if (!this.isEnabled()) {
            this.outputChannel.appendLine('Metrics are currently disabled.');
            this.outputChannel.appendLine('Enable them via setting: gherkinPowerTools.diagnostics.metricsEnabled');
            this.outputChannel.show();
            return;
        }

        const hitRatio = this.parseRequests > 0 
            ? ((this.cacheHits / this.parseRequests) * 100).toFixed(2) 
            : '0.00';
            
        const avgParseTime = this.cacheMisses > 0 
            ? (this.totalParseTimeMs / this.cacheMisses).toFixed(2) 
            : '0.00';
            
        const avgAstGenTime = this.cacheMisses > 0 
            ? (this.totalAstGenerationTimeMs / this.cacheMisses).toFixed(2) 
            : '0.00';

        this.outputChannel.appendLine(`Total Parse Requests: ${this.parseRequests}`);
        this.outputChannel.appendLine(`Cache Hits:           ${this.cacheHits}`);
        this.outputChannel.appendLine(`Cache Misses:         ${this.cacheMisses}`);
        this.outputChannel.appendLine(`Cache Hit Ratio:      ${hitRatio}%`);
        this.outputChannel.appendLine(`Parser Failures:      ${this.parserFailures}`);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('--- Performance ---');
        this.outputChannel.appendLine(`Total Parsing Time:   ${this.totalParseTimeMs.toFixed(2)} ms`);
        this.outputChannel.appendLine(`Avg Parse Time/Miss:  ${avgParseTime} ms`);
        this.outputChannel.appendLine(`Total AST Gen Time:   ${this.totalAstGenerationTimeMs.toFixed(2)} ms`);
        this.outputChannel.appendLine(`Avg AST Gen Time/Miss:${avgAstGenTime} ms`);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('--- Document Complexity (Aggregated over Misses) ---');
        this.outputChannel.appendLine(`Total Features:       ${this.totalFeatures}`);
        this.outputChannel.appendLine(`Total Scenarios:      ${this.totalScenarios}`);
        this.outputChannel.appendLine(`Total Steps:          ${this.totalSteps}`);
        
        this.outputChannel.show();
    }
}

export const metricsLogger = new MetricsLogger();
