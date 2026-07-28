import * as vscode from 'vscode';

export type WorkspaceEvent = 
    | { type: 'featureFileCreated', uri: vscode.Uri }
    | { type: 'featureFileChanged', uri: vscode.Uri }
    | { type: 'featureFileDeleted', uri: vscode.Uri }
    | { type: 'stepFileCreated', uri: vscode.Uri }
    | { type: 'stepFileChanged', uri: vscode.Uri }
    | { type: 'stepFileDeleted', uri: vscode.Uri }
    | { type: 'configurationChanged', event?: vscode.ConfigurationChangeEvent }
    | { type: 'textDocumentChanged', event: vscode.TextDocumentChangeEvent }
    | { type: 'textDocumentOpened', document: vscode.TextDocument }
    | { type: 'activeEditorChanged', editor: vscode.TextEditor | undefined };

export class WorkspaceEventBus {
    private _onEvent = new vscode.EventEmitter<WorkspaceEvent>();
    public readonly onEvent = this._onEvent.event;

    public publish(event: WorkspaceEvent) {
        this._onEvent.fire(event);
    }
    
    public dispose() {
        this._onEvent.dispose();
    }
}
