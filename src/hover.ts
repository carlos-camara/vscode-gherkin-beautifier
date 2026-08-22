import * as vscode from 'vscode';
import { SymbolCache, FeatureCache, StepDefinition } from './cache';
import { dialectService } from './dialect';

import * as path from 'path';

export class GherkinHoverProvider implements vscode.HoverProvider {
    private symbolCache: SymbolCache;
    private featureCache: FeatureCache;

    constructor(symbolCache: SymbolCache, featureCache: FeatureCache) {
        this.symbolCache = symbolCache;
        this.featureCache = featureCache;
    }

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {

        // First, check if the user is hovering over a tag
        const tagRange = document.getWordRangeAtPosition(position, /@[^\s@]+/);
        if (tagRange) {
            const tagName = document.getText(tagRange);
            const blastRadius = await this.featureCache.getTagBlastRadius(tagName);
            
            const hoverContent = new vscode.MarkdownString();
            hoverContent.appendMarkdown(`🏷️ **${tagName}**\n\nApplies to **${blastRadius}** scenarios across the workspace.`);
            
            if (await this.featureCache.hasStaleOrPartialFilesForTag(tagName)) {
                hoverContent.appendMarkdown(`\n\n> ⚠️ **Warning:** Some files containing this tag have unsaved syntax errors or are currently unreachable. The scenario count might be inaccurate.`);
            }

            return new vscode.Hover(hoverContent);
        }

        // Otherwise, check if hovering over a step
        const lineText = document.lineAt(position.line).text;
        const dialect = dialectService.getDialect(document);
        const match = lineText.match(dialectService.getStepRegex(dialect));

        if (!match) {
            return undefined;
        }


        if (_token.isCancellationRequested) {
            return undefined;
        }

        const stepText = match[2].trim();
        const semanticType = dialectService.resolveAndBut(document, position.line);

        const stepDefs: StepDefinition[] = await this.symbolCache.getStepDefinitions(stepText, semanticType);

        if (_token.isCancellationRequested || stepDefs.length === 0) {
            return undefined; // No underlying implementation found
        }

        // Construct Hover Markdown
        const hoverContent = new vscode.MarkdownString();
        hoverContent.supportThemeIcons = true;
        

        for (let i = 0; i < stepDefs.length; i++) {
            const stepDef = stepDefs[i];
            
            if (i > 0) {
                hoverContent.appendMarkdown(`\n\n---\n\n`);
            }

            const basename = path.basename(stepDef.uri.fsPath);
            const line = stepDef.decoratorRange ? stepDef.decoratorRange.start.line + 1 : 1;
            const link = `${stepDef.uri.toString()}#${line}`;
            
            let icon = 'symbol-function';
            if (stepDef.type === 'given') icon = 'symbol-event';
            else if (stepDef.type === 'when') icon = 'symbol-method';
            else if (stepDef.type === 'then') icon = 'symbol-constant';

            hoverContent.appendMarkdown(`$(${icon}) **${stepDef.functionName || 'step_impl'}** &nbsp;•&nbsp; $(file) [${basename}:${line}](${link}) &nbsp;•&nbsp; $(gear) \`${stepDef.matcherType}\`\n\n`);
            
            if (!stepDef.evaluable) {
                hoverContent.appendMarkdown(`> ⚠️ **Unsupported Matcher:** ${stepDef.compilationError || 'Dynamic expression is not supported'}\n\n`);
            }
            
            if (stepDef.rawPattern) {
                const quote = stepDef.rawPattern.includes('\n') ? '"""' : "'";
                hoverContent.appendCodeblock(`@${stepDef.type}(${quote}${stepDef.rawPattern}${quote})\ndef ${stepDef.functionName || 'step_impl'}(context, ...):`, 'python');
            }

            // Add the docstring safely
            if (stepDef.documentation) {
                hoverContent.appendMarkdown(`\n\n`);
                hoverContent.appendCodeblock(stepDef.documentation, 'text');
            }
        }

        return new vscode.Hover(hoverContent);
    }
}
