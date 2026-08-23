const fs = require('fs');

let parseCount = 0;
let evictCount = 0;
let evictTimeTotal = 0;
let cacheHits = 0;
let cacheMisses = 0;

function parseGherkin(text) {
    parseCount++;
    // approximate AST size multiplier is 10x the text size
    return Promise.resolve({ document: { type: 'GherkinDocument', size: text.length * 10 } });
}

class CacheEntry {
    constructor(version, promise) {
        this.version = version;
        this.promise = promise;
        this.lastAccessed = Date.now();
        this.size = 0;
    }
}

class AstRepositoryLRU {
    constructor(maxSize) {
        this.cache = new Map();
        this.maxCacheSize = maxSize;
    }

    async getAST(uri, version, text) {
        const uriStr = uri;
        const cached = this.cache.get(uriStr);
        if (cached && cached.version === version) {
            cached.lastAccessed = Date.now();
            cacheHits++;
            return cached.promise;
        }
        cacheMisses++;
        const promise = parseGherkin(text);
        
        promise.then(res => {
            if (this.cache.has(uriStr)) {
                this.cache.get(uriStr).size = res.document.size;
            }
        });

        this.cache.set(uriStr, new CacheEntry(version, promise));
        this.evictIfNecessary();
        return promise;
    }

    evictIfNecessary() {
        if (this.cache.size > this.maxCacheSize) {
            const start = performance.now();
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            
            const toRemove = Math.ceil(entries.length / 2);
            for (let i = 0; i < toRemove; i++) {
                this.cache.delete(entries[i][0]);
                evictCount++;
            }
            evictTimeTotal += (performance.now() - start);
        }
    }
}

class AstRepositoryGenerational {
    constructor(maxSize) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.generation = 0;
    }
    
    // Very simple Generation LRU: when we hit max, we delete all items not accessed in current generation
    async getAST(uri, version, text) {
        const cached = this.cache.get(uri);
        if (cached && cached.version === version) {
            cached.lastAccessedGen = this.generation;
            cacheHits++;
            return cached.promise;
        }
        cacheMisses++;
        const promise = parseGherkin(text);
        promise.then(res => {
            if (this.cache.has(uri)) {
                this.cache.get(uri).size = res.document.size;
            }
        });
        
        this.cache.set(uri, { version, promise, lastAccessedGen: this.generation, size: 0 });
        this.evictIfNecessary();
        return promise;
    }

    evictIfNecessary() {
        if (this.cache.size > this.maxSize) {
            const start = performance.now();
            let evicted = 0;
            for (const [k, v] of this.cache.entries()) {
                if (v.lastAccessedGen < this.generation) {
                    this.cache.delete(k);
                    evicted++;
                    evictCount++;
                }
            }
            // Fallback if everyone was accessed in this gen
            if (evicted === 0) {
                 const entries = Array.from(this.cache.entries());
                 entries.sort((a, b) => a[1].lastAccessedGen - b[1].lastAccessedGen);
                 const toRemove = Math.ceil(entries.length / 2);
                 for (let i = 0; i < toRemove; i++) {
                     this.cache.delete(entries[i][0]);
                     evictCount++;
                 }
            }
            this.generation++;
            evictTimeTotal += (performance.now() - start);
        }
    }
}

class AstRepositoryWeighted {
    // Limits based on soft memory budget (e.g. 50MB) instead of count
    constructor(maxBytes) {
        this.cache = new Map();
        this.maxBytes = maxBytes;
        this.currentBytes = 0;
    }

    async getAST(uri, version, text) {
        const cached = this.cache.get(uri);
        if (cached && cached.version === version) {
            cached.lastAccessed = Date.now();
            cacheHits++;
            return cached.promise;
        }
        
        if (cached && cached.version !== version) {
            this.currentBytes -= cached.size;
            this.cache.delete(uri);
        }
        
        cacheMisses++;
        const promise = parseGherkin(text);
        const entry = new CacheEntry(version, promise);
        this.cache.set(uri, entry);
        
        promise.then(res => {
            if (this.cache.has(uri) && this.cache.get(uri) === entry) {
                entry.size = res.document.size;
                this.currentBytes += entry.size;
                this.evictIfNecessary(); // Async eviction check after size is known
            }
        });

        return promise;
    }

    evictIfNecessary() {
        if (this.currentBytes > this.maxBytes) {
            const start = performance.now();
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            
            let i = 0;
            while (this.currentBytes > (this.maxBytes * 0.75) && i < entries.length) {
                const [k, v] = entries[i];
                this.cache.delete(k);
                this.currentBytes -= v.size;
                evictCount++;
                i++;
            }
            evictTimeTotal += (performance.now() - start);
        }
    }
}

async function runBenchmark(repo, numFiles, iterations, hotSetSize) {
    parseCount = 0;
    evictCount = 0;
    evictTimeTotal = 0;
    cacheHits = 0;
    cacheMisses = 0;

    const files = [];
    for (let i = 0; i < numFiles; i++) {
        const size = i % 10 === 0 ? 100000 : 1000;
        files.push({ uri: `file:///workspace/feature_${i}.feature`, version: 1, text: "A".repeat(size) });
    }

    // Full workspace scan (Test Explorer / Indexer)
    for (const f of files) {
        await repo.getAST(f.uri, f.version, f.text);
    }

    // Wait for all promises to resolve to update sizes
    await new Promise(r => setTimeout(r, 50));

    // Simulate hot working set editing
    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < hotSetSize; i++) {
            if (i === 0) {
                files[i].version++;
                files[i].text += "B";
            }
            await repo.getAST(files[i].uri, files[i].version, files[i].text);
        }
    }
    
    await new Promise(r => setTimeout(r, 50));
    
    let estimatedSize = 0;
    for (const [k, v] of repo.cache.entries()) {
        estimatedSize += v.size || 0;
    }

    return {
        hitRatio: (cacheHits / (cacheHits + cacheMisses)).toFixed(2),
        parseCount, evictCount,
        evictLatencyMs: evictTimeTotal.toFixed(2),
        memoryMB: (estimatedSize / 1024 / 1024).toFixed(2),
        entries: repo.cache.size
    };
}

async function main() {
    console.log("=== SCENARIO A: 10 files (small workspace) ===");
    console.log("Current (LRU 100) :", await runBenchmark(new AstRepositoryLRU(100), 10, 10, 5));
    console.log("Weighted (50MB)   :", await runBenchmark(new AstRepositoryWeighted(50*1024*1024), 10, 10, 5));

    console.log("\n=== SCENARIO B: 1000 files (large workspace) ===");
    console.log("Current (LRU 100) :", await runBenchmark(new AstRepositoryLRU(100), 1000, 10, 20));
    console.log("Generational (100):", await runBenchmark(new AstRepositoryGenerational(100), 1000, 10, 20));
    console.log("Weighted (50MB)   :", await runBenchmark(new AstRepositoryWeighted(50*1024*1024), 1000, 10, 20));
}

main().catch(console.error);
