import * as vscode from 'vscode';

/**
 * Represents a discrete event occurring within the VS Code workspace environment.
 * Services should subscribe to the Event Bus to receive these instead of creating 
 * their own file system watchers or VS Code event listeners.
 */
export type WorkspaceEvent = 
    | { type: 'featureFileCreated', uri: vscode.Uri }
    | { type: 'featureFileChanged', uri: vscode.Uri }
    | { type: 'featureFileDeleted', uri: vscode.Uri }
    | { type: 'stepFileCreated', uri: vscode.Uri }
    | { type: 'stepFileChanged', uri: vscode.Uri }
    | { type: 'stepFileDeleted', uri: vscode.Uri }
    | { type: 'stepDefinitionsUpdated', uri: vscode.Uri }
    | { type: 'configurationChanged', event?: vscode.ConfigurationChangeEvent }
    | { type: 'textDocumentChanged', event: vscode.TextDocumentChangeEvent }
    | { type: 'textDocumentOpened', document: vscode.TextDocument }
    | { type: 'textDocumentClosed', document: vscode.TextDocument }
    | { type: 'activeEditorChanged', editor: vscode.TextEditor | undefined };

/**
 * A centralized internal message broker for the extension.
 * Decouples file watchers and generic VS Code workspace events from specific 
 * domain services (like the Linter, Cache, or Test Controller).
 */
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
