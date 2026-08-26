import * as vscode from 'vscode';

export class SourceLocationPresenter {
    /**
     * Formats a URI into a workspace-relative path if inside the workspace.
     * In multi-root workspaces, it prepends the folder name.
     * If outside the workspace, it prevents leaking long absolute user paths 
     * by returning a shortened version: `.../parent/basename.ext`.
     */
    static formatPath(uri: vscode.Uri): string {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
            // asRelativePath by default includes the folder name if there are multiple roots
            return vscode.workspace.asRelativePath(uri, true);
        }

        // Out of workspace: shorten to prevent absolute path exposure
        return this.shortenOutOfWorkspacePath(uri);
    }

    /**
     * Formats a URI concisely for tight UIs (Hovers, QuickPicks).
     * Returns: `parent/basename.ext`.
     * If multi-root, prepends workspace name: `folder/.../parent/basename.ext`
     */
    static formatShort(uri: vscode.Uri): string {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const shortPath = this.getShortPath(uri);
        
        if (workspaceFolder && (vscode.workspace.workspaceFolders || []).length > 1) {
            return `${workspaceFolder.name}/.../${shortPath}`;
        }
        
        return shortPath;
    }

    /**
     * Creates a markdown link for clickable navigation.
     */
    static formatMarkdownLink(uri: vscode.Uri, line?: number, label?: string): string {
        const displayLabel = label || this.formatShort(uri);
        // Ensure URI toString doesn't encode fragments if we append them manually
        let linkUri = uri.toString();
        if (line !== undefined) {
            linkUri = linkUri.includes('#') ? linkUri : `${linkUri}#${line}`;
        }
        return `[${displayLabel}](${linkUri})`;
    }

    private static shortenOutOfWorkspacePath(uri: vscode.Uri): string {
        return `.../${this.getShortPath(uri)}`;
    }

    private static getShortPath(uri: vscode.Uri): string {
        const parts = uri.path.split('/').filter(p => p.length > 0);
        if (parts.length === 0) {
            // Fallback for URIs without a standard path structure (e.g. some custom schemes)
            return uri.scheme ? `${uri.scheme}:` : 'unknown';
        }
        if (parts.length === 1) {
            return parts[0];
        }
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
}
