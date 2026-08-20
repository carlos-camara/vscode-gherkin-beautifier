# Performance and Activation

Gherkin PowerTools is designed to remain lightweight and unobtrusive, even in very large enterprise codebases with thousands of `.feature` and `.py` files.

## Activation Lifecycle

The extension uses **lazy activation** (`onLanguage:feature`). It will not start, load dependencies, or consume memory until you open a Gherkin document.

## Workspaces without Behave

If you open a Gherkin document in a project that does not use Python Behave, Gherkin PowerTools gracefully functions as a pure formatter and structural linter. It automatically disables the Python step discovery engine, ensuring zero overhead from file watchers or AST parsing of irrelevant languages.

## Large-Workspace Behavior

When Behave is detected, the extension builds a robust index to provide navigation and IntelliSense.

- **Deferred Indexing**: Heavy workspace scanning is offloaded to background threads and does not block the VS Code Extension Host. Editor features (like formatting and syntax highlighting) are immediately available.
- **Fault-Isolated Capabilities**: Core systems (like Symbol Cache and Usage Indexer) boot up as isolated capabilities. If an optional cache takes too long or fails to read from the disk due to locking, it automatically retries with exponential backoff without halting the essential file-watching systems, ensuring immediate responsiveness.
- **Debounced Watchers**: File system changes are debounced. Rapid modifications during saving or git branch switches will not flood the system with redundant re-indexing events.
- **Immediate Linter Execution**: When opening a document or switching active editors, the Linter engine executes instantaneously (bypassing debounce timeouts). This guarantees that essential diagnostics (like syntax errors and ambiguous steps) appear immediately on load, while typing changes remain efficiently debounced.
- **LRU AST Caching**: Gherkin document parsing is centralized via the `AstRepository`. When multiple language features (like the linter, formatter, and hover provider) request the abstract syntax tree simultaneously, they share the exact same parsed object. The AST is cached by document version and automatically purged to maintain a low memory footprint.
- **O(1) Workspace Relationship Graph**: Features like Go To Definition, Hover, and Find Usages no longer iterate over workspace-wide regex patterns. Instead, the `WorkspaceGraph` maintains a live, event-driven representation of relationships between Gherkin steps and Python code. This eliminates duplicate regex parsing overhead and keeps response times for editor features consistently at 0ms.
- **Transactional Mass Updates**: During massive file changes (e.g., switching git branches where thousands of files change simultaneously), the `WorkspaceGraph` employs an immutable `WorkspaceGraphGeneration` model. It coalesces all file events, safely aborts stale index requests, and commits updates atomically.
  This guarantees O(1) structural indexing across the entire workspace without locking the extension host or causing event-loop delays.
- **Authoritative Feature Discovery**: The `FeatureDiscoveryService` acts as a single, debounced source of truth for all `*.feature` files, avoiding redundant file system scans by the Test Explorer, diagnostics engine, and caching layers.
- **Optimized Behave File Discovery**: The `BehaveFileDiscoveryService` avoids blindly destroying and recreating file system watchers. It caches active configuration globs and only reconstructs watchers when resolved patterns genuinely change.
  In multi-root workspaces, it selectively rebuilds only the affected workspace folders. Furthermore, it aggressively deduplicates overlapping concurrent file-system events into a single pending state per URI, neutralizing "thundering herd" bursts (like `git reset --hard`) before they reach downstream components.
- **Impact Analysis CodeLenses**: The real-time Blast Radius CodeLenses rely on the `WorkspaceGraph` to resolve usages instantaneously, ensuring that no file-system scanning is performed when you open a Python step definition file.
- **Proactive BDD Anti-pattern Analysis**: When generating the Gherkin Health Dashboard, the Anti-pattern Engine actively fetches and parses all `.feature` and `.py` files to ensure 100% accurate coverage. This one-off deep scan guarantees accuracy but is isolated to the execution of that specific command, preserving editor responsiveness during normal typing.

## Parser Diagnostics & Developer Metrics

To monitor the performance of the `AstRepository`, you can enable parser metrics by setting `"gherkinPowerTools.diagnostics.metricsEnabled": true` in your configuration. This activates the **Gherkin PowerTools: Show Developer Metrics** command, which provides:
- **Parse Durations:** Track how long it takes to generate ASTs.
- **Cache Hit Ratios:** See how often the extension successfully reuses AST objects instead of reparsing documents.
- **Document Complexity:** Monitor the total number of features, scenarios, and steps parsed.
- **Parser Failures:** Track documents that failed to parse due to malformed Gherkin.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/metrics-snapshot.gif" alt="Output Channel showing Developer Metrics" width="600" height="340" />
</div>

These metrics are collected independently of any provider (formatter, linter) and impose zero performance penalty when the setting is left disabled (the default).

## Performance Troubleshooting

If you experience high CPU usage or delayed IntelliSense in massive monorepos, check the following:

1. **Verify your Ignored Globs**: Ensure your `gherkinPowerTools.behave.ignoreGlobs` correctly exclude virtual environments, `node_modules`, and compiled assets. If the extension attempts to parse thousands of third-party Python files inside a virtual environment, performance will degrade. You should also ensure your feature file locations are appropriately scoped via `gherkinPowerTools.featureGlobs`.
   ```json
   "gherkinPowerTools.behave.ignoreGlobs": [
       "**/node_modules/**",
       "**/.venv/**",
       "**/venv/**",
       "**/env/**"
   ]
   ```
2. **Narrow your Step Globs**: If your steps are isolated to specific directories (e.g., `tests/features/steps`), update `gherkinPowerTools.behave.stepGlobs` to strictly target those folders instead of scanning the entire workspace.
3. **Run the Diagnostic Command**: Execute `Gherkin PowerTools: Diagnose Workspace` from the Command Palette. The generated report will tell you exactly how many step files are currently being tracked by the internal watchers. If this number is unexpectedly high (e.g., in the thousands), your globs are likely too permissive.
