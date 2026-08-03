#!/usr/bin/env node
import { Command } from 'commander';
import * as vscode from 'vscode';
import * as path from 'path';

// Our core engines
import { SymbolCache } from '../cache';
import { FeatureCache } from '../cache';
import { WorkspaceGraph } from '../graph';
import { AntiPatternEngine } from '../antiPatternEngine';
import { calculateHealthMetrics } from '../statistics';
import { GherkinFormattingEditProvider } from '../formatter';
import { ConfigurationService } from '../configuration';

const program = new Command();

program
    .name('gherkin-pt')
    .description('Gherkin PowerTools CLI')
    .version('1.8.1');

async function initializeEngines() {
    console.log('[Info] Initializing Workspace Engine...');
    const symbolCache = new SymbolCache();
    const tagCache = new FeatureCache();
    const graph = new WorkspaceGraph(symbolCache);
    
    await graph.initialize();
    return { graph, symbolCache, tagCache };
}

program.command('analyze')
    .alias('health')
    .description('Analyze the workspace and provide actionable recommendations')
    .option('--json', 'Output results in JSON format')
    .action(async (options) => {
        try {
            const { graph, symbolCache } = await initializeEngines();
            
            const metrics = await calculateHealthMetrics(graph, symbolCache);
            const engine = new AntiPatternEngine();
            // In CLI, we default to the standard config rules
            const ruleConfig = {
                "oversized-scenario": "warning",
                "oversized-feature": "info",
                "duplicated-steps": "error",
                "unused-steps": "info",
                "ambiguous-steps": "error",
                "undefined-steps": "error",
                "excessive-tags": "info",
                "inconsistent-formatting": "info",
                "poor-maintainability": "warning"
            };
            const recommendations = engine.generateAntiPatterns(graph, metrics, ruleConfig);

            if (options.json) {
                console.log(JSON.stringify(recommendations, null, 2));
                process.exit(recommendations.length > 0 ? 1 : 0);
            } else {
                console.log(`\nFound ${recommendations.length} recommendation(s):\n`);
                recommendations.forEach(r => {
                    console.log(`[${r.severity.toUpperCase()}] ${r.title}`);
                    console.log(`  ${r.explanation}`);
                    console.log(`  Fix: ${r.suggestedFix}`);
                    if (r.affectedFiles) {
                        console.log(`  Files:`);
                        r.affectedFiles.forEach(f => console.log(`   - ${f}`));
                    }
                    console.log('');
                });
                process.exit(recommendations.length > 0 ? 1 : 0);
            }
        } catch (e: any) {
            console.error('[Error] Analysis failed:', e.message || e);
            process.exit(1);
        }
    });

program.command('stats')
    .alias('report')
    .description('Calculate workspace statistics and project health metrics')
    .option('--json', 'Output results in JSON format')
    .action(async (options) => {
        try {
            const { graph, symbolCache } = await initializeEngines();
            const metrics = await calculateHealthMetrics(graph, symbolCache);

            if (options.json) {
                console.log(JSON.stringify(metrics, null, 2));
            } else {
                console.log('\n--- Gherkin Project Stats ---');
                console.log(`Files:          ${metrics.totalFiles}`);
                console.log(`Features:       ${metrics.totalFeatures}`);
                console.log(`Scenarios:      ${metrics.totalScenarios}`);
                console.log(`Steps:          ${metrics.totalSteps}`);
                console.log(`Tags:           ${metrics.totalTags}`);
                console.log(`Avg Scenario:   ${metrics.averageScenarioLength.toFixed(1)} steps`);
                console.log('');
                console.log('--- Health Scores ---');
                console.log(`Overall Health: ${metrics.scores.health}/100`);
                console.log(`Maintainability:${metrics.scores.maintainability}/100`);
                console.log(`Complexity:     ${metrics.scores.complexity}/100`);
            }
        } catch (e: any) {
            console.error('[Error] Stats generation failed:', e.message || e);
            process.exit(1);
        }
    });

program.command('format')
    .description('Format feature files')
    .argument('[files...]', 'Specific files to format. If empty, formats all features in workspace.')
    .option('--check', 'Only check if files are formatted, do not write changes (returns exit code 1 if unformatted)')
    .action(async (files: string[], options) => {
        try {
            const diagCollection = vscode.languages.createDiagnosticCollection('gherkin-pt');
            const configService = new ConfigurationService(diagCollection);
            const formatter = new GherkinFormattingEditProvider(configService);
            
            let targetFiles: vscode.Uri[] = [];
            
            if (files.length > 0) {
                targetFiles = files.map(f => vscode.Uri.file(path.resolve(f)));
            } else {
                console.log('[Info] Searching for feature files...');
                targetFiles = await vscode.workspace.findFiles('**/*.feature');
            }

            console.log(`[Info] Formatting ${targetFiles.length} file(s)...`);
            
            let unformattedCount = 0;
            const tokenSource = new vscode.CancellationTokenSource();

            for (const uri of targetFiles) {
                const doc = await vscode.workspace.openTextDocument(uri);
                const edits = await formatter.provideDocumentFormattingEdits(doc as any, {} as any, tokenSource.token);
                
                if (edits && edits.length > 0) {
                    if (options.check) {
                        console.log(`[Check] ${uri.fsPath} needs formatting.`);
                        unformattedCount++;
                    } else {
                        const newText = edits[0].newText;
                        await vscode.workspace.fs.writeFile(uri, Buffer.from(newText, 'utf8'));
                        console.log(`[Formatted] ${uri.fsPath}`);
                    }
                }
            }

            if (options.check) {
                if (unformattedCount > 0) {
                    console.error(`\n[Error] ${unformattedCount} file(s) are not formatted properly.`);
                    process.exit(1);
                } else {
                    console.log('\n[Ok] All files are properly formatted.');
                }
            } else {
                console.log('\n[Ok] Formatting complete.');
            }
            
        } catch (e: any) {
            console.error('[Error] Format failed:', e.message || e);
            process.exit(1);
        }
    });

program.parse(process.argv);
