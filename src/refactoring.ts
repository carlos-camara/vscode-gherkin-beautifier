import * as vscode from 'vscode';
import { WorkspaceGraph, StepDefNode } from './graph';
import { SymbolCache } from './cache';
import { ResourceIdentity } from './utils/resourceIdentity';

export class StepRefactoringService {
    private graph: WorkspaceGraph;
    private symbolCache: SymbolCache;

    constructor(graph: WorkspaceGraph, symbolCache: SymbolCache) {
        this.graph = graph;
        this.symbolCache = symbolCache;
    }

    /**
     * Rename a step and all its usages.
     * @param document The document where the rename was initiated
     * @param position The position of the cursor
     * @param newName The new name for the step
     * @returns A WorkspaceEdit containing the changes
     */
    public async renameStep(document: vscode.TextDocument, position: vscode.Position, newName: string): Promise<vscode.WorkspaceEdit | undefined> {
        await this.graph.initialize(); // Ensure graph is ready

        const edit = new vscode.WorkspaceEdit();
        const uriStr = ResourceIdentity.getCanonicalUriString(document.uri);
        let targetDefNode: StepDefNode | undefined;

        if (uriStr.endsWith('.feature')) {
            const stepId = `${uriStr}:${position.line + 1}`;
            const stepNode = this.graph.currentGeneration.getAllStepNodes().find(n => n.id === stepId);
            if (stepNode && stepNode.definitionId) {
                targetDefNode = this.graph.currentGeneration.getAllStepDefNodes().find(n => n.id === stepNode.definitionId);
            }
        } else if (uriStr.endsWith('.py')) {
            const allDefs = this.graph.currentGeneration.getAllStepDefNodes().filter(n => n.uri === uriStr);
            targetDefNode = allDefs.find(n => position.line === n.line || position.line === n.line + 1); // rough check
            if (!targetDefNode) {
                const cachedDefs = await this.symbolCache.getAllStepDefinitions();
                const matched = cachedDefs.find(d => ResourceIdentity.getCanonicalUriString(d.uri) === uriStr && 
                    (d.decoratorRange.contains(position) || (d.functionRange && d.functionRange.contains(position)))
                );
                if (matched) {
                    targetDefNode = this.graph.currentGeneration.getAllStepDefNodes().find(n => n.id === `${uriStr}:${matched.decoratorRange.start.line}`);
                }
            }
        }

        if (!targetDefNode) {
            return undefined;
        }

        // 1. Update Python Definition
        const cachedDefs = await this.symbolCache.getAllStepDefinitions();
        const defDetails = cachedDefs.find(d => `${ResourceIdentity.getCanonicalUriString(d.uri)}:${d.decoratorRange.start.line}` === targetDefNode!.id);
        
        if (defDetails) {
            // Find the string inside the decorator
            const doc = await vscode.workspace.openTextDocument(defDetails.uri);
            const decoratorLineText = doc.lineAt(defDetails.decoratorRange.start.line).text;
            
            const leadingWhitespaceMatch = decoratorLineText.match(/^([ \t]*)/);
            const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : '';
            
            // Reconstruct decorator with new name
            let newDecorator = decoratorLineText;
            if (defDetails.matcherType === 're') {
                newDecorator = `${leadingWhitespace}@${defDetails.type}(re.compile(r'${newName}'))`;
            } else {
                newDecorator = `${leadingWhitespace}@${defDetails.type}('${newName}')`;
            }

            edit.replace(defDetails.uri, new vscode.Range(defDetails.decoratorRange.start.line, 0, defDetails.decoratorRange.start.line, decoratorLineText.length), newDecorator);
        }

        // 2. Update Feature Usages
        const usages = this.graph.currentGeneration.getUsages(targetDefNode.id);
        const uniqueScenarios = new Set<string>();
        const uniqueFeatures = new Set<string>();

        for (const usage of usages) {
            uniqueFeatures.add(usage.uri);
            if (usage.parent) {
                uniqueScenarios.add(usage.parent);
            }

            const usageUri = vscode.Uri.parse(usage.uri);
            const usageDoc = await vscode.workspace.openTextDocument(usageUri);
            const lineIdx = usage.line - 1;
            const lineText = usageDoc.lineAt(lineIdx).text;
            
            // Replace the text after the keyword, respecting any dialect
            const stepText = usage.text;
            const keyword = usage.keyword.trim();
            
            // Find the keyword in the line, and start searching for stepText after it
            const keywordIdx = lineText.indexOf(keyword);
            const searchStartIdx = keywordIdx !== -1 ? keywordIdx + keyword.length : 0;
            const textStartIdx = lineText.indexOf(stepText, searchStartIdx);
            
            if (textStartIdx !== -1) {
                edit.replace(usageUri, new vscode.Range(lineIdx, textStartIdx, lineIdx, textStartIdx + stepText.length), newName);
            }
        }

        // 3. Progressive Disclosure / Impact Analysis Warning
        // If graph is still initializing or out of sync, unique counts might be 0, so we just do a simple replacement.
        // If impact is high (many scenarios or across features), force VS Code Refactor Preview.
        const isHighImpact = uniqueScenarios.size > 3 || uniqueFeatures.size > 1;

        if (isHighImpact && usages.length > 0) {
            const metadata: vscode.WorkspaceEditEntryMetadata = {
                needsConfirmation: true,
                label: `High Impact Rename: ${uniqueScenarios.size} scenarios across ${uniqueFeatures.size} features`
            };

            const finalEdit = new vscode.WorkspaceEdit();
            for (const [uri, textEdits] of edit.entries()) {
                for (const textEdit of textEdits) {
                    finalEdit.replace(uri, textEdit.range, textEdit.newText, metadata);
                }
            }
            return finalEdit;
        }

        return edit;
    }

    /**
     * Extract a selected block of steps into a single step definition.
     */
    public async extractStep(document: vscode.TextDocument, range: vscode.Range, newName: string, targetPythonUri?: vscode.Uri): Promise<vscode.WorkspaceEdit | undefined> {
        const edit = new vscode.WorkspaceEdit();
        
        // 1. Get original text
        const originalText = document.getText(range);
        
        // Infer keyword based on the steps being extracted
        let keyword = 'step'; // fallback for python decorator
        let featureKeyword = '*'; // fallback for feature file

        if (/^\s*given\b/im.test(originalText)) {
            keyword = 'given';
            featureKeyword = 'Given';
        } else if (/^\s*when\b/im.test(originalText)) {
            keyword = 'when';
            featureKeyword = 'When';
        } else if (/^\s*then\b/im.test(originalText)) {
            keyword = 'then';
            featureKeyword = 'Then';
        }
        
        // 2. Replace feature file lines with new step
        const leadingWhitespaceMatch = originalText.match(/^([ \t]*)/);
        const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : '';
        const newStepLine = `${leadingWhitespace}${featureKeyword} ${newName}`;
        edit.replace(document.uri, range, newStepLine);

        // 3. Create Python stub
        if (targetPythonUri) {
            const pyDoc = await vscode.workspace.openTextDocument(targetPythonUri);
            let newPyCode = `\n\n@${keyword}('${newName}')\ndef step_impl(context):\n    context.execute_steps(u'''\n`;
            
            // Indent the original text for the triple-quoted string
            const indentedOriginal = originalText.split('\n').map(line => `        ${line.trim()}`).join('\n');
            newPyCode += indentedOriginal + `\n    ''')\n`;
            
            const eof = new vscode.Position(pyDoc.lineCount, 0);
            edit.insert(targetPythonUri, eof, newPyCode);
        }
        
        return edit;
    }



}
