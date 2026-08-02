import * as path from 'path';
import * as fs from 'fs';
import glob from 'fast-glob';

// --- Types ---
export class Uri {
    constructor(public scheme: string, public authority: string, public path: string, public query: string, public fragment: string) {}

    static file(filePath: string): Uri {
        return new Uri('file', '', path.resolve(filePath), '', '');
    }

    static parse(uriString: string): Uri {
        if (uriString.startsWith('file://')) {
            return Uri.file(uriString.substring(7));
        }
        return Uri.file(uriString);
    }

    get fsPath(): string {
        return this.path;
    }

    toString(): string {
        return `file://${this.path}`;
    }
}

export class Position {
    constructor(public line: number, public character: number) {}
}

export class Range {
    start: Position;
    end: Position;
    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
    constructor(start: Position, end: Position);
    constructor(arg1: any, arg2: any, arg3?: any, arg4?: any) {
        if (typeof arg1 === 'number') {
            this.start = new Position(arg1, arg2);
            this.end = new Position(arg3, arg4);
        } else {
            this.start = arg1;
            this.end = arg2;
        }
    }
}

export class Location {
    constructor(public uri: Uri, public rangeOrPosition: Range | Position) {}
}

export class RelativePattern {
    constructor(public base: string | { uri: Uri }, public pattern: string) {}
}

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3
}

export class Diagnostic {
    constructor(public range: Range, public message: string, public severity?: DiagnosticSeverity) {}
    source?: string;
    code?: string | number;
}

export class TextEdit {
    constructor(public range: Range, public newText: string) {}
    static replace(range: Range, newText: string): TextEdit {
        return new TextEdit(range, newText);
    }
}

export enum EndOfLine {
    LF = 1,
    CRLF = 2
}

export class CancellationTokenSource {
    token = { isCancellationRequested: false, onDidChange: new EventEmitter().event };
    cancel(): void { this.token.isCancellationRequested = true; }
    dispose(): void {}
}

export class Disposable {
    static from(...disposables: { dispose(): any }[]): Disposable {
        return new Disposable(() => {
            for (const d of disposables) d.dispose();
        });
    }
    constructor(private callOnDispose: () => any) {}
    dispose(): any {
        this.callOnDispose();
    }
}

export class EventEmitter<T> {
    private listeners: ((e: T) => any)[] = [];
    event = (listener: (e: T) => any, _thisArgs?: any, disposables?: Disposable[]): Disposable => {
        this.listeners.push(listener);
        const disposable = new Disposable(() => {
            this.listeners = this.listeners.filter(l => l !== listener);
        });
        if (disposables) disposables.push(disposable);
        return disposable;
    };
    fire(data: T): void {
        for (const listener of this.listeners) {
            listener(data);
        }
    }
    dispose(): void {
        this.listeners = [];
    }
}

export class ThemeColor {
    constructor(public id: string) {}
}

export class ThemeIcon {
    constructor(public id: string, public color?: ThemeColor) {}
}

// --- Workspace ---
class WorkspaceConfiguration {
    get<T>(section: string, defaultValue?: T): T {
        // Return sensible defaults for CLI
        if (section === 'behave.stepGlobs') return ['**/steps/**/*.py', '**/features/steps/**/*.py'] as any;
        if (section === 'behave.ignoreGlobs') return ['**/node_modules/**', '**/.venv/**', '**/venv/**', '**/env/**'] as any;
        if (section === 'format.indentation.steps') return 4 as any;
        if (section === 'format.emptyLines.betweenScenarios') return 1 as any;
        return defaultValue as any;
    }
    inspect(section: string): any {
        return {
            globalValue: undefined,
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
            defaultValue: this.get(section)
        };
    }
    update(): Promise<void> {
        return Promise.resolve();
    }
}

class FileSystem {
    async readFile(uri: Uri): Promise<Uint8Array> {
        return fs.promises.readFile(uri.fsPath);
    }
    async stat(uri: Uri): Promise<any> {
        const stats = await fs.promises.stat(uri.fsPath);
        return { type: stats.isFile() ? 1 : 2, size: stats.size, ctime: stats.ctimeMs, mtime: stats.mtimeMs };
    }
    async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
        return fs.promises.writeFile(uri.fsPath, content);
    }
}

class TextDocument {
    public uri: Uri;
    public version: number = 1;
    public eol: EndOfLine = EndOfLine.LF;
    private lines: string[];

    constructor(uri: Uri, content: string) {
        this.uri = uri;
        this.lines = content.split('\n');
    }

    getText(): string {
        return this.lines.join('\n');
    }
    
    lineAt(line: number): { text: string } {
        return { text: this.lines[line] || '' };
    }

    get lineCount(): number {
        return this.lines.length;
    }
}

export const workspace = {
    workspaceFolders: [{ uri: Uri.file(process.cwd()), name: path.basename(process.cwd()), index: 0 }],
    getWorkspaceFolder: (_uri: Uri) => ({ uri: Uri.file(process.cwd()), name: path.basename(process.cwd()), index: 0 }),
    fs: new FileSystem(),
    textDocuments: [],
    getConfiguration: (_section?: string) => new WorkspaceConfiguration(),
    async findFiles(include: string | RelativePattern, exclude?: string | RelativePattern | null, maxResults?: number): Promise<Uri[]> {
        let cwd = process.cwd();
        let incl = typeof include === 'string' ? include : include.pattern;
        
        if (typeof include !== 'string' && include.base) {
            cwd = typeof include.base === 'string' ? include.base : include.base.uri.fsPath;
        }

        if (typeof incl === 'string' && incl.startsWith('**')) {
             // fast glob handles ** fine
        }
        
        const ignore = exclude ? (typeof exclude === 'string' ? [exclude] : [exclude.pattern]) : ['**/node_modules/**', '**/.git/**'];
        
        const files = await glob(incl, { cwd, ignore, absolute: true, suppressErrors: true });
        return files.slice(0, maxResults || files.length).map(f => Uri.file(f));
    },
    openTextDocument: async (uri: Uri | string): Promise<TextDocument> => {
        const parsed = typeof uri === 'string' ? Uri.parse(uri) : uri;
        const content = await fs.promises.readFile(parsed.fsPath, 'utf8');
        return new TextDocument(parsed, content);
    },
    onDidSaveTextDocument: new EventEmitter<TextDocument>().event,
    onDidChangeTextDocument: new EventEmitter<any>().event,
    onDidRenameFiles: new EventEmitter<any>().event,
    onDidDeleteFiles: new EventEmitter<any>().event,
    createFileSystemWatcher: () => {
        return {
            onDidCreate: new EventEmitter<Uri>().event,
            onDidChange: new EventEmitter<Uri>().event,
            onDidDelete: new EventEmitter<Uri>().event,
            dispose: () => {}
        };
    }
};

// --- Window ---
export const window = {
    showInformationMessage: async (message: string) => { console.log(message); return undefined; },
    showWarningMessage: async (message: string) => { console.warn(message); return undefined; },
    showErrorMessage: async (message: string) => { console.error(message); return undefined; },
    withProgress: async (options: any, task: (progress: any, token: any) => Promise<any>) => {
        console.log(`[Progress] ${options.title || 'Loading...'}`);
        return task({ report: () => {} }, { isCancellationRequested: false, onDidChange: new EventEmitter().event });
    },
    createOutputChannel: (name: string) => ({
        appendLine: (msg: string) => console.log(`[${name}] ${msg}`),
        append: (msg: string) => process.stdout.write(msg),
        clear: () => {},
        show: () => {},
        dispose: () => {}
    }),
    createWebviewPanel: () => ({
        webview: { html: '', onDidReceiveMessage: new EventEmitter().event },
        onDidDispose: new EventEmitter().event,
        dispose: () => {}
    }),
    showTextDocument: async () => ({})
};

// --- Languages ---
export const languages = {
    createDiagnosticCollection: (_name: string) => ({
        set: () => {},
        clear: () => {},
        delete: () => {},
        dispose: () => {}
    })
};

// --- Extension Context ---
export const extensions = {
    getExtension: () => undefined
};

// --- Commands ---
export const commands = {
    registerCommand: () => new Disposable(() => {}),
    executeCommand: async () => undefined
};
