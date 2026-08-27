import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Suppression {
    ruleId: string;
    uri?: string;
    scopeType?: string;
    scopeValue?: string;
    reason?: string;
    timestamp?: string;
    by?: string;
}

export class SuppressionEngine {
    private suppressions: Suppression[] = [];
    private suppressionsFile: string | undefined;
    private workspaceRoot: string | undefined;

    constructor(workspaceRoot?: string) {
        this.workspaceRoot = workspaceRoot;
        if (workspaceRoot) {
            this.suppressionsFile = path.join(workspaceRoot, '.gherkin-pt-suppressions.json');
            this.load();
        }
    }

    private load() {
        if (this.suppressionsFile && fs.existsSync(this.suppressionsFile)) {
            try {
                const content = fs.readFileSync(this.suppressionsFile, 'utf8');
                this.suppressions = JSON.parse(content);
            } catch (e) {
                // Ignore parse errors
            }
        }
    }

    private save() {
        if (this.suppressionsFile) {
            fs.writeFileSync(this.suppressionsFile, JSON.stringify(this.suppressions, null, 2), 'utf8');
        }
    }

    public reload() {
        this.load();
    }

    private toRelative(uriString: string): string {
        if (!this.workspaceRoot) return uriString;
        
        let fsPath = uriString;
        if (uriString.startsWith('file://')) {
            try {
                fsPath = vscode.Uri.parse(uriString).fsPath;
            } catch (e) {
                // ignore
            }
        }
        
        // If the path is inside workspaceRoot, make it relative
        if (fsPath.startsWith(this.workspaceRoot)) {
            const rel = path.relative(this.workspaceRoot, fsPath);
            // Always use forward slashes for cross-platform compatibility in config files
            return rel.replace(/\\/g, '/');
        }
        return fsPath;
    }

    public isSuppressed(ruleId: string, uri: vscode.Uri | string, scopeType?: string, scopeValue?: string): boolean {
        const uriString = typeof uri === 'string' ? uri : uri.toString();
        const relativeUri = this.toRelative(uriString);

        return this.suppressions.some(supp => {
            if (supp.ruleId !== ruleId) {
                return false;
            }
            
            // Check URI
            if (supp.uri && supp.uri !== relativeUri && supp.uri !== uriString && supp.uri !== '*') {
                return false;
            }

            // Check scope
            if (supp.scopeType) {
                if (supp.scopeType !== scopeType) {
                    return false;
                }
                if (supp.scopeValue && supp.scopeValue !== scopeValue) {
                    return false;
                }
            }

            return true;
        });
    }

    public addSuppression(suppression: Suppression) {
        if (suppression.uri) {
            suppression.uri = this.toRelative(suppression.uri);
        }
        this.suppressions.push(suppression);
        this.save();
    }

    public getSuppressedCount(): number {
        return this.suppressions.length;
    }
}
