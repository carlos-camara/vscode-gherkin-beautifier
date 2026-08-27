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
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    this.suppressions = parsed;
                } else {
                    this.suppressions = [];
                }
            } catch (e) {
                this.suppressions = [];
            }
        } else {
            this.suppressions = [];
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
        
        let matchPath = fsPath;
        let matchRoot = this.workspaceRoot;
        
        if (process.platform === 'win32' || process.platform === 'darwin') {
            matchPath = matchPath.toLowerCase();
            matchRoot = matchRoot.toLowerCase();
        }
        
        // If the path is inside workspaceRoot, make it relative
        if (matchPath.startsWith(matchRoot)) {
            const rel = fsPath.substring(this.workspaceRoot.length);
            const cleanRel = rel.startsWith(path.sep) || rel.startsWith('/') ? rel.substring(1) : rel;
            // Always use forward slashes for cross-platform compatibility in config files
            return cleanRel.replace(/\\/g, '/');
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
            if (supp.uri && supp.uri !== '*') {
                let matchesUri = false;
                if (process.platform === 'win32' || process.platform === 'darwin') {
                    matchesUri = supp.uri.toLowerCase() === relativeUri.toLowerCase() || supp.uri.toLowerCase() === uriString.toLowerCase();
                } else {
                    matchesUri = supp.uri === relativeUri || supp.uri === uriString;
                }
                if (!matchesUri) return false;
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
