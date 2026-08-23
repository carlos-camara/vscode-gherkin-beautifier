import * as vscode from 'vscode';
import { WorkspaceEventBus } from './eventBus';
import { ParseResult, parseGherkin } from './parser';
import { metricsLogger } from './metrics';

interface ASTDocument {
    uri: vscode.Uri;
    version: number;
    getText(): string;
}

interface CacheEntry {
    version: number;
    promise: Promise<ParseResult>;
    lastAccessed: number;
    sizeBytes: number;
}

class AstRepository {
    private cache = new Map<string, CacheEntry>();
    private eventBusDisposable?: vscode.Disposable;
    
    // Soft memory budget (approx. 50MB)
    private maxCacheBytes = 50 * 1024 * 1024;
    private currentCacheBytes = 0;

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

        // Handle version mismatch eviction
        if (cached && cached.version !== document.version) {
            this.currentCacheBytes -= cached.sizeBytes;
            this.cache.delete(uriStr);
        }

        // Cache miss or version mismatch: parse and cache
        metricsLogger.recordCacheMiss();
        
        // Use a 20x multiplier of the text length as a safe proxy for the JS heap size of the AST
        const estimatedSizeBytes = document.getText().length * 20;
        
        const promise = parseGherkin(document.getText());
        
        const entry: CacheEntry = {
            version: document.version,
            promise,
            lastAccessed: Date.now(),
            sizeBytes: estimatedSizeBytes
        };
        
        this.cache.set(uriStr, entry);
        this.currentCacheBytes += estimatedSizeBytes;
        
        metricsLogger.updateCacheMemory(this.currentCacheBytes);

        // Evict old entries if cache grows beyond soft memory budget
        this.evictIfNecessary();

        return promise;
    }

    /**
     * Invalidates the cache for a specific document URI.
     */
    public invalidate(uri: vscode.Uri): void {
        const uriStr = uri.toString();
        const cached = this.cache.get(uriStr);
        if (cached) {
            this.currentCacheBytes -= cached.sizeBytes;
            this.cache.delete(uriStr);
            metricsLogger.updateCacheMemory(this.currentCacheBytes);
        }
    }

    /**
     * Clears all cached ASTs.
     */
    public clear(): void {
        this.cache.clear();
        this.currentCacheBytes = 0;
        metricsLogger.updateCacheMemory(this.currentCacheBytes);
    }

    public dispose(): void {
        this.eventBusDisposable?.dispose();
        this.clear();
    }

    /**
     * Weighted LRU eviction strategy. 
     * Keeps removing the oldest elements until the memory budget is respected (plus a 25% buffer).
     */
    private evictIfNecessary(): void {
        if (this.currentCacheBytes > this.maxCacheBytes) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            
            let i = 0;
            // Evict until we are down to 75% of the max budget to prevent thrashing
            const targetBytes = this.maxCacheBytes * 0.75;
            
            while (this.currentCacheBytes > targetBytes && i < entries.length) {
                const [uriStr, entry] = entries[i];
                this.cache.delete(uriStr);
                this.currentCacheBytes -= entry.sizeBytes;
                metricsLogger.recordCacheEviction();
                i++;
            }
            
            metricsLogger.updateCacheMemory(this.currentCacheBytes);
        }
    }
}

export const astRepository = new AstRepository();
