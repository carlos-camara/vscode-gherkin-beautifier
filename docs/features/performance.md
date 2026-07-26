# ⚡ Performance & Lazy Initialization

Gherkin PowerTools is designed for **near-zero startup time** — the extension host returns from `activate()` almost instantaneously, keeping VS Code fast even for large workspaces.

---

## The Lazy-Load Architecture

Traditional VS Code extensions perform all initialization work synchronously inside `activate()`, which blocks the extension host and slows down editor startup. Gherkin PowerTools uses a **deferred initialization pattern** instead:

```text
activate()  ────────────────────────────────────────────────────────────────────────►
  │
  ├─ Register formatters, linters, language providers   (instant, no file I/O)
  │
  ├─ Register all commands                              (instant)
  │
  └─ setTimeout(2000ms) ──────────────────────────────────────────────────────────►
                              │
                              ├─ SymbolCache.ensureInitialized()   (scans *.py files)
                              │    └─ Step watchers registered when index is ready
                              │
                              └─ FeatureCache.ensureInitialized()  (scans *.feature files)
                                   └─ FileSystemWatcher registered when index is ready
```

The 2-second delay gives VS Code time to fully initialize its window and workbench before triggering heavy file system work. The result is that syntax highlighting, formatting, and structural linting are **available immediately** when you open a `.feature` file.

---

## The `ensureInitialized()` Pattern

All language providers that need the cache implement an **on-demand initialization guard**:

```typescript
public async ensureInitialized(): Promise<void> {
    if (this.state === 'initializing' || this.state === 'ready') {
        return this.initPromise!;   // Already running or done — await or return
    }
    // Not started yet — begin now
    this.state = 'initializing';
    this.initPromise = this.doInitialize();
    return this.initPromise;
}
```

This means:
- **Already done?** Returns immediately (no cost).
- **In progress?** Awaits the shared promise (no duplicate work).
- **Not started yet?** Triggers initialization on the spot (ensures correctness even if a provider is invoked before the 2-second timer fires).

---

## What Is Available Immediately vs. After Indexing

| Feature | Available | Requires Cache |
|---------|-----------|----------------|
| Syntax Highlighting | ✅ Immediately | ❌ |
| Formatter / Format on Save | ✅ Immediately | ❌ |
| Structural Linting (Missing `:`, typos, table errors) | ✅ Immediately | ❌ |
| Outline Panel (Feature/Scenario tree) | ✅ Immediately | ❌ |
| Test Explorer (feature/scenario tree) | ✅ Immediately | ❌ |
| **Undefined Step Warnings** | ⏳ After indexing | ✅ SymbolCache |
| **Ambiguous Step Warnings** | ⏳ After indexing | ✅ SymbolCache |
| **Go to Definition** | ⏳ After indexing | ✅ SymbolCache |
| **Hover (Step Signature & Docstring)** | ⏳ After indexing | ✅ SymbolCache |
| **IntelliSense Completions** | ⏳ After indexing | ✅ SymbolCache |
| **Tag Blast Radius (Hover)** | ⏳ After indexing | ✅ FeatureCache |

"After indexing" typically means **2–5 seconds** after VS Code opens, depending on workspace size.

---

## File System Watchers

File watchers for both Python step files and `.feature` files are registered **after** their respective caches finish initial indexing. This prevents the watchers from firing on startup noise (e.g., VS Code's internal workspace scan) before the cache is ready to process updates.

```text
SymbolCache ready  ──► setupStepWatchers()  ──► reactive *.py file updates
FeatureCache ready ──► featureWatcher       ──► reactive *.feature tag updates
```

---

## Hot-Reload Without Restart

Changing `gherkinPowerTools.behave.stepGlobs`, `gherkinPowerTools.behave.ignoreGlobs`, or modifying `.gherkin-powertoolsrc.json` triggers an immediate **rebuild**:

1. `configService.invalidateCache()` — clears the configuration cache.
2. Old file watchers are torn down.
3. `SymbolCache.ensureInitialized()` is called again with the new discovery configuration.
4. New watchers are registered.
5. All open `.feature` files are re-linted.

No VS Code restart is ever needed.

---

## Benchmark

| Metric | Before (eager) | After (lazy) |
|--------|---------------|--------------|
| `activate()` return time | ~200–500ms (varies by workspace size) | **< 30ms** |
| First keystroke responsiveness | Delayed by indexing | **Instant** |
| Step IntelliSense available | On next I/O completion | ~2–5s after open |

> **💡 Tip:** Run `Gherkin: Diagnose Workspace` from the Command Center to see the current cache state, how many step files were indexed, and how long the initial scan took.
