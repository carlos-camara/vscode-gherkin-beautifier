import * as vscode from 'vscode';
import { WorkspaceEventBus } from './eventBus';
import { ParseResult, parseGherkin } from './parser';
import { metricsLogger } from './metrics';

export interface ASTDocument {
    uri: vscode.Uri;
    version: number;
    getText(): string;
}

interface CacheEntry {
    version: number;
    promise: Promise<ParseResult>;
    lastAccessed: number;
}

export class AstRepository {
    private cache = new Map<string, CacheEntry>();
    private eventBusDisposable?: vscode.Disposable;
    private maxCacheSize = 100;

    /**
     * Subscribes to the Workspace Event Bus to automatically invalidate caches on file changes.
     */
    public setEventBus(eventBus: WorkspaceEventBus) {
        this.eventBusDisposable?.dispose();
        this.eventBusDisposable = eventBus.onEvent(e => {
            if (e.type === 'featureFileChanged' || e.type === 'featureFileDeleted') {
                this.invalidate(e.uri);
            } else if (e.type === 'textDocumentClosed') {
                // Clear the cache to prevent memory leaks for closed documents
                this.invalidate(e.document.uri);
            }
        });
    }

    /**
     * Retrieves the AST for a given document.
     * Caches the AST Promise based on document URI and version.
     */
    public async getAST(document: ASTDocument): Promise<ParseResult> {
        const uriStr = document.uri.toString();
        const cached = this.cache.get(uriStr);

        // If we have a cached version that matches the document version, return it
        if (cached && cached.version === document.version) {
            cached.lastAccessed = Date.now();
            metricsLogger.recordCacheHit();
            return cached.promise;
        }

        // Cache miss or version mismatch: parse and cache
        metricsLogger.recordCacheMiss();
        const promise = parseGherkin(document.getText());
        this.cache.set(uriStr, {
            version: document.version,
            promise,
            lastAccessed: Date.now()
        });

        // Optional: evict old entries if cache grows too large
        this.evictIfNecessary();

        return promise;
    }

    /**
     * Invalidates the cache for a specific document URI.
     */
    public invalidate(uri: vscode.Uri): void {
        this.cache.delete(uri.toString());
    }

    /**
     * Clears all cached ASTs.
     */
    public clear(): void {
        this.cache.clear();
    }

    public dispose(): void {
        this.eventBusDisposable?.dispose();
        this.clear();
    }

    /**
     * LRU eviction strategy for large workspaces with many un-opened feature files.
     */
    private evictIfNecessary(): void {
        if (this.cache.size > this.maxCacheSize) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            
            // Remove oldest half
            for (let i = 0; i < entries.length / 2; i++) {
                this.cache.delete(entries[i][0]);
            }
        }
    }
}

export const astRepository = new AstRepository();
