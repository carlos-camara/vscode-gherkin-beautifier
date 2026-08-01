# Performance and Activation

Gherkin PowerTools is designed to remain lightweight and unobtrusive, even in very large enterprise codebases with thousands of `.feature` and `.py` files.

## Activation Lifecycle

The extension uses **lazy activation** (`onLanguage:feature`). It will not start, load dependencies, or consume memory until you open a Gherkin document.

## Workspaces without Behave

If you open a Gherkin document in a project that does not use Python Behave, Gherkin PowerTools gracefully functions as a pure formatter and structural linter. It automatically disables the Python step discovery engine, ensuring zero overhead from file watchers or AST parsing of irrelevant languages.

## Large-Workspace Behavior

When Behave is detected, the extension builds a robust index to provide navigation and IntelliSense.

- **Deferred Indexing**: Heavy workspace scanning is offloaded to background threads and does not block the VS Code Extension Host. Editor features (like formatting and syntax highlighting) are immediately available.
- **Debounced Watchers**: File system changes are debounced. Rapid modifications during saving or git branch switches will not flood the system with redundant re-indexing events.
- **LRU AST Caching**: Gherkin document parsing is centralized via the `AstRepository`. When multiple language features (like the linter, formatter, and hover provider) request the abstract syntax tree simultaneously, they share the exact same parsed object. The AST is cached by document version and automatically purged to maintain a low memory footprint.
- **O(1) Workspace Relationship Graph**: Features like Go To Definition, Hover, and Find Usages no longer iterate over workspace-wide regex patterns.
  Instead, the `WorkspaceGraph` maintains a live, event-driven representation of relationships between Gherkin steps and Python code.
  This completely eliminates duplicate regex parsing overhead and keeps response times consistently at 0ms, even in enterprise-scale codebases.
- **Proactive Step Analysis Indexing**: When running the Step Definition Analysis report, the extension actively fetches and parses all `.feature` and `.py` files to ensure 100% accurate coverage. This one-off deep scan guarantees accuracy but is isolated to the execution of that specific command, preserving editor responsiveness during normal typing.

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

1. **Verify your Ignored Globs**: Ensure your `gherkinPowerTools.behave.ignoreGlobs` correctly exclude virtual environments, `node_modules`, and compiled assets. If the extension attempts to parse thousands of third-party Python files inside a virtual environment, performance will degrade.
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
