import * as vscode from 'vscode';

/**
 * Configuration options for the Gherkin formatter.
 */
export interface FormatterOptions {
    stepIndentation: number;
    alignTableToKeyword: boolean;
    tagsFormat: 'wrap' | 'singleLine';
    emptyLinesBetweenScenarios: number;
}

/**
 * Provides formatting edits for Gherkin documents.
 * Supports both full document formatting and range/selection formatting.
 */
export class GherkinFormattingEditProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
    
    /**
     * Retrieves the current user configuration for the formatter.
     * @returns The FormatterOptions object based on workspace settings.
     */
    private getOptions(): FormatterOptions {
        const config = vscode.workspace.getConfiguration('gherkinBeautifier');
        return {
            stepIndentation: config.get<number>('indentation.steps', 4),
            alignTableToKeyword: config.get<boolean>('tables.alignToKeyword', true),
            tagsFormat: config.get<'wrap' | 'singleLine'>('tags.format', 'wrap'),
            emptyLinesBetweenScenarios: config.get<number>('emptyLines.betweenScenarios', 1)
        };
    }

    public provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const lines: string[] = [];
        const formatOptions = this.getOptions();

        for (let i = 0; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }

        const formattedLines = this.formatGherkin(lines, formatOptions.stepIndentation, formatOptions);

        const start = new vscode.Position(0, 0);
        const end = new vscode.Position(document.lineCount, 0);
        const range = new vscode.Range(start, end);

        edits.push(vscode.TextEdit.replace(range, formattedLines.join('\n') + '\n'));

        return edits;
    }

    public provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const lines: string[] = [];
        const formatOptions = this.getOptions();
        
        const startLine = range.start.line;
        const endLine = range.end.line;

        for (let i = startLine; i <= endLine; i++) {
            lines.push(document.lineAt(i).text);
        }

        let initialStepIndent = formatOptions.stepIndentation;
        if (startLine > 0) {
            const prevLine = document.lineAt(startLine - 1).text;
            const match = prevLine.trimStart().match(/^(Given|When|Then|And|But|\*|Dado|Cuando|Entonces|Y|Pero|Soit|Quand|Alors|Et|Mais|Angenommen|Wenn|Dann|Und|Aber)\s+(.*)/i);
            if (match) {
                const keywordLength = match[1].length;
                const baseIndent = prevLine.length - prevLine.trimStart().length;
                if (formatOptions.alignTableToKeyword) {
                    initialStepIndent = baseIndent + keywordLength + 1;
                } else {
                    initialStepIndent = baseIndent + 2;
                }
            }
        }

        const formattedLines = this.formatGherkin(lines, initialStepIndent, formatOptions);

        const formatRange = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
        );

        edits.push(vscode.TextEdit.replace(formatRange, formattedLines.join('\n')));

        return edits;
    }

    /**
     * The core formatting engine that processes an array of Gherkin lines.
     * 
     * @param lines Array of unformatted text lines.
     * @param initialStepIndent The base indentation level to start with.
     * @param options Formatting configuration.
     * @returns Array of formatted text lines.
     */
    public formatGherkin(
        lines: string[], 
        initialStepIndent: number = 4, 
        options: FormatterOptions = { stepIndentation: 4, alignTableToKeyword: true, tagsFormat: 'wrap', emptyLinesBetweenScenarios: 1 }
    ): string[] {
        const result: string[] = [];
        let inTable = false;
        let tableLines: string[] = [];
        let tagBuffer: string[] = [];
        let lastStepIndent = initialStepIndent; 

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim(); // This inherently trims trailing whitespace
            
            // Normalize Example Variables: < email > to <email>
            line = line.replace(/< *([\w\s-]+?) *>/g, (match, inner) => '<' + inner.trim() + '>');

            if (line.startsWith('|') && line.endsWith('|')) {
                inTable = true;
                tableLines.push(line);
            } else {
                if (inTable) {
                    result.push(...this.alignTable(tableLines, lastStepIndent));
                    tableLines = [];
                    inTable = false;
                }
                
                if (line !== '') {
                    if (line.startsWith('@')) {
                        tagBuffer.push(...line.split(/\s+/).filter(t => t.startsWith('@')));
                        continue;
                    }
                    
                    if (tagBuffer.length > 0) {
                        const nextLower = line.toLowerCase();
                        const tagIndent = nextLower.startsWith('feature:') ? 0 : 2;
                        
                        // Check spacing before blocks/tags
                        if (result.length > 0) {
                            const lastLine = result[result.length - 1];
                            if (lastLine.trim() !== '') {
                                const emptyLinesNeeded = options.emptyLinesBetweenScenarios;
                                for (let j = 0; j < emptyLinesNeeded; j++) {
                                    result.push('');
                                }
                            }
                        }
                        
                        result.push(...this.formatTags(tagBuffer, tagIndent, options));
                        tagBuffer = [];
                    }

                    const indentedLine = this.indentLine(line, options);
                    const lowerLine = line.toLowerCase();
                    
                    if (lowerLine.match(/^(given|when|then|and|but|\*|examples:|dado|cuando|entonces|y|pero|ejemplos:|soit|quand|alors|et|mais|exemples:|angenommen|wenn|dann|und|aber|beispiele:)/)) {
                        const match = indentedLine.trimStart().match(/^(Given|When|Then|And|But|\*|Dado|Cuando|Entonces|Y|Pero|Soit|Quand|Alors|Et|Mais|Angenommen|Wenn|Dann|Und|Aber)\s+(.*)/i);
                        const baseIndent = indentedLine.length - indentedLine.trimStart().length;
                        
                        if (options.alignTableToKeyword && match) {
                            const keywordLength = match[1].length;
                            lastStepIndent = baseIndent + keywordLength + 1;
                        } else {
                            lastStepIndent = baseIndent + 2;
                        }
                    }

                    const isNewBlock = lowerLine.match(/^(scenario|scenario outline|background|rule|escenario|esquema del escenario|antecedentes|regla|scénario|plan du scénario|contexte|règle|szenario|szenariogrundriss|hintergrund|regel):/);

                    if (isNewBlock && result.length > 0) {
                        const lastLine = result[result.length - 1];
                        if (lastLine.trim() !== '' && !lastLine.trim().startsWith('@')) {
                            const emptyLinesNeeded = options.emptyLinesBetweenScenarios;
                            for (let j = 0; j < emptyLinesNeeded; j++) {
                                result.push('');
                            }
                        }
                    }

                    result.push(indentedLine);
                } else {
                    // Empty line logic (collapses multiple to single)
                    if (result.length > 0 && result[result.length - 1].trim() !== '') {
                        result.push('');
                    }
                }
            }
        }

        if (tagBuffer.length > 0) {
            result.push(...this.formatTags(tagBuffer, 2, options));
        }

        if (inTable) {
            result.push(...this.alignTable(tableLines, lastStepIndent));
        }

        // Remove trailing empty lines completely
        while (result.length > 0 && result[result.length - 1].trim() === '') {
            result.pop();
        }

        return this.alignInlineComments(result);
    }

    /**
     * Extracts an inline comment from a line, respecting strings and quotes.
     */
    private extractInlineComment(line: string): { text: string, comment: string | null } {
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') inQuote = !inQuote;
            if (!inQuote && line[i] === '#' && i > 0 && /\s/.test(line[i-1])) {
                return {
                    text: line.substring(0, i).trimEnd(),
                    comment: line.substring(i)
                };
            }
        }
        return { text: line, comment: null };
    }

    /**
     * Post-processing step to align inline comments within contiguous blocks.
     */
    private alignInlineComments(lines: string[]): string[] {
        const blocks: { start: number, end: number, maxLength: number, hasComments: boolean }[] = [];
        let currentBlockStart = 0;
        let maxLength = 0;
        let blockHasComments = false;

        for (let j = 0; j < lines.length; j++) {
            const currentLine = lines[j];
            
            if (currentLine.trim() === '') {
                if (j > currentBlockStart) {
                    blocks.push({ start: currentBlockStart, end: j - 1, maxLength, hasComments: blockHasComments });
                }
                currentBlockStart = j + 1;
                maxLength = 0;
                blockHasComments = false;
                continue;
            }

            if (!currentLine.trimStart().startsWith('#')) {
                const { text, comment } = this.extractInlineComment(currentLine);
                if (comment) {
                    blockHasComments = true;
                    if (text.length > maxLength) maxLength = text.length;
                } else if (!currentLine.trimStart().startsWith('@') && !currentLine.includes('|')) {
                    if (text.length > maxLength) maxLength = text.length;
                }
            }
        }
        if (lines.length > currentBlockStart) {
            blocks.push({ start: currentBlockStart, end: lines.length - 1, maxLength, hasComments: blockHasComments });
        }

        for (const block of blocks) {
            if (block.hasComments) {
                for (let j = block.start; j <= block.end; j++) {
                    const line = lines[j];
                    if (!line.trimStart().startsWith('#')) {
                        const { text, comment } = this.extractInlineComment(line);
                        if (comment) {
                            const paddingNeeded = block.maxLength - text.length + 2; 
                            lines[j] = text + ' '.repeat(paddingNeeded) + comment;
                        }
                    }
                }
            }
        }
        return lines;
    }

    /**
     * Sorts, deduplicates, and wraps tags into multiple lines if they exceed 80 characters.
     * 
     * @param tags Array of Gherkin tags (e.g. ['@smoke', '@api']).
     * @param indentSpaces Number of spaces to indent the resulting tag lines.
     * @returns Array of formatted tag lines.
     */
    private formatTags(tags: string[], indentSpaces: number, options: FormatterOptions): string[] {
        const uniqueTags = [...new Set(tags)].sort();
        const result: string[] = [];
        const padding = ' '.repeat(indentSpaces);
        
        if (options.tagsFormat === 'singleLine') {
            result.push(padding + uniqueTags.join(' '));
            return result;
        }

        let currentLine = padding;
        
        for (const tag of uniqueTags) {
            if (currentLine.length + tag.length > 80 && currentLine.trim() !== '') {
                result.push(currentLine.trimEnd());
                currentLine = padding + tag + ' ';
            } else {
                currentLine += tag + ' ';
            }
        }
        
        if (currentLine.trim() !== '') {
            result.push(currentLine.trimEnd());
        }
        
        return result;
    }

    /**
     * Normalizes the capitalization of Gherkin keywords to standard Title Case.
     * 
     * @param line The string line to process.
     * @returns The line with normalized keywords.
     */
    private autoCase(line: string): string {
        return line.replace(/^(feature|característica|fonction|funktionalität|scenario outline|esquema del escenario|plan du scénario|szenariogrundriss|scenario|escenario|scénario|szenario|background|antecedentes|contexte|hintergrund|rule|regla|règle|regel|examples|ejemplos|exemples|beispiele|given|dado|soit|angenommen|when|cuando|quand|wenn|then|entonces|alors|dann|and|y|et|und|but|pero|mais|aber|\*)(:|\s|$)/i, (match, p1, p2) => {
            const lower = p1.toLowerCase();
            let cased = lower.charAt(0).toUpperCase() + lower.slice(1);
            
            if (lower === 'scenario outline') cased = 'Scenario Outline';
            else if (lower === 'esquema del escenario') cased = 'Esquema del escenario';
            else if (lower === 'plan du scénario') cased = 'Plan du scénario';
            else if (lower === 'szenariogrundriss') cased = 'Szenariogrundriss';
            
            return cased + p2;
        });
    }

    /**
     * Applies correct semantic indentation to a single Gherkin line based on its keyword.
     * 
     * @param line The line of text to indent.
     * @param options Formatting options defining spacing preferences.
     * @returns The properly indented line.
     */
    private indentLine(line: string, options: FormatterOptions): string {
        line = this.autoCase(line);
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.match(/^(feature|característica|fonction|funktionalität):/)) {
            return line; // 0 spaces
        }
        if (
            lowerLine.match(/^(rule|background|scenario|scenario outline|regla|antecedentes|escenario|esquema del escenario|règle|contexte|scénario|plan du scénario|regel|hintergrund|szenario|szenariogrundriss):/) ||
            lowerLine.startsWith('@') 
        ) {
            return '  ' + line; // 2 spaces
        }
        
        let stepIndentStr = ' '.repeat(options.stepIndentation);

        if (lowerLine.match(/^(examples|ejemplos|exemples|beispiele):/)) {
            return stepIndentStr + line;
        }
        if (lowerLine.match(/^(given|when|then|and|but|\*|dado|cuando|entonces|y|pero|soit|quand|alors|et|mais|angenommen|wenn|dann|und|aber)\s/)) {
            return stepIndentStr + line;
        }
        if (line.startsWith('"""')) {
            return stepIndentStr + '  ' + line; 
        }
        if (line.startsWith('#')) {
            return '  ' + line; 
        }

        return stepIndentStr + line;
    }

    /**
     * Aligns a block of Gherkin pipe-separated data table lines.
     * Calculates the maximum width for each column to pad them consistently.
     * 
     * @param tableLines Array of raw table lines starting with `|`.
     * @param indentSpaces Number of spaces to indent the entire table.
     * @returns Array of aligned table lines.
     */
    private alignTable(tableLines: string[], indentSpaces: number): string[] {
        const columnWidths: number[] = [];
        const parsedRows = tableLines.map(line => {
            const cols = line.split('|');
            cols.shift();
            cols.pop();
            return cols.map(c => c.trim());
        });

        parsedRows.forEach(row => {
            row.forEach((col, idx) => {
                if (!columnWidths[idx] || col.length > columnWidths[idx]) {
                    columnWidths[idx] = col.length;
                }
            });
        });

        const padding = ' '.repeat(indentSpaces);

        return parsedRows.map(row => {
            const paddedCols = row.map((col, idx) => {
                return col.padEnd(columnWidths[idx], ' ');
            });
            return padding + '| ' + paddedCols.join(' | ') + ' |';
        });
    }
}
