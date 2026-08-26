import * as vscode from 'vscode';
import { SymbolCache } from './cache';
import { CompletionRankingService, TextMatchQuality, SemanticMatchQuality } from './completionRanking';
import { CompletionContextCache } from './completion';
import { dialectService } from './dialect';
import { SourceLocationPresenter } from './utils/sourceLocationPresenter';

let diagnosticsChannel: vscode.OutputChannel | undefined;

export async function explainCompletionRanking(
    symbolCache: SymbolCache,
    rankingService: CompletionRankingService,
    contextCache: CompletionContextCache
) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("No active editor found to analyze completion ranking.");
        return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    const dialect = dialectService.getDialect(document);

    const stepKeywords = dialectService.getStepKeywords(dialect);
    if (!stepKeywords.includes('* ')) stepKeywords.push('* ');
    stepKeywords.sort((a, b) => b.length - a.length);
    const escapedSteps = stepKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const stepRegex = new RegExp(`^(\\s*(?:${escapedSteps.join('|')}))`);

    const match = linePrefix.match(stepRegex);
    if (!match) {
        vscode.window.showInformationMessage("Cursor is not currently on a valid Gherkin step keyword.");
        return;
    }

    const keywordPrefix = match[1];
    const typedText = linePrefix.substring(keywordPrefix.length);
    const semanticType = dialectService.resolveDocumentLineSemanticType(document, position.line);

    const snapshot = await contextCache.getSnapshot(document, stepRegex);
    const rankingContext = {
        semanticType,
        typedText,
        currentTags: snapshot.tags,
        currentFeatureStepTexts: snapshot.featureStepTexts
    };

    const definitions = await symbolCache.getAllStepDefinitions(semanticType);
    
    // Compute scores
    const scoredItems = definitions.map(def => {
        const score = rankingService.scoreItem(def, rankingContext);
        const sortText = rankingService.getSortText(score);
        return { def, score, sortText };
    });

    // Sort matching VS Code default sort (lexicographical A-Z)
    scoredItems.sort((a, b) => a.sortText.localeCompare(b.sortText));

    const topItems = scoredItems.slice(0, 50); // Analyze top 50 for quickpick

    if (topItems.length === 0) {
        vscode.window.showInformationMessage("No step definitions found to rank.");
        return;
    }

    const quickPickItems = topItems.map(item => {
        return {
            label: item.def.rawPattern,
            description: `[Tier: ${item.sortText.split('-')[0]}] Sort: ${item.sortText}`,
            detail: `Text: ${TextMatchQuality[item.score.textMatch]} | Semantic: ${SemanticMatchQuality[item.score.semanticMatch]} | Usage: ${item.score.historicalUsage} | Affinity: ${item.score.tagAffinity}`,
            itemData: item
        };
    });

    const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Select a ranked completion item to view its detailed diagnostic explanation',
        matchOnDescription: true
    });

    if (selected) {
        if (!diagnosticsChannel) {
            diagnosticsChannel = vscode.window.createOutputChannel("Gherkin PowerTools: Diagnostics");
        }

        const data = selected.itemData;
        const explanation = {
            pattern: data.def.rawPattern,
            source: SourceLocationPresenter.formatPath(data.def.uri),
            typedText: rankingContext.typedText,
            semanticType: rankingContext.semanticType,
            ranking: {
                textMatch: TextMatchQuality[data.score.textMatch],
                semanticCompatibility: SemanticMatchQuality[data.score.semanticMatch],
                matcherSpecificity: data.score.matcherQuality,
                localContext: data.score.localContext,
                historicalUsage: data.score.historicalUsage,
                tagAffinity: data.score.tagAffinity,
                finalTier: data.sortText
            }
        };

        diagnosticsChannel.appendLine(`--- Completion Ranking Diagnostics ---`);
        diagnosticsChannel.appendLine(JSON.stringify(explanation, null, 2));
        diagnosticsChannel.appendLine('');
        diagnosticsChannel.show(true); // show but preserve focus
    }
}
