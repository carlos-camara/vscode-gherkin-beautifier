import * as vscode from 'vscode';

export class ResourceIdentity {
    /**
     * Determines if a URI corresponds to a case-sensitive filesystem.
     * By default, local files on Windows (win32) and macOS (darwin) are case-insensitive.
     * Linux, WSL, Remote SSH, and Virtual Filesystems are treated as case-sensitive.
     */
    public static isCaseSensitive(uri: vscode.Uri): boolean {
        if (uri.scheme === 'file') {
            return process.platform === 'linux';
        }
        // Assume virtual filesystems or remote schemas are case-sensitive.
        return true;
    }

    /**
     * Returns a stable, canonical string representation of a URI.
     * Preserves the case of the path on case-sensitive platforms,
     * but lowercases ONLY the path on case-insensitive platforms to avoid map key duplication.
     */
    public static getCanonicalUriString(uri: vscode.Uri | string): string {
        const parsedUri = typeof uri === 'string' ? vscode.Uri.parse(uri) : uri;

        if (this.isCaseSensitive(parsedUri)) {
            return parsedUri.toString();
        } else {
            // Lowercase only the path portion. The URI scheme and authority remain untouched,
            // though VS Code `toString()` normally canonicalizes scheme to lowercase anyway.
            return parsedUri.with({ path: parsedUri.path.toLowerCase() }).toString();
        }
    }
}
