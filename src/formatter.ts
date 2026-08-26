import * as vscode from 'vscode';
import { astRepository } from './ast';
import type { GherkinDocument, Scenario, Background, TableCell, Tag } from '@cucumber/messages';
import { ConfigurationService } from './configuration';

export interface FormatterOptions {
    stepIndentation: number;
    alignTableToKeyword: boolean;
    docStrings?: { alignToKeyword: boolean, formatJson?: 'tagged' | 'auto' | 'off' };
    tagsFormat: 'wrap' | 'singleLine';
    tagsSort: 'preserve' | 'alphabetical';
    emptyLinesBetweenScenarios: number;
}

interface NodeInfo {
    type: 'Feature' | 'Rule' | 'Scenario' | 'Background' | 'Step' | 'Examples' | 'TableRow' | 'DocString' | 'FormattedTags' | 'Skip' | 'Comment';
    indent: number;
    keyword?: string;
    cells?: readonly TableCell[];
    lines?: string[]; // for FormattedTags or DocString content
    emptyLinesBefore?: number;
    groupId?: string;
    mediaType?: string;
    originalEndLine?: number;
}

interface FormattedLine {
    text: string;
    originalLine: number;
}




export class GherkinFormattingEditProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {

    constructor(private configService: ConfigurationService) {}

    private getOptions(uri?: vscode.Uri): FormatterOptions {
        const config = this.configService.getConfiguration(uri);
        return {
            stepIndentation: config.indentation?.steps ?? 4,
            alignTableToKeyword: config.tables?.alignToKeyword ?? true,
            docStrings: { alignToKeyword: config.docStrings?.alignToKeyword ?? true, formatJson: config.docStrings?.formatJson ?? 'auto' },
            tagsFormat: config.tags?.format ?? 'wrap',
            tagsSort: config.tags?.sort ?? 'preserve',
            emptyLinesBetweenScenarios: config.emptyLines?.betweenScenarios ?? 1
        };
    }

    public async provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        _options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        const config = this.configService.getConfiguration(document.uri);
        if (config.formatter?.enabled === false) {
            return [];
        }
        const options = this.getOptions(document.uri);
        const text = document.getText();
        const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
        const hasFinalNewline = text.endsWith('\n');

        const formattedLines = await this.formatGherkin(document, options, token);
        if (formattedLines === null || token.isCancellationRequested) return [];

        const formattedText = formattedLines.map(l => l.text).join(eol);
        const finalText = hasFinalNewline && !formattedText.endsWith(eol) ? formattedText + eol : formattedText;

        if (finalText === text) {
            return []; // Idempotent check
        }

        const lastLine = document.lineAt(document.lineCount - 1);
        const start = new vscode.Position(0, 0);
        const end = new vscode.Position(document.lineCount - 1, lastLine.text.length);
        const range = new vscode.Range(start, end);

        return [vscode.TextEdit.replace(range, finalText)];
    }

    public async provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        _options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        const config = this.configService.getConfiguration(document.uri);
        if (config.formatter?.enabled === false) {
            return [];
        }
        const options = this.getOptions(document.uri);
        const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';

        const internalResult = await this.formatGherkinInternal(document, options, token);
        if (internalResult === null || token.isCancellationRequested) return [];

        const { lines: formattedLines, map: astMap } = internalResult;

        let startLineOriginal = range.start.line + 1; // 1-indexed
        let endLineOriginal = range.end.line + 1; // 1-indexed

        // Expand Start if inside a multi-line safe unit
        const startNode = astMap.get(startLineOriginal);
        if (startNode && startNode.groupId) {
            let i = startLineOriginal;
            while (i > 1 && astMap.get(i - 1)?.groupId === startNode.groupId) {
                i--;
            }
            startLineOriginal = i;
        }

        // Expand End if inside a multi-line safe unit
        const endNode = astMap.get(endLineOriginal);
        if (endNode && endNode.groupId) {
            let i = endLineOriginal;
            while (i < document.lineCount && astMap.get(i + 1)?.groupId === endNode.groupId) {
                i++;
            }
            endLineOriginal = i;
        }

        const filteredLines = formattedLines.filter(l => l.originalLine >= startLineOriginal && l.originalLine <= endLineOriginal);
        if (filteredLines.length === 0) {
            return [];
        }

        const replacementText = filteredLines.map(l => l.text).join(eol);

        // Construct the full-line exact replacement range
        const replacementRange = new vscode.Range(
            new vscode.Position(startLineOriginal - 1, 0),
            new vscode.Position(endLineOriginal - 1, document.lineAt(endLineOriginal - 1).text.length)
        );

        const originalTextRange = document.getText(replacementRange);
        if (originalTextRange === replacementText) {
            return [];
        }

        return [vscode.TextEdit.replace(replacementRange, replacementText)];
    }

    public async formatGherkin(document: vscode.TextDocument | { uri: vscode.Uri, version: number, getText(): string }, options: FormatterOptions, token: vscode.CancellationToken): Promise<FormattedLine[] | null> {
        const result = await this.formatGherkinInternal(document, options, token);
        return result ? result.lines : null;
    }

    private async formatGherkinInternal(document: vscode.TextDocument | { uri: vscode.Uri, version: number, getText(): string }, options: FormatterOptions, token: vscode.CancellationToken): Promise<{ lines: FormattedLine[], map: Map<number, NodeInfo> } | null> {
        const text = document.getText();
        const { document: gherkinDocument, errors } = await astRepository.getAST(document);

        if (!gherkinDocument || errors.length > 0) {
            return null;
        }

        const astMap = new Map<number, NodeInfo>();
        this.buildASTMap(gherkinDocument, options, astMap);

        const lines = text.split(/\r?\n/);
        const out: FormattedLine[] = [];
        let tableRows: { cells: readonly TableCell[], indent: number, originalLine: number }[] = [];

        for (let i = 0; i < lines.length; i++) {
            if (token.isCancellationRequested) return null;

            const lineNum = i + 1;
            const rawLine = lines[i];
            const trimmedLine = rawLine.trim();
            const node = astMap.get(lineNum);

            // 1. Enforce empty lines before blocks
            if (node && node.emptyLinesBefore !== undefined) {
                if (out.length > 0) {
                    let blankCount = 0;
                    for (let j = out.length - 1; j >= 0; j--) {
                        if (out[j].text.trim() === '') blankCount++;
                        else break;
                    }
                    if (blankCount > node.emptyLinesBefore) {
                        for (let j = 0; j < blankCount - node.emptyLinesBefore; j++) out.pop();
                    } else if (blankCount < node.emptyLinesBefore) {
                        for (let j = 0; j < node.emptyLinesBefore - blankCount; j++) out.push({ text: '', originalLine: lineNum });
                    }
                }
            }

            // 2. Skip marked lines (e.g. DocString contents or duplicate tag lines)
            if (node && node.type === 'Skip') continue;

            // 3. Handle raw empty lines
            if (trimmedLine === '') {
                // Preserve at most 1 empty line in the middle of blocks (e.g. between steps)
                if (out.length > 0 && out[out.length - 1].text.trim() !== '') {
                    out.push({ text: '', originalLine: lineNum });
                }
                continue;
            }

            // 4. Handle Tables
            if (node && node.type === 'TableRow' && node.cells) {
                tableRows.push({ cells: node.cells, indent: node.indent, originalLine: lineNum });
                const nextNode = astMap.get(lineNum + 1);
                if (!nextNode || nextNode.type !== 'TableRow') {
                    const aligned = this.alignTable(tableRows);
                    aligned.forEach((text, idx) => out.push({ text, originalLine: tableRows[idx].originalLine }));
                    tableRows.length = 0;
                }
                continue;
            }

            // 5. Handle Mapped Nodes
            if (node) {
                if (node.type === 'FormattedTags' && node.lines) {
                    // Tag formatting could expand to multiple lines. Assign them all to the first line.
                    node.lines.forEach(text => out.push({ text, originalLine: lineNum }));
                    continue;
                }

                if (node.type === 'DocString' && node.keyword && node.lines !== undefined) {
                    const mediaType = node.mediaType ? node.mediaType : '';
                    out.push({ text: ' '.repeat(node.indent) + node.keyword + mediaType, originalLine: lineNum });
                    node.lines.forEach((cl, idx) => {
                        out.push({ text: cl === '' ? '' : ' '.repeat(node.indent) + cl, originalLine: lineNum + 1 + idx });
                    });

                    const actualEndLine = node.originalEndLine !== undefined ? node.originalEndLine : lineNum + node.lines.length + 1;
                    out.push({ text: ' '.repeat(node.indent) + node.keyword, originalLine: actualEndLine });
                    continue;
                }

                if (node.type === 'Comment') {
                    let contextIndent = 0;
                    for (let j = lineNum; j <= lines.length; j++) {
                        const nextNode = astMap.get(j);
                        if (nextNode && nextNode.type !== 'Comment' && nextNode.type !== 'Skip' && nextNode.type !== 'FormattedTags') {
                            contextIndent = nextNode.indent;
                            break;
                        }
                    }
                    out.push({ text: ' '.repeat(contextIndent) + trimmedLine, originalLine: lineNum });
                    continue;
                }

                // Handle standard nodes (Feature, Rule, Scenario, Background, Step, Examples)
                let textToAppend = trimmedLine;
                out.push({ text: ' '.repeat(node.indent) + textToAppend, originalLine: lineNum });

            } else {
                // 6. Handle unmapped lines (Descriptions)
                let parentIndent = 0;
                for (let j = lineNum - 1; j > 0; j--) {
                    const pNode = astMap.get(j);
                    if (pNode && pNode.type !== 'Comment' && pNode.type !== 'Skip' && pNode.type !== 'FormattedTags') {
                        parentIndent = pNode.indent;
                        break;
                    }
                }
                out.push({ text: ' '.repeat(parentIndent + 2) + trimmedLine, originalLine: lineNum });
            }
        }

        // Clean trailing empty lines
        while (out.length > 0 && out[out.length - 1].text.trim() === '') {
            out.pop();
        }

        return { lines: out, map: astMap };
    }



    private buildASTMap(document: GherkinDocument, options: FormatterOptions, map: Map<number, NodeInfo>) {
        if (!document.feature) return;

        this.processTags(document.feature.tags, 0, options, map);
        this.markEmptyLinesBefore(document.feature.tags, document.feature.location.line, 0, map);

        map.set(document.feature.location.line, { type: 'Feature', indent: 0, keyword: document.feature.keyword, emptyLinesBefore: map.get(document.feature.location.line)?.emptyLinesBefore });

        document.feature.children?.forEach(child => {
            if (child.rule) {
                this.processTags(child.rule.tags, 2, options, map);
                this.markEmptyLinesBefore(child.rule.tags, child.rule.location.line, options.emptyLinesBetweenScenarios, map);
                map.set(child.rule.location.line, { type: 'Rule', indent: 2, keyword: child.rule.keyword, emptyLinesBefore: map.get(child.rule.location.line)?.emptyLinesBefore });

                child.rule.children?.forEach(rc => {
                    this.mapScenario(rc.background || rc.scenario, 4, options, map);
                });
            } else {
                this.mapScenario(child.background || child.scenario, 2, options, map);
            }
        });

        document.comments?.forEach(c => {
            map.set(c.location.line, { type: 'Comment', indent: -1 });
        });
    }

    private mapScenario(scenario: Scenario | Background | undefined, indent: number, options: FormatterOptions, map: Map<number, NodeInfo>) {
        if (!scenario) return;

        const tags = 'tags' in scenario ? scenario.tags : undefined;

        this.processTags(tags, indent, options, map);
        this.markEmptyLinesBefore(tags, scenario.location.line, options.emptyLinesBetweenScenarios, map);

        map.set(scenario.location.line, {
            type: 'Background' in scenario ? 'Background' : 'Scenario',
            indent,
            keyword: scenario.keyword,
            emptyLinesBefore: map.get(scenario.location.line)?.emptyLinesBefore
        });

        scenario.steps?.forEach(step => {
            const stepIndent = indent + options.stepIndentation;
            map.set(step.location.line, { type: 'Step', indent: stepIndent, keyword: step.keyword });

            if (step.dataTable) {
                const tableIndent = options.alignTableToKeyword ? stepIndent + (step.keyword?.length || 6) : stepIndent + 2;
                const groupId = `table-${step.location.line}`;
                step.dataTable.rows?.forEach(r => map.set(r.location.line, { type: 'TableRow', indent: tableIndent, cells: r.cells, groupId }));
            }
            if (step.docString) {
                const startLine = step.docString.location.line;

                let contentLines = step.docString.content.split(/\r?\n/);
                if (options.docStrings?.formatJson !== 'off') {
                    const isTagged = step.docString.mediaType?.trim().toLowerCase() === 'json';
                    const isAuto = options.docStrings?.formatJson === 'auto';
                    if (isTagged || (isAuto && !step.docString.mediaType && (step.docString.content.trim().startsWith('{') || step.docString.content.trim().startsWith('[')))) {
                        try {
                            const parsed = JSON.parse(step.docString.content);
                            contentLines = JSON.stringify(parsed, null, 2).split(/\r?\n/);
                        } catch (e) {
                            // Invalid JSON, fallback to original content
                        }
                    }
                }

                // Keep the original endLine to properly skip original lines in the document map
                const originalEndLine = startLine + step.docString.content.split(/\r?\n/).length + 1;

                const docStringIndent = options.docStrings?.alignToKeyword ? stepIndent + (step.keyword?.length || 6) : stepIndent + 2;
                const groupId = `docstring-${startLine}`;
                map.set(startLine, {
                    type: 'DocString',
                    indent: docStringIndent,
                    keyword: step.docString.delimiter,
                    mediaType: step.docString.mediaType,
                    lines: contentLines,
                    originalEndLine: originalEndLine,
                    groupId
                });

                for (let j = startLine + 1; j <= originalEndLine; j++) {
                    map.set(j, { type: 'Skip', indent: 0, groupId });
                }
            }
        });

        if ('examples' in scenario && scenario.examples) {
            scenario.examples.forEach(ex => {
                const examplesIndent = indent + options.stepIndentation;
                this.processTags(ex.tags, examplesIndent, options, map);
                this.markEmptyLinesBefore(ex.tags, ex.location.line, options.emptyLinesBetweenScenarios, map);

                map.set(ex.location.line, { type: 'Examples', indent: examplesIndent, keyword: ex.keyword, emptyLinesBefore: map.get(ex.location.line)?.emptyLinesBefore });

                const tableIndent = examplesIndent + 2;
                const groupId = `table-${ex.location.line}`;
                if (ex.tableHeader) {
                    map.set(ex.tableHeader.location.line, { type: 'TableRow', indent: tableIndent, cells: ex.tableHeader.cells, groupId });
                }
                ex.tableBody?.forEach(r => map.set(r.location.line, { type: 'TableRow', indent: tableIndent, cells: r.cells, groupId }));
            });
        }
    }

    private processTags(tags: readonly Tag[] | undefined, indent: number, options: FormatterOptions, map: Map<number, NodeInfo>) {
        if (!tags || tags.length === 0) return;

        const tagLines = Array.from(new Set(tags.map(t => t.location.line))).sort((a,b) => a - b);
        let tagNames = tags.map(t => t.name);
        if (options.tagsSort === 'alphabetical') {
            tagNames = [...tagNames].sort();
        }

        const formattedTagLines: string[] = [];
        const indentStr = ' '.repeat(indent);

        if (options.tagsFormat === 'singleLine') {
            formattedTagLines.push(indentStr + tagNames.join(' '));
        } else {
            let currentLine = indentStr;
            for (const tag of tagNames) {
                if (currentLine.length + 1 + tag.length > 80 && currentLine.trim().length > 0) {
                    formattedTagLines.push(currentLine);
                    currentLine = indentStr + tag;
                } else {
                    currentLine = currentLine.trim().length === 0 ? currentLine + tag : currentLine + ' ' + tag;
                }
            }
            if (currentLine.trim().length > 0) {
                formattedTagLines.push(currentLine);
            }
        }

        const groupId = `tags-${tagLines[0]}`;
        for (let i = 0; i < tagLines.length; i++) {
            const line = tagLines[i];
            if (i === 0) {
                map.set(line, { type: 'FormattedTags', indent, lines: formattedTagLines, groupId });
            } else {
                map.set(line, { type: 'Skip', indent: 0, groupId });
            }
        }
    }

    private markEmptyLinesBefore(tags: readonly Tag[] | undefined, keywordLine: number, lines: number, map: Map<number, NodeInfo>) {
        const firstLine = tags && tags.length > 0 ? Math.min(...tags.map(t => t.location.line)) : keywordLine;
        const existing = map.get(firstLine) || { type: 'Skip', indent: 0 };
        existing.emptyLinesBefore = lines;
        map.set(firstLine, existing);
    }

    private alignTable(tableRows: { cells: readonly TableCell[], indent: number }[]): string[] {
        const colWidths: number[] = [];
        const escapedRows = tableRows.map(r => {
            return r.cells.map(c => {
                return c.value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, '\\n');
            });
        });

        escapedRows.forEach(row => {
            row.forEach((cellStr, idx) => {
                if (!colWidths[idx] || cellStr.length > colWidths[idx]) {
                    colWidths[idx] = cellStr.length;
                }
            });
        });

        return escapedRows.map((row, rowIdx) => {
            const indentStr = ' '.repeat(tableRows[rowIdx].indent);
            const paddedCells = row.map((cellStr, idx) => cellStr.padEnd(colWidths[idx], ' '));
            return indentStr + '| ' + paddedCells.join(' | ') + ' |';
        });
    }
}
