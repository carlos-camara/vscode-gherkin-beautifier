import * as vscode from 'vscode';
import { ConfigurationService } from './configuration';
import { WorkspaceEventBus } from './eventBus';

export class BehaveFileDiscoveryService {
    private stepWatchers: vscode.FileSystemWatcher[] = [];
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    public configService?: ConfigurationService;
    public eventBus?: WorkspaceEventBus;

    // Validates and normalizes an array of glob strings
    public normalizeGlobs(globs: any, defaultGlobs: string[]): string[] {
        if (!globs || !Array.isArray(globs) || globs.length === 0) {
            return defaultGlobs;
        }
        const validGlobs = globs.filter(g => typeof g === 'string' && g.trim().length > 0);
        return validGlobs.length > 0 ? validGlobs : defaultGlobs;
    }

    public getStepGlobs(uri?: vscode.Uri): string[] {
        if (this.configService) {
            return this.configService.getConfiguration(uri).behave.stepGlobs;
        }
        return ['**/steps/**/*.py', '**/features/steps/**/*.py'];
    }

    public getIgnoreGlobs(uri?: vscode.Uri): string[] {
        if (this.configService) {
            return this.configService.getConfiguration(uri).behave.ignoreGlobs;
        }
        return ['**/node_modules/**', '**/.venv/**', '**/venv/**', '**/env/**'];
    }

    public getGlobPattern(uri?: vscode.Uri): string {
        const globs = this.getStepGlobs(uri);
        return globs.length > 1 ? `{${globs.join(',')}}` : globs[0];
    }

    public getExcludePattern(uri?: vscode.Uri): string {
        const globs = this.getIgnoreGlobs(uri);
        return globs.length > 1 ? `{${globs.join(',')}}` : globs[0];
    }

    public globToRegex(glob: string): RegExp {
        const normalized = glob.replace(/\\/g, '/').trim();
        let pattern = normalized;
        if (pattern.startsWith('**/')) {
            pattern = pattern.substring(3);
        }
        
        let regexStr = '';
        for (let i = 0; i < pattern.length; i++) {
            if (pattern.substring(i, i + 3) === '/**' && (i + 3 === pattern.length || pattern[i + 3] === '/')) {
                regexStr += '(?:/.*)?';
                i += 2;
                if (i + 1 < pattern.length && pattern[i + 1] === '/') {
                    i++;
                }
                continue;
            }

            const c = pattern[i];
            if (c === '*') {
                if (pattern[i + 1] === '*') {
                    regexStr += '.*';
                    i++;
                } else {
                    regexStr += '[^/]*';
                }
            } else if (c === '?') {
                regexStr += '[^/]';
            } else if ('./+?^${}()|[]\\'.includes(c)) {
                regexStr += '\\' + c;
            } else {
                regexStr += c;
            }
        }
        return new RegExp(`(?:^|/)${regexStr}$`, 'i');
    }

    public isIgnored(uri: vscode.Uri, ignoreGlobs?: string[]): boolean {
        const globs = ignoreGlobs || this.getIgnoreGlobs(uri);
        const pathString = uri.fsPath.replace(/\\/g, '/');

        for (const rawGlob of globs) {
            if (!rawGlob || typeof rawGlob !== 'string' || rawGlob.trim().length === 0) {
                continue;
            }
            const glob = rawGlob.trim().replace(/\\/g, '/');

            // 1. Check path segment ignores like **/node_modules/**, **/.venv/**, **/venv/**, **/env/**
            const segmentMatch = glob.match(/^\*\*\/([^/*]+)\/\*\*$/);
            if (segmentMatch) {
                const segment = segmentMatch[1];
                const segmentRegex = new RegExp(`(?:^|/)${segment.replace(/[-[\]{}()+^$.,\\#\s]/g, '\\$&')}(?:/|$)`, 'i');
                if (segmentRegex.test(pathString)) {
                    return true;
                }
                continue;
            }

            // 2. Check general glob pattern
            try {
                const regex = this.globToRegex(glob);
                if (regex.test(pathString) || regex.test(uri.path)) {
                    return true;
                }
            } catch (err) {
                if (pathString.includes(glob)) {
                    return true;
                }
            }
        }

        return false;
    }

    public async getStepFiles(): Promise<vscode.Uri[]> {
        const fileMap = new Map<string, vscode.Uri>();
        
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            // No workspace folders, fallback to global
            const stepGlobs = this.getStepGlobs(undefined);
            const excludePattern = this.getExcludePattern(undefined);
            const ignoreGlobs = this.getIgnoreGlobs(undefined);
            for (const pattern of stepGlobs) {
                const files = await vscode.workspace.findFiles(pattern, excludePattern);
                for (const file of files) {
                    if (!this.isIgnored(file, ignoreGlobs)) {
                        fileMap.set(file.toString(), file);
                    }
                }
            }
            return Array.from(fileMap.values());
        }

        for (const folder of vscode.workspace.workspaceFolders) {
            const stepGlobs = this.getStepGlobs(folder.uri);
            const excludePattern = this.getExcludePattern(folder.uri);
            const ignoreGlobs = this.getIgnoreGlobs(folder.uri);
            for (const pattern of stepGlobs) {
                const relativePattern = new vscode.RelativePattern(folder, pattern);
                const files = await vscode.workspace.findFiles(relativePattern, excludePattern);
                for (const file of files) {
                    if (!this.isIgnored(file, ignoreGlobs)) {
                        fileMap.set(file.toString(), file);
                    }
                }
            }
        }
        
        return Array.from(fileMap.values());
    }

    public debounceEvent(key: string, fn: () => void, delayMs = 100): void {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key)!);
        }
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
            fn();
        }, delayMs);
        this.debounceTimers.set(key, timer);
    }

    public setupWatchers(): vscode.FileSystemWatcher[] {
        this.disposeWatchers();

        const wrapCreated = (uri: vscode.Uri, folderUri?: vscode.Uri) => {
            const ignoreGlobs = this.getIgnoreGlobs(folderUri);
            if (this.isIgnored(uri, ignoreGlobs)) return;
            this.debounceEvent(`create:${uri.toString()}`, () => this.eventBus?.publish({ type: 'stepFileCreated', uri }));
        };

        const wrapChanged = (uri: vscode.Uri, folderUri?: vscode.Uri) => {
            const ignoreGlobs = this.getIgnoreGlobs(folderUri);
            if (this.isIgnored(uri, ignoreGlobs)) return;
            this.debounceEvent(`change:${uri.toString()}`, () => this.eventBus?.publish({ type: 'stepFileChanged', uri }));
        };

        const wrapDeleted = (uri: vscode.Uri, folderUri?: vscode.Uri) => {
            const ignoreGlobs = this.getIgnoreGlobs(folderUri);
            if (this.isIgnored(uri, ignoreGlobs)) return;
            this.debounceEvent(`delete:${uri.toString()}`, () => this.eventBus?.publish({ type: 'stepFileDeleted', uri }));
        };
        
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            const uniqueGlobs = Array.from(new Set(this.getStepGlobs(undefined)));
            for (const pattern of uniqueGlobs) {
                const watcher = vscode.workspace.createFileSystemWatcher(pattern);
                watcher.onDidCreate(uri => wrapCreated(uri));
                watcher.onDidChange(uri => wrapChanged(uri));
                watcher.onDidDelete(uri => wrapDeleted(uri));
                this.stepWatchers.push(watcher);
            }
            return this.stepWatchers;
        }

        for (const folder of vscode.workspace.workspaceFolders) {
            const uniqueGlobs = Array.from(new Set(this.getStepGlobs(folder.uri)));
            for (const pattern of uniqueGlobs) {
                const relativePattern = new vscode.RelativePattern(folder, pattern);
                const watcher = vscode.workspace.createFileSystemWatcher(relativePattern);
                watcher.onDidCreate(uri => wrapCreated(uri, folder.uri));
                watcher.onDidChange(uri => wrapChanged(uri, folder.uri));
                watcher.onDidDelete(uri => wrapDeleted(uri, folder.uri));
                this.stepWatchers.push(watcher);
            }
        }
        
        return this.stepWatchers;
    }

    public disposeWatchers(): void {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        for (const watcher of this.stepWatchers) {
            watcher.dispose();
        }
        this.stepWatchers = [];
    }

    public getBestWorkspaceFolder(documentUri: vscode.Uri): vscode.WorkspaceFolder | undefined {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return undefined;
        }

        const folder = vscode.workspace.getWorkspaceFolder(documentUri);
        if (folder) {
            return folder;
        }

        // Fallback to the first workspace folder
        return vscode.workspace.workspaceFolders[0];
    }
}

export const discoveryService = new BehaveFileDiscoveryService();
