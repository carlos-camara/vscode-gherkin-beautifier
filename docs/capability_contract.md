# Capability Contract

Gherkin PowerTools consists of two interfaces that share a unified Workspace Intelligence Engine:
1. **VS Code Extension** (`carloscamara.vscode-gherkin-powertools`)
2. **Standalone CLI** (`@carlos-camara/gherkin-pt`)

This matrix details exactly which capabilities are shared, which are exclusive to VS Code's UX, and which are exclusive to the CLI environment.

## Conformance Matrix

| Capability | Classification | Description |
|---|---|---|
| **Parsing** | 🟢 Shared Engine | Both interfaces use the exact same AST parser (`src/parser.ts`) to build the document tree. |
| **Formatting** | 🟢 Shared Engine | Both interfaces use the exact same formatting rules and logic (`src/formatter.ts`). |
| **Configuration** | 🟢 Shared Engine | Both interfaces read `.gherkin-powertoolsrc.json` and apply the same precedence logic. |
| **Globs** | 🟢 Shared Engine | Both interfaces resolve `behave.stepGlobs` identical patterns (Fast-Glob abstraction). |
| **Dialects** | 🟢 Shared Engine | Both interfaces support 70+ localized Gherkin dialects exactly the same way. |
| **Anti-Pattern Analysis** | 🟢 Shared Engine | `analyze` CLI command and Gherkin Health Dashboard use the same `AntiPatternEngine`. |
| **Project Statistics** | 🟢 Shared Engine | `stats` CLI command and Gherkin Health Dashboard calculate identical metrics. |
| **Syntax Linting** | 🟡 VS Code UX | Real-time `MISSING_COLON` or syntax squiggle underlines as you type. |
| **IntelliSense (Completion)** | 🟡 VS Code UX | Step suggestion and auto-completion. |
| **Navigation (Hover / Def)** | 🟡 VS Code UX | Tooltips and Go-to-Definition. |
| **Refactoring** | 🟡 VS Code UX | Rename Step (`F2`) and Extract Step Code Actions. |
| **Impact Analysis** | 🟡 VS Code UX | Blast Radius CodeLenses on Python functions. |
| **Test Explorer** | 🟡 VS Code UX | Visual test execution, debugging, and line tracking. |
| **Historical Trends** | 🟡 VS Code UX | Persisted historical metrics in `workspaceState` (charts). |
| **Diagnostics Report** | 🟡 Equivalent Outcome | VS Code presents issues in the "Problems View". The CLI outputs to `stdout`/`stderr`. |
| **Exit Codes** | 🔵 CLI Only | The CLI returns `1` when formatting fails or anti-patterns are found, blocking CI pipelines. |
| **JSON Output** | 🔵 CLI Only | The `--json` flag exports raw structured analysis data. |

## Conformance Testing
The shared engine is validated automatically by `src/test/suite/conformance.test.ts`, which runs the exact same test fixtures against the VS Code Extension APIs and the compiled CLI binary, asserting that the outcomes (counts, anti-patterns detected) match perfectly.
