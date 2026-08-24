import * as vscode from 'vscode';

export function generateStepDefId(
    semanticType: string,
    matcherType: string,
    rawPattern: string,
    uri: vscode.Uri,
    functionName: string = 'unknown'
): string {
    const relativeUri = vscode.workspace.asRelativePath(uri, false);
    // Escape colons in pattern/URI/functionName to prevent parsing issues
    const safePattern = rawPattern.replace(/:/g, '%3A');
    const safeUri = relativeUri.replace(/:/g, '%3A');
    const safeFunction = functionName.replace(/:/g, '%3A');
    return `${semanticType}:${matcherType}:${safePattern}:${safeUri}:${safeFunction}`;
}

export interface StepDefinitionIdentity {
    semanticType: string;
    matcherType: string;
    rawPattern: string;
    relativeUri: string;
    functionName: string;
}

export function parseStepDefId(id: string): StepDefinitionIdentity | undefined {
    const parts = id.split(':');
    if (parts.length !== 5) return undefined;
    
    return {
        semanticType: parts[0],
        matcherType: parts[1],
        rawPattern: parts[2].replace(/%3A/g, ':'),
        relativeUri: parts[3].replace(/%3A/g, ':'),
        functionName: parts[4].replace(/%3A/g, ':')
    };
}
