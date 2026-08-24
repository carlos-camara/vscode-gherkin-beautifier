interface TokenizedDecorator {
    type: 'given' | 'when' | 'then' | 'step';
    argumentText: string;
    isStringLiteral: boolean;
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
}

export function parsePythonDecorators(content: string): TokenizedDecorator[] {
    const decorators: TokenizedDecorator[] = [];
    const len = content.length;
    let line = 0;
    let col = 0;

    let i = 0;
    while (i < len) {
        const char = content[i];

        if (char === '@') {
            const startLine = line;
            const startCol = col;

            // Check for given/when/then/step
            let matchType: 'given' | 'when' | 'then' | 'step' | null = null;
            const rest = content.substring(i + 1, i + 10).toLowerCase();
            if (rest.startsWith('given')) matchType = 'given';
            else if (rest.startsWith('when')) matchType = 'when';
            else if (rest.startsWith('then')) matchType = 'then';
            else if (rest.startsWith('step')) matchType = 'step';

            if (matchType) {
                // Move i past the keyword
                advance(matchType.length + 1); // +1 for '@'

                // Find '('
                let foundParen = false;
                while (i < len) {
                    const c = content[i];
                    if (c === '(') {
                        foundParen = true;
                        advance(1);
                        break;
                    } else if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
                        advance(1);
                    } else {
                        break;
                    }
                }

                if (foundParen) {
                    // We are inside the decorator argument list.
                    // Parse until we hit matching ')'
                    let parens = 1;
                    const argStartIndex = i;
                    let lastValidStringContent: string | null = null;
                    let nonWhitespaceEncounteredOutsideString = false;

                    while (i < len && parens > 0) {
                        const c = content[i];

                        if (c === '(') {
                            parens++;
                            nonWhitespaceEncounteredOutsideString = true;
                            advance(1);
                        } else if (c === ')') {
                            parens--;
                            if (parens > 0) {
                                nonWhitespaceEncounteredOutsideString = true;
                            }
                            advance(1);
                        } else {
                            let isQuote = c === '\'' || c === '"';
                            let quoteIndex = i;
                            if (!isQuote) {
                                const p1 = content.substring(i, i + 1).toLowerCase();
                                const p2 = content.substring(i, i + 2).toLowerCase();
                                if (['r', 'u', 'f', 'b'].includes(p1) && (content[i + 1] === '\'' || content[i + 1] === '"')) {
                                    isQuote = true;
                                    quoteIndex = i + 1;
                                } else if (['fr', 'rf', 'br', 'rb'].includes(p2) && (content[i + 2] === '\'' || content[i + 2] === '"')) {
                                    isQuote = true;
                                    quoteIndex = i + 2;
                                }
                            }

                            if (isQuote) {
                                // Advance past the prefix
                                if (quoteIndex > i) {
                                    advance(quoteIndex - i);
                                }

                                const quoteChar = content[quoteIndex];

                                // Check for triple quotes
                                let isTriple = false;
                                if (quoteIndex + 2 < len && content[quoteIndex + 1] === quoteChar && content[quoteIndex + 2] === quoteChar) {
                                    isTriple = true;
                                }

                                const boundary = isTriple ? quoteChar + quoteChar + quoteChar : quoteChar;
                                advance(boundary.length);

                                // Scan until end of string
                                let strContent = "";
                                while (i < len) {
                                    if (content.startsWith(boundary, i)) {
                                        advance(boundary.length);
                                        break;
                                    } else if (content[i] === '\\') {
                                        strContent += content[i];
                                        advance(1);
                                        if (i < len) {
                                            strContent += content[i];
                                            advance(1);
                                        }
                                    } else {
                                        strContent += content[i];
                                        advance(1);
                                    }
                                }

                                if (!nonWhitespaceEncounteredOutsideString) {
                                    lastValidStringContent = strContent;
                                }
                            } else {
                                if (c !== ' ' && c !== '\t' && c !== '\r' && c !== '\n' && c !== '#') {
                                    nonWhitespaceEncounteredOutsideString = true;
                                }
                                // Handle inline comments if they exist
                                if (c === '#') {
                                    while (i < len && content[i] !== '\n') {
                                        advance(1);
                                    }
                                } else {
                                    advance(1);
                                }
                            }
                        }
                    }

                    if (parens === 0) {
                        // Successfully found the end
                        const rawArg = content.substring(argStartIndex, i - 1).trim();
                        decorators.push({
                            type: matchType,
                            argumentText: lastValidStringContent !== null && !nonWhitespaceEncounteredOutsideString ? lastValidStringContent : rawArg,
                            isStringLiteral: lastValidStringContent !== null && !nonWhitespaceEncounteredOutsideString,
                            startLine,
                            startCol,
                            endLine: line,
                            endCol: col
                        });
                        continue;
                    }
                }
            }
        }

        // Advance character
        if (i < len) {
            advance(1);
        }
    }

    return decorators;

    function advance(n: number) {
        for (let k = 0; k < n && i < len; k++) {
            if (content[i] === '\n') {
                line++;
                col = 0;
            } else {
                col++;
            }
            i++;
        }
    }
}

interface TokenizedExecuteStep {
    keyword: string;
    text: string;
    line: number;
}

export function parseExecuteSteps(content: string): TokenizedExecuteStep[][] {
    const blocks: TokenizedExecuteStep[][] = [];
    const regex = /execute_steps\s*\(\s*(?:u|f|r|b)?(?:'''|"""|'|")([\s\S]*?)(?:'''|"""|'|")\s*\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const executeString = match[1];
        const matchStart = match.index;

        // Calculate 0-indexed line number where the string starts
        const upToMatch = content.substring(0, matchStart);
        const upToMatchLines = upToMatch.split(/\r?\n/);
        let currentLine = upToMatchLines.length - 1;

        const executeCallPart = match[0].substring(0, match[0].indexOf(match[1]));
        currentLine += executeCallPart.split(/\r?\n/).length - 1;

        const stringLines = executeString.split(/\r?\n/);
        const blockSteps: TokenizedExecuteStep[] = [];
        for (let i = 0; i < stringLines.length; i++) {
            const trimmed = stringLines[i].trim();
            const keywordMatch = trimmed.match(/^(Given|When|Then|And|But)\s+(.*)$/i);
            if (keywordMatch) {
                blockSteps.push({
                    keyword: keywordMatch[1],
                    text: keywordMatch[2],
                    line: currentLine + i
                });
            }
        }
        if (blockSteps.length > 0) {
            blocks.push(blockSteps);
        }
    }
    return blocks;
}
