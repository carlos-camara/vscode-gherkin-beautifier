import * as vscode from 'vscode';
import { WorkspaceGraph, StepNode, StepDefNode } from './graph';
import { SymbolCache } from './cache';

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
        const uriStr = document.uri.toString();
        let targetDefNode: StepDefNode | undefined;

        if (uriStr.endsWith('.feature')) {
            const stepId = `${uriStr}:${position.line}`;
            const stepNode = this.graph.getAllStepNodes().find(n => n.id === stepId);
            if (stepNode && stepNode.definitionId) {
                targetDefNode = this.graph.getAllStepDefNodes().find(n => n.id === stepNode.definitionId);
            }
        } else if (uriStr.endsWith('.py')) {
            const allDefs = this.graph.getAllStepDefNodes().filter(n => n.uri === uriStr);
            targetDefNode = allDefs.find(n => position.line === n.line || position.line === n.line + 1); // rough check
            // For exact check, we should query SymbolCache
            if (!targetDefNode) {
                const cachedDefs = await this.symbolCache.getAllStepDefinitions();
                const matched = cachedDefs.find(d => d.uri.toString() === uriStr && 
                    (d.decoratorRange.contains(position) || (d.functionRange && d.functionRange.contains(position)))
                );
                if (matched) {
                    targetDefNode = this.graph.getAllStepDefNodes().find(n => n.id === `${uriStr}:${matched.decoratorRange.start.line}`);
                }
            }
        }

        if (!targetDefNode) {
            return undefined;
        }

        // 1. Update Python Definition
        const cachedDefs = await this.symbolCache.getAllStepDefinitions();
        const defDetails = cachedDefs.find(d => `${d.uri.toString()}:${d.decoratorRange.start.line}` === targetDefNode!.id);
        
        if (defDetails) {
            // Find the string inside the decorator
            const doc = await vscode.workspace.openTextDocument(defDetails.uri);
            const decoratorLineText = doc.lineAt(defDetails.decoratorRange.start.line).text;
            
            // Reconstruct decorator with new name
            let newDecorator = decoratorLineText;
            if (defDetails.matcherType === 're') {
                newDecorator = `@${defDetails.type}(re.compile(r'${newName}'))`;
            } else {
                newDecorator = `@${defDetails.type}('${newName}')`;
            }

            edit.replace(defDetails.uri, new vscode.Range(defDetails.decoratorRange.start.line, 0, defDetails.decoratorRange.start.line, decoratorLineText.length), newDecorator);
        }

        // 2. Update Feature Usages
        const usages = this.graph.getUsages(targetDefNode.id);
        for (const usage of usages) {
            const usageUri = vscode.Uri.parse(usage.uri);
            const usageDoc = await vscode.workspace.openTextDocument(usageUri);
            const lineText = usageDoc.lineAt(usage.line).text;
            
            // Replace the text after the keyword
            // Keyword could be Given, When, Then, And, But (with possible spaces)
            const match = lineText.match(/^(\s*(?:Given|When|Then|And|But|\*)\s+)(.*)$/i);
            if (match) {
                const prefix = match[1];
                const newText = prefix + newName;
                edit.replace(usageUri, new vscode.Range(usage.line, 0, usage.line, lineText.length), newText);
            }
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
        
        // 2. Replace feature file lines with new step
        const leadingWhitespaceMatch = originalText.match(/^([ \t]*)/);
        const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : '';
        const newStepLine = `${leadingWhitespace}* ${newName}`;
        edit.replace(document.uri, range, newStepLine);

        // 3. Create Python stub
        if (targetPythonUri) {
            const pyDoc = await vscode.workspace.openTextDocument(targetPythonUri);
            let newPyCode = `\n\n@step('${newName}')\ndef step_impl(context):\n    context.execute_steps(u'''\n`;
            
            // Indent the original text for the triple-quoted string
            const indentedOriginal = originalText.split('\n').map(line => `        ${line.trim()}`).join('\n');
            newPyCode += indentedOriginal + `\n    ''')\n`;
            
            const eof = new vscode.Position(pyDoc.lineCount, 0);
            edit.insert(targetPythonUri, eof, newPyCode);
        }
        
        return edit;
    }

    /**
     * Merge multiple step definitions into a single definition.
     */
    public async mergeSteps(stepDefinitionIds: string[], newName: string): Promise<vscode.WorkspaceEdit | undefined> {
        if (stepDefinitionIds.length < 2) return undefined;
        await this.graph.initialize();

        const edit = new vscode.WorkspaceEdit();
        
        const defNodes = stepDefinitionIds.map(id => this.graph.getAllStepDefNodes().find(n => n.id === id)).filter(n => !!n) as StepDefNode[];
        if (defNodes.length === 0) return undefined;

        // 1. Update all usages to the new name
        const allUsages: StepNode[] = [];
        for (const defNode of defNodes) {
            allUsages.push(...this.graph.getUsages(defNode.id));
        }

        for (const usage of allUsages) {
            const usageUri = vscode.Uri.parse(usage.uri);
            const usageDoc = await vscode.workspace.openTextDocument(usageUri);
            const lineText = usageDoc.lineAt(usage.line).text;
            
            const match = lineText.match(/^(\s*(?:Given|When|Then|And|But|\*)\s+)(.*)$/i);
            if (match) {
                const prefix = match[1];
                const newText = prefix + newName;
                edit.replace(usageUri, new vscode.Range(usage.line, 0, usage.line, lineText.length), newText);
            }
        }

        const cachedDefs = await this.symbolCache.getAllStepDefinitions();

        // 2. Rename the first definition
        const firstDef = defNodes[0];
        const firstCachedDef = cachedDefs.find(d => `${d.uri.toString()}:${d.decoratorRange.start.line}` === firstDef.id);
        if (firstCachedDef) {
            const doc = await vscode.workspace.openTextDocument(firstCachedDef.uri);
            const decoratorLineText = doc.lineAt(firstCachedDef.decoratorRange.start.line).text;
            
            let newDecorator = decoratorLineText;
            if (firstCachedDef.matcherType === 're') {
                newDecorator = `@${firstCachedDef.type}(re.compile(r'${newName}'))`;
            } else {
                newDecorator = `@${firstCachedDef.type}('${newName}')`;
            }
            edit.replace(firstCachedDef.uri, new vscode.Range(firstCachedDef.decoratorRange.start.line, 0, firstCachedDef.decoratorRange.start.line, decoratorLineText.length), newDecorator);
        }

        // 3. Delete the other definitions
        for (let i = 1; i < defNodes.length; i++) {
            const defToDel = defNodes[i];
            const cachedToDel = cachedDefs.find(d => `${d.uri.toString()}:${d.decoratorRange.start.line}` === defToDel.id);
            if (cachedToDel && cachedToDel.functionRange) {
                // Delete from decorator start to function end
                edit.delete(cachedToDel.uri, new vscode.Range(cachedToDel.decoratorRange.start.line, 0, cachedToDel.functionRange.end.line + 1, 0));
            }
        }

        return edit;
    }

    /**
     * Move a step definition to another Python file.
     */
    public async moveStepDefinition(definitionId: string, targetPythonUri: vscode.Uri): Promise<vscode.WorkspaceEdit | undefined> {
        await this.graph.initialize();
        const edit = new vscode.WorkspaceEdit();

        const defNode = this.graph.getAllStepDefNodes().find(n => n.id === definitionId);
        if (!defNode) return undefined;

        const cachedDefs = await this.symbolCache.getAllStepDefinitions();
        const cachedDef = cachedDefs.find(d => `${d.uri.toString()}:${d.decoratorRange.start.line}` === defNode.id);
        if (!cachedDef || !cachedDef.functionRange) return undefined;

        // 1. Get the source code
        const sourceDoc = await vscode.workspace.openTextDocument(cachedDef.uri);
        const sourceCode = sourceDoc.getText(new vscode.Range(cachedDef.decoratorRange.start.line, 0, cachedDef.functionRange.end.line + 1, 0));

        // 2. Delete from source
        edit.delete(cachedDef.uri, new vscode.Range(cachedDef.decoratorRange.start.line, 0, cachedDef.functionRange.end.line + 1, 0));

        // 3. Append to target
        const targetDoc = await vscode.workspace.openTextDocument(targetPythonUri);
        const eof = new vscode.Position(targetDoc.lineCount, 0);
        edit.insert(targetPythonUri, eof, `\n${sourceCode}`);

        return edit;
    }
}
