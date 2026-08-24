import * as vscode from 'vscode';
import { ConfigurationService } from './configuration';
import { WorkspaceEventBus } from './eventBus';

class BehaveFileDiscoveryService {
    private pendingEvents = new Map<string, { type: 'create' | 'change' | 'delete', timer: NodeJS.Timeout }>();
    private activeGlobs = new Map<string, { stepGlobs: string[], ignoreGlobs: string[] }>();
    private isRebuildingWatchers = false;
    private fileSystemWatchers = new Map<string, vscode.FileSystemWatcher[]>();
    public metrics = { totalEventsReceived: 0, totalEventsEmitted: 0 };

    // Kept for backward compatibility if other classes access it
    private stepWatchers: vscode.FileSystemWatcher[] = [];
    public configService?: ConfigurationService;
    private _eventBus?: WorkspaceEventBus;
    private eventBusDisposable?: vscode.Disposable;

    /**
     * Subscribes to the Workspace Event Bus to receive configuration changes.
     * This service relies on the Event Bus for lifecycle updates rather than direct API calls.
     */
    public set eventBus(bus: WorkspaceEventBus | undefined) {
        this._eventBus = bus;
        this.eventBusDisposable?.dispose();
        if (this._eventBus) {
            this.eventBusDisposable = this._eventBus.onEvent(e => {
                if (e.type === 'configurationChanged') {
                    this.handleConfigurationChange();
                }
            });
        }
    }

    public get eventBus(): WorkspaceEventBus | undefined {
        return this._eventBus;
    }

    // Validates and normalizes an array of glob strings
    public normalizeGlobs(globs: any, defaultGlobs: string[]): string[] {
        if (!globs || !Array.isArray(globs) || globs.length === 0) {
            return defaultGlobs;
        }
        const validGlobs = globs.filter(g => typeof g === 'string' && g.trim().length > 0);
        return validGlobs.length > 0 ? validGlobs : defaultGlobs;
    }

    public getStepGlobs(uri?: vscode.Uri): string[] {
        const globs = this.configService?.getConfiguration(uri)?.behave?.stepGlobs;
        if (globs && globs.length > 0) {
            return globs;
        }
        return ['**/steps/**/*.py', '**/features/steps/**/*.py'];
    }

    public getIgnoreGlobs(uri?: vscode.Uri): string[] {
        if (this.configService) {
            return this.configService.getConfiguration(uri)?.behave?.ignoreGlobs || ['**/node_modules/**', '**/.venv/**', '**/venv/**', '**/env/**'];
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

    public async flushEvent(uriString: string) {
        const pending = this.pendingEvents.get(uriString);
        if (!pending) return;
        this.pendingEvents.delete(uriString);

        const uri = vscode.Uri.parse(uriString);

        try {
            await vscode.workspace.fs.stat(uri);
            // File exists
            if (pending.type === 'create') {
                this.metrics.totalEventsEmitted++;
                this.eventBus?.publish({ type: 'stepFileCreated', uri });
            } else if (pending.type === 'change') {
                this.metrics.totalEventsEmitted++;
                this.eventBus?.publish({ type: 'stepFileChanged', uri });
            } else if (pending.type === 'delete') {
                // Was deleted but exists? Likely an atomic save (change/delete/create). Convert to change.
                this.metrics.totalEventsEmitted++;
                this.eventBus?.publish({ type: 'stepFileChanged', uri });
            }
        } catch (e) {
            // File does not exist
            if (pending.type === 'delete') {
                this.metrics.totalEventsEmitted++;
                this.eventBus?.publish({ type: 'stepFileDeleted', uri });
            }
            // If create or change but it doesn't exist, ignore (transient file).
        }
    }

    public queueEvent(uri: vscode.Uri, type: 'create' | 'change' | 'delete', delayMs = 150): void {
        this.metrics.totalEventsReceived++;
        const uriString = uri.toString();
        const existing = this.pendingEvents.get(uriString);

        let nextType = type;
        if (existing) {
            clearTimeout(existing.timer);
            // State machine reduction rules
            if (existing.type === 'create' && type === 'change') {
                nextType = 'create';
            } else if (existing.type === 'create' && type === 'delete') {
                this.pendingEvents.delete(uriString);
                return; // cancel
            } else if (existing.type === 'change' && type === 'change') {
                nextType = 'change';
            } else if (existing.type === 'change' && type === 'delete') {
                nextType = 'delete';
            } else if (existing.type === 'delete' && type === 'create') {
                nextType = 'change';
            }
        }

        const timer = setTimeout(() => {
            this.flushEvent(uriString);
        }, delayMs);

        this.pendingEvents.set(uriString, { type: nextType, timer });
    }

    public async handleConfigurationChange() {
        if (this.isRebuildingWatchers) return;
        this.isRebuildingWatchers = true;

        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                const currentStepGlobs = this.getStepGlobs(undefined).sort().join('|');
                const currentIgnoreGlobs = this.getIgnoreGlobs(undefined).sort().join('|');
                const active = this.activeGlobs.get('global');
                if (!active || active.stepGlobs.sort().join('|') !== currentStepGlobs || active.ignoreGlobs.sort().join('|') !== currentIgnoreGlobs) {
                    this.disposeWatchersFor('global');
                    this.setupWatchersFor(undefined, 'global');
                }
            } else {
                for (const folder of vscode.workspace.workspaceFolders) {
                    const id = folder.uri.toString();
                    const currentStepGlobs = this.getStepGlobs(folder.uri).sort().join('|');
                    const currentIgnoreGlobs = this.getIgnoreGlobs(folder.uri).sort().join('|');
                    const active = this.activeGlobs.get(id);
                    if (!active || active.stepGlobs.sort().join('|') !== currentStepGlobs || active.ignoreGlobs.sort().join('|') !== currentIgnoreGlobs) {
                        this.disposeWatchersFor(id);
                        this.setupWatchersFor(folder, id);
                    }
                }
            }
        } finally {
            this.isRebuildingWatchers = false;
        }
    }

    private disposeWatchersFor(id: string) {
        const watchers = this.fileSystemWatchers.get(id);
        if (watchers) {
            watchers.forEach(w => w.dispose());
        }
        this.fileSystemWatchers.delete(id);
        this.activeGlobs.delete(id);
    }

    private setupWatchersFor(folder: vscode.WorkspaceFolder | undefined, id: string) {
        const uri = folder ? folder.uri : undefined;
        const stepGlobs = this.getStepGlobs(uri);
        const ignoreGlobs = this.getIgnoreGlobs(uri);

        this.activeGlobs.set(id, { stepGlobs: [...stepGlobs], ignoreGlobs: [...ignoreGlobs] });
        const watchers: vscode.FileSystemWatcher[] = [];

        const wrap = (fileUri: vscode.Uri, type: 'create' | 'change' | 'delete') => {
            if (this.isIgnored(fileUri, ignoreGlobs)) return;
            this.queueEvent(fileUri, type);
        };

        const uniqueGlobs = Array.from(new Set(stepGlobs));
        for (const pattern of uniqueGlobs) {
            const watchPattern = folder ? new vscode.RelativePattern(folder, pattern) : pattern;
            const watcher = vscode.workspace.createFileSystemWatcher(watchPattern);
            watcher.onDidCreate(u => wrap(u, 'create'));
            watcher.onDidChange(u => wrap(u, 'change'));
            watcher.onDidDelete(u => wrap(u, 'delete'));
            watchers.push(watcher);
            this.stepWatchers.push(watcher); // keep in global list for backward compatibility if needed
        }
        this.fileSystemWatchers.set(id, watchers);
    }

    public setupWatchers(): vscode.FileSystemWatcher[] {
        this.disposeWatchers();
        this.handleConfigurationChange();
        return this.stepWatchers;
    }

    public dispose() {
        this.eventBusDisposable?.dispose();
        this.disposeWatchers();
    }

    public disposeWatchers(): void {
        for (const pending of this.pendingEvents.values()) {
            clearTimeout(pending.timer);
        }
        this.pendingEvents.clear();

        for (const watchers of this.fileSystemWatchers.values()) {
            watchers.forEach(w => w.dispose());
        }
        this.fileSystemWatchers.clear();
        this.activeGlobs.clear();

        this.stepWatchers.forEach(watcher => watcher.dispose());
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

        return undefined;
    }
}

export const discoveryService = new BehaveFileDiscoveryService();
