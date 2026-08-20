import * as vscode from 'vscode';
import { ConfigurationService } from './configuration';
import { WorkspaceEventBus } from './eventBus';

export interface FeatureFileDiagnostics {
    includedCount: number;
    ignoredCount: number;
    staleCount: number;
}

export class FeatureDiscoveryService {
    private featureWatchers: vscode.FileSystemWatcher[] = [];
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    public configService?: ConfigurationService;
    private _eventBus?: WorkspaceEventBus;
    private eventBusDisposable?: vscode.Disposable;
    private _lastIncludedCount = 0;
    private _lastIgnoredCount = 0;

    /**
     * Subscribes to the Workspace Event Bus to receive configuration changes.
     */
    public set eventBus(bus: WorkspaceEventBus | undefined) {
        this._eventBus = bus;
        this.eventBusDisposable?.dispose();
        if (this._eventBus) {
            this.eventBusDisposable = this._eventBus.onEvent(e => {
                if (e.type === 'configurationChanged') {
                    this.disposeWatchers();
                    this.setupWatchers();
                }
            });
        }
    }

    public get eventBus(): WorkspaceEventBus | undefined {
        return this._eventBus;
    }

    public getFeatureGlobs(uri?: vscode.Uri): string[] {
        const globs = this.configService?.getConfiguration(uri).featureGlobs;
        if (globs && globs.length > 0) {
            return globs;
        }
        return ['**/*.feature'];
    }

    public getIgnoreGlobs(uri?: vscode.Uri): string[] {
        if (this.configService) {
            return this.configService.getConfiguration(uri).behave.ignoreGlobs;
        }
        return ['**/node_modules/**', '**/.venv/**', '**/venv/**', '**/env/**', '**/.git/**'];
    }

    public getExcludePattern(uri?: vscode.Uri): string {
        const globs = this.getIgnoreGlobs(uri);
        return globs.length > 1 ? `{${globs.join(',')}}` : globs[0] || '';
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

    public async getFeatureFiles(): Promise<vscode.Uri[]> {
        const fileMap = new Map<string, vscode.Uri>();
        let included = 0;
        let ignored = 0;
        
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            // No workspace folders, fallback to global
            const featureGlobs = this.getFeatureGlobs(undefined);
            const excludePattern = this.getExcludePattern(undefined);
            const ignoreGlobs = this.getIgnoreGlobs(undefined);
            for (const pattern of featureGlobs) {
                const files = await vscode.workspace.findFiles(pattern, excludePattern);
                for (const file of files) {
                    if (!this.isIgnored(file, ignoreGlobs)) {
                        fileMap.set(file.toString(), file);
                        included++;
                    } else {
                        ignored++;
                    }
                }
            }
        } else {
            for (const folder of vscode.workspace.workspaceFolders) {
                const featureGlobs = this.getFeatureGlobs(folder.uri);
                const excludePattern = this.getExcludePattern(folder.uri);
                const ignoreGlobs = this.getIgnoreGlobs(folder.uri);
                for (const pattern of featureGlobs) {
                    const relativePattern = new vscode.RelativePattern(folder, pattern);
                    const files = await vscode.workspace.findFiles(relativePattern, excludePattern);
                    for (const file of files) {
                        if (!this.isIgnored(file, ignoreGlobs)) {
                            fileMap.set(file.toString(), file);
                            included++;
                        } else {
                            ignored++;
                        }
                    }
                }
            }
        }
        
        this._lastIncludedCount = included;
        this._lastIgnoredCount = ignored;
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
            this.debounceEvent(`create:${uri.toString()}`, () => this.eventBus?.publish({ type: 'featureFileCreated', uri }));
        };

        const wrapChanged = (uri: vscode.Uri, folderUri?: vscode.Uri) => {
            const ignoreGlobs = this.getIgnoreGlobs(folderUri);
            if (this.isIgnored(uri, ignoreGlobs)) return;
            this.debounceEvent(`change:${uri.toString()}`, () => this.eventBus?.publish({ type: 'featureFileChanged', uri }));
        };

        const wrapDeleted = (uri: vscode.Uri, folderUri?: vscode.Uri) => {
            const ignoreGlobs = this.getIgnoreGlobs(folderUri);
            if (this.isIgnored(uri, ignoreGlobs)) return;
            this.debounceEvent(`delete:${uri.toString()}`, () => this._eventBus?.publish({ type: 'featureFileDeleted', uri }));
        };
        
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            const uniqueGlobs = Array.from(new Set(this.getFeatureGlobs(undefined)));
            for (const pattern of uniqueGlobs) {
                const watcher = vscode.workspace.createFileSystemWatcher(pattern);
                watcher.onDidCreate(uri => wrapCreated(uri));
                watcher.onDidChange(uri => wrapChanged(uri));
                watcher.onDidDelete(uri => wrapDeleted(uri));
                this.featureWatchers.push(watcher);
            }
            return this.featureWatchers;
        }

        for (const folder of vscode.workspace.workspaceFolders) {
            const uniqueGlobs = Array.from(new Set(this.getFeatureGlobs(folder.uri)));
            for (const pattern of uniqueGlobs) {
                const relativePattern = new vscode.RelativePattern(folder, pattern);
                const watcher = vscode.workspace.createFileSystemWatcher(relativePattern);
                watcher.onDidCreate(uri => wrapCreated(uri, folder.uri));
                watcher.onDidChange(uri => wrapChanged(uri, folder.uri));
                watcher.onDidDelete(uri => wrapDeleted(uri, folder.uri));
                this.featureWatchers.push(watcher);
            }
        }
        
        return this.featureWatchers;
    }

    public dispose() {
        this.eventBusDisposable?.dispose();
        this.disposeWatchers();
    }

    public disposeWatchers(): void {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        this.featureWatchers.forEach(watcher => watcher.dispose());
        this.featureWatchers = [];
    }

    public getDiagnostics(): FeatureFileDiagnostics {
        return {
            includedCount: this._lastIncludedCount,
            ignoredCount: this._lastIgnoredCount,
            staleCount: 0 // Tracked by cache, not discovery service
        };
    }
}

export const featureDiscoveryService = new FeatureDiscoveryService();
