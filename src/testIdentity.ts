import * as vscode from 'vscode';

export type TestNodeType = 'feature' | 'rule' | 'scenario' | 'outline' | 'examples' | 'row' | 'error';

export class TestIdentity {
    public readonly uri: vscode.Uri;
    public readonly type: TestNodeType;
    public readonly line?: number;

    private constructor(uri: vscode.Uri, type: TestNodeType, line?: number) {
        this.uri = uri;
        this.type = type;
        this.line = line;
    }

    /**
     * Creates a deterministic TestItem ID string.
     */
    public static createId(uri: vscode.Uri, type: TestNodeType, line?: number): string {
        if (line !== undefined) {
            return `${uri.toString()}?type=${type}&line=${line}`;
        }
        return `${uri.toString()}?type=${type}`;
    }

    /**
     * Parses a TestItem ID string back into a TestIdentity.
     * Returns an 'error' type identity if the ID is malformed or an old string format.
     */
    public static parse(id: string): TestIdentity {
        const parts = id.split('?');
        if (parts.length < 2) {
            // Fallback for legacy IDs if any happen to still exist in caches, though ideally they shouldn't.
            try {
                const uriPart = id.split('#')[0];
                return new TestIdentity(vscode.Uri.parse(uriPart), 'error');
            } catch {
                return new TestIdentity(vscode.Uri.file(''), 'error');
            }
        }

        try {
            const uri = vscode.Uri.parse(parts[0]);
            const query = new URLSearchParams(parts[1]);
            
            const typeParam = query.get('type') as TestNodeType | null;
            const type = typeParam ?? 'error';
            
            const lineParam = query.get('line');
            const line = lineParam ? parseInt(lineParam, 10) : undefined;
            
            return new TestIdentity(uri, type, line);
        } catch (e) {
            return new TestIdentity(vscode.Uri.file(''), 'error');
        }
    }
}
