import * as vscode from 'vscode';
import { StepRefactoringService } from './refactoring';
import { WorkspaceGraph } from './graph';
import { ResourceIdentity } from './utils/resourceIdentity';

export class GherkinRenameProvider implements vscode.RenameProvider {
    private refactoringService: StepRefactoringService;
    private graph: WorkspaceGraph;

    constructor(refactoringService: StepRefactoringService, graph: WorkspaceGraph) {
        this.refactoringService = refactoringService;
        this.graph = graph;
    }

    public async prepareRename(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): Promise<vscode.Range | { range: vscode.Range; placeholder: string } | undefined> {
        if (!vscode.workspace.isTrusted) {
            throw new Error('Renaming steps modifies Python code and requires Workspace Trust.');
        }
        await this.graph.initialize();
        const uriStr = ResourceIdentity.getCanonicalUriString(document.uri);
        
        let isValid = false;
        let placeholder = '';
        let range: vscode.Range | undefined;

        if (uriStr.endsWith('.feature')) {
            const stepId = `${uriStr}:${position.line + 1}`;
            const stepNode = this.graph.currentGeneration.getAllStepNodes().find(n => n.id === stepId);
            if (stepNode && stepNode.definitionId) {
                isValid = true;
                const match = document.lineAt(position.line).text.match(/^(\s*(?:Given|When|Then|And|But|\*)\s+)(.*)$/i);
                if (match) {
                    placeholder = match[2];
                    const startIdx = match[1].length;
                    range = new vscode.Range(position.line, startIdx, position.line, startIdx + match[2].length);
                }
            }
        } else if (uriStr.endsWith('.py')) {
            const defNode = this.graph.currentGeneration.getAllStepDefNodes().find(n => n.uri === uriStr && (n.line === position.line || n.line === position.line - 1 || n.line === position.line + 1));
            if (defNode) {
                isValid = true;
                placeholder = defNode.pattern;
                range = document.lineAt(position.line).range; // We'll refine this if needed
            }
        }

        if (!isValid) {
            throw new Error('You cannot rename this element. Only steps and step definitions can be renamed.');
        }

        return range ? { range, placeholder } : undefined;
    }

    public async provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string, _token: vscode.CancellationToken): Promise<vscode.WorkspaceEdit | undefined> {
        return this.refactoringService.renameStep(document, position, newName);
    }
}
