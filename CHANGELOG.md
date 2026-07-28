<!-- markdownlint-disable MD024 -->
# Changelog

All notable changes to the "vscode-gherkin-powertools" extension will be documented in this file.

🔗 **[Read the full release notes on GitHub](https://github.com/carlos-camara/vscode-gherkin-powertools/releases)**

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.8] - 2026-07-28

### 🚀 Added
- **Command Center**: A unified interactive QuickPick menu to access all extension capabilities (formatting, execution, debugging, step navigation, and diagnostics) from a single place. Open it via `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux) -> "Gherkin PowerTools: Command Center".
- **Native Test Explorer Integration**: Replaced the legacy CodeLens execution buttons with a full, native integration into the VS Code Testing sidebar (Test Explorer). You can now view, run, and debug Features, Rules, Scenarios, and Examples from a dedicated hierarchical tree.
- **Examples Execution**: You can now execute and debug individual rows within `Examples` tables! The extension injects non-intrusive Run (`▶`) and Debug (`🐞`) icons aligned to the left of each data row in the editor, and lists them as separate test nodes in the Test Explorer.
- **Interactive Execution Arguments Persistence**: Added a dedicated `Edit Behave args & Run` toolbar button (pencil icon) in the Test Explorer. It provides an interactive dialog letting you choose whether to save custom parameters (e.g., `--tags=@wip`) permanently to Workspace Settings or keep them volatile for the current session.
- **Security & Reliability Hardening for Execution**: Execution and debugging actions now use VS Code Tasks and array-based `ProcessExecution` APIs, entirely eliminating shell injection vulnerabilities for malicious or complex file paths.
  Additionally, interpreter detection now dynamically prioritizes your active `ms-python.python` environment to guarantee reliability.
- **Test Explorer Real-Time Tree Updates**: The Testing sidebar tree now refreshes **as you type** in a `.feature` file, without requiring a save. The internal controller subscribes to text changes with a 400 ms debounce, so new, renamed, or deleted scenarios appear instantly.
- **Instant Activation (O(1))**: The extension now activates instantly upon opening VS Code. Heavy workspace parsing (Python steps and Feature file tagging) has been successfully offloaded to background threads.
  This ensures that features like formatting and syntax highlighting are immediately available without blocking the extension host, dramatically improving startup times in massive enterprise projects.
- **Debug Console Auto-Focus**: When launching a debug session via the Test Explorer, VS Code now automatically switches focus to the **Debug Console** panel so you immediately see Behave's output and any assertion errors without navigating there manually.

### 🐛 Fixed
- **Linter Error Cascading**: Fixed a bug where a single missing colon (e.g., in `Scenario`) would completely break the internal Gherkin AST parser state, resulting in a massive wall of false-positive red squiggles on perfectly valid steps and tables below the error. The linter now intelligently suppresses cascading syntax errors to pinpoint exactly where the true structural error occurred.
- **Test Explorer Robustness**: Refactored the test discovery engine to use a resilient, dialect-aware text scanner instead of relying solely on the AST parser. This guarantees that all valid scenarios will always display execution buttons, even if previous syntax errors in the file break the parser.
- **Test Explorer Language Compatibility**: Fixed a bug where test detection would silently fail if the VS Code language identifier was manually set to `gherkin` instead of `feature`. The extension now fully supports both language IDs.
- **DevContainer Compatibility**: Fixed a bug where saving interactive execution arguments permanently to Workspace Settings would fail to apply inside DevContainers or multi-root workspaces. The settings are now correctly scoped to the active Workspace Folder's `.vscode/settings.json`.
- **Debug Mode: Test Results Pollution**: Fixed a critical UX regression where triggering a debug session from the Test Explorer was incorrectly recorded as a completed test run inside the **Test Results** panel.
  This caused previously-passing scenarios to appear as `Skipped (—)` after a debug session, destroying the valid green ✅ history. Debug sessions are now handled as a pure debugging workflow. They never write to the Test Results history.
- **Debug Session Spinner Stuck (Race Condition)**: Fixed a subtle race condition where the debug session started so quickly that `onDidStartDebugSession` fired before the extension's listener was registered — causing the Test Explorer spinner to never stop. The listener is now registered **before** `startDebugging()` is awaited, guaranteeing the event is never missed.
- **Debug Session Stuck on Failure**: Resolved a persistent issue where, if a Behave scenario **failed** during a debug session, the Test Explorer spinner would remain active indefinitely. The fix uses object-identity tracking (comparing `session` references, not string names) to reliably detect session termination, since the Python extension may rename debug session metadata internally.
- **Edit Args Applied Uniformly**: Confirmed and documented that custom execution arguments are consistently applied to **both** `Run` and `Debug` invocations, as both share the same argument resolution pipeline in `execution.ts`.

### 🧹 Maintenance
- **Dead Code Removal**: Removed 10 temporary scratch JavaScript files (`test_parse_error.js`, `test_linter_debug.js`, etc.) from the project root that accumulated during internal debugging sessions.
- **Test File Cleanup**: Removed unused import declarations and unused parameters from `config-listener.test.ts` and `linter.test.ts` to achieve zero warnings under `--noUnusedLocals --noUnusedParameters` TypeScript compiler flags.

## [1.7.7] - 2026-07-23

### 🚀 Added
- **Interactive Execution Arguments Persistence**: `Edit Scenario/Feature` CodeLens commands now provide an interactive dialog letting you choose whether to save custom parameters (e.g., `--tags=@wip`) permanently to the Workspace Settings or keep them volatile for the current session.
- **Behave Debugging CodeLens**: Debug features and scenarios directly from the editor using new `🐞 Debug` CodeLens buttons.
  The extension automatically detects your Python interpreter via the official Python extension and constructs a temporary launch configuration to seamlessly pause at breakpoints in your Python step definitions.
- **Single Typed Configuration Contract & Precedence Pipeline**:
  Configuration resolution now strictly enforces property-level precedence: Project (`.gherkin-powertoolsrc.json`) > Workspace Settings > User Settings > Defaults. Partial project config files now seamlessly inherit unmentioned fields from workspace/user settings.

### 🐛 Fixed
- **Automated CI Configuration Drift Guard**: Added `check:config` task and CI verification step (`scripts/check-config-sync.js`) that enforces 100% synchronization between implemented settings, JSON schema, `package.json`, and documentation.
- **Gherkin: Diagnose Workspace Command**: Added a new diagnostic command (`gherkinPowerTools.diagnoseWorkspace`)
  that analyzes environment versions, workspace layout, discovered feature/step files, indexed definitions, Python extension status, and `.gherkin-powertoolsrc.json` validity.
  Generates an Output Channel report with a 1-click `Copy Sanitized Report` action that redacts personal usernames and home directory paths for safe issue reporting.
- **Automated First-Run Onboarding Experience (Issue #169)**: Added a testable onboarding engine (`src/onboarding.ts`)
  that detects Python Behave projects (via step files, decorators, `environment.py`, and dependency manifests), checks `stepGlobs` coverage, and offers non-blocking 1-click recommendations to apply settings or create `.gherkin-powertoolsrc.json` without modifying files unconfirmed or interrupting non-Behave Gherkin projects.
- **Dedicated Visual Demo Gallery**: Added a standalone `docs/demos.md` gallery showcasing all feature animations.

- **Behave Step File Watching & Discovery Alignment (Issue #137)**: Redesigned file system watching logic
  so watchers are built dynamically per workspace folder using resolved `behave.stepGlobs` configuration.
  Standardized ignore glob filtering (`behave.ignoreGlobs`) across initial discovery and live events
  (creation, modification, deletion, rename), added 100ms per-URI event debouncing, and ensured clean watcher
  disposal and rebuilds on configuration changes.
- **MkDocs Snippet Path Resolution**: Fixed MkDocs site building errors for root inclusions (such as `README.md`) by configuring snippet base path resolution across `docs/` and root directories.
- **Dependency Security Vulnerabilities**: Pinned `brace-expansion` (^2.1.2) and `js-yaml` (^4.3.0) via `package.json` overrides to resolve security vulnerabilities.
- **Documentation Image Dimensions**: Standardized `run-debug.gif` display width to 600px across all documentation pages to match standard GIF ratios.

### 🎨 Changed
- **Marketplace Discovery & Positioning**: Re-aligned `displayName`, `description`, and expanded search keywords in `package.json` to highlight test execution, debugging, step navigation, and linting.
- **High-Conversion README**: Restructured the root `README.md` to clearly highlight core capabilities, target audiences (zero-config vs. Python/Behave), and quick-start steps.

## [1.7.6] - 2026-07-20

### 🚀 Added
- **Shared Project Configuration**: You can now create a `.gherkin-powertoolsrc.json` file in the root of your project. This allows you to enforce team-wide formatting rules, indentation, and step file discovery globs, overriding local VS Code settings. The file includes full schema validation, autocompletion, and hover documentation.
- **Global Dialect Support for Linter (i18n)**: The semantic linter and diagnostics engine is now fully dialect-aware. It dynamically reads your `# language: [code]` header and validates syntax across 70+ languages, including localized Quick-Fix recommendations (e.g., suggesting `Fonctionnalité:` instead of `Feature:`).
- **Context-Aware Fuzzy Matching**: The linter now evaluates structural context before offering typo corrections, eliminating aggressive false-positive diagnostics when normal English prose resembles Gherkin keywords.
- **Live Tag Telemetry**: The tag counter now tracks active unsaved edits instantly, without needing to save the document first.
- **AST-Scoped Range Formatting**: Range formatting (Format Selection) now natively parses the Abstract Syntax Tree to identify the smallest logical node encompassing your selection. Selecting a partial `DataTable`, a multi-line `DocString`, or a block of steps now correctly re-formats the entire structural element atomically, guaranteeing perfect vertical alignment.
- **Configurable Tag Sorting**: Tag wrapping is now fully decoupled from sorting. By default, the formatter will preserve your original tag order (including duplicates). Added `gherkinPowerTools.tags.sort` setting to optionally sort tags alphabetically.
- **Behave Execution CodeLens**: Run and edit features and scenarios directly from the editor using `▶ Run Feature`, `▶ Run Scenario`, `✏️ Edit Feature...`, and `✏️ Edit Scenario...` CodeLens buttons with dedicated terminal execution and custom arguments support.
- **Code Actions (Quick Fixes)**: Intelligent quick fixes for Gherkin syntax errors, including generating undefined Python step stubs, inserting missing colons, and converting Scenarios to Scenario Outlines.
- **Remote Workspace Compatibility**: Feature files are now parsed correctly over virtual filesystems (e.g., GitHub Codespaces, SSH, and remote tunnels) using VS Code's native `workspace.fs` API.
- **Semantic Context-Aware Navigation**: Go To Definition and Hover providers now fully respect strict `Given/When/Then` matching and dynamically resolve `And`/`But` continuations backwards through the scenario.
- **Ambiguous Step Resolution**: If a step matches multiple Python definitions (e.g., overlapping wildcard regular expressions), Go To Definition now opens a Peek View showing all matches instead of arbitrarily jumping to the first one. The Hover provider also enumerates all matching signatures.
- **Safe Hover Docstrings**: Python docstrings rendered in the Hover widget are now strictly displayed as plain untrusted text, preventing accidental markdown injection or rendering glitches.
- **Unsupported Matcher Transparency**: The Hover provider now explicitly warns you if a step definition uses Python-specific regex capabilities (like lookbehinds) that cannot be dynamically evaluated by the extension.
- **Robust Parsing Fallback**: If a feature file contains severe syntax errors, the cache will now gracefully downgrade to a "Partial" state and salvage any parsable scenarios, while displaying an inline warning in the hover widget.


### 🛠️ Changed
- **Architectural Refactor**: Rebuilt the underlying `FeatureCache` to operate asynchronously with a 300ms debounce window and an incremental diffing strategy. This drastically reduces CPU overhead during rapid typing and eliminates full-workspace re-indexing on single-file changes.

## [1.7.5] - 2026-07-18

### 🐛 Fixed
- **Strict Semantic Matching Fix**: Fixed a critical bug in the linter and definition providers where explicit step keywords (e.g., `Given`, `When`, `Then`) were being incorrectly overridden by the context of preceding steps.
  This resolves issues where perfectly valid steps like `Then align` were falsely flagged as "Undefined Step" when the Python step definition used a strictly-matching decorator like `@then`.

## [1.7.4] - 2026-07-18

### 🛠️ Changed
- **Centralized File Discovery**: Introduced `BehaveFileDiscoveryService` to act as the single source of truth for locating Behave step files.
  - **Dynamic Configuration Hot-Reload**: Changes to `gherkinPowerTools.behave.stepGlobs` or `ignoreGlobs` settings are now applied immediately. Live file system watchers are dynamically recreated, cache is re-indexed, and open features are instantly re-linted without requiring a VS Code restart.
  - **Multi-Root Workspace Intelligence**: Step definition generation (Quick Fix) now correctly infers the appropriate base workspace folder if multiple roots are opened.
- **Resilient Regex Compilation (`StepDefinition`)**: The workspace indexer now gracefully handles Python-specific regular expressions (like advanced lookbehinds) that are unsupported by the JavaScript V8 engine.
  Instead of silently discarding these steps, they are preserved in the Symbol Cache and marked as non-evaluable. This ensures they remain visible in global autocompletion and workspace symbols, while being safely excluded from automated text matching (Linting, Go-To-Definition, Hover).
- **Bounded Python Tokenizer**: Replaced the fragile regex-based parser with a bespoke state-machine to extract Python step decorators reliably without requiring a full AST parser.
  - **Dynamic Expression Fallback**: The extension now properly identifies and flags dynamic expressions (e.g. `@given(MY_VAR)`) or concatenated strings, preventing runtime crashes during real-time Linter/Hover validation while still indexing them for "Go-To-Definition".
  - **Robust Literal Parsing**: Accurately tracks multiline triple quotes (`"""`, `'''`), internal escape sequences (`\"`), and complex string prefixes (`r`, `u`, `f`, `b`, `rf`).
- **Semantic Step Matching (`@given`/`@when`/`@then`)**: The extension now respects Behave's strict semantic decorators.
  Linter diagnostics, autocomplete, hover documentation, and Go-To-Definition links correctly disambiguate identical step patterns based on their `Given`, `When`, or `Then` prefix.
  Localized continuation keywords (`And`, `But`) are dynamically resolved backwards through the scenario block.
  Generic `@step` decorators remain wildcard matches.

## [1.7.3] - 2026-07-16

### 🛠️ Changed
- **TypeScript Type-Safety & Parser Architecture Refactor**: Completely centralized the `@cucumber/gherkin` AST parsing logic into a single internal module.
  - **Thread-Safety**: Replaced shared global parser state with fresh deterministic instances per operation, preventing bleed and memory leaks during concurrent linting or formatting.
  - **Strict Type-Safety**: Replaced ambiguous `any` usages across the Linter, Formatter, Statistics, and Outline providers with exact `@cucumber/messages` interface types (`GherkinDocument`, `Feature`, `Scenario`, `Step`, etc.).
  - **Partial AST Fallbacks**: Formalized fallback logic to retrieve and traverse partial AST trees even during severe syntax failures, preserving semantic analysis capabilities.
- **CI/CD Hardening & Cross-Platform E2E**: Refactored all GitHub Actions workflows to adhere to the principle of least privilege, explicitly removing unnecessary write permissions.
  - **Recoverable Releases**: The `release.yml` pipeline is now fully idempotent, capable of securely resuming and fixing a broken release if the VSIX upload fails midway.
  - **Multi-OS UI Testing**: The End-to-End visual test suite now executes natively across `macos-latest`, `windows-latest`, and `ubuntu-latest`.
  - **Native Check Runs**: Switched test reporting from noisy PR comments to silent, native GitHub Check Runs.

### 🚀 Added
- **AST-Based Project Analytics**: The Project Statistics dashboard has been completely refactored to use the official `@cucumber/gherkin` AST parsing engine instead of line-by-line regex scanning.
  - **100% Precision**: Correctly counts features, rules, backgrounds, scenarios, outlines, Example rows, executable steps, tags, and data tables across the entire workspace.
  - **Objective Refinements**: Separated data tables from Example rows for more accurate metrics. Renamed internal marketing labels to engineering standards ("Gherkin Quality Score" -> "Gherkin Quality Indicator", "Most Complex Scenario" -> "Longest scenario", "ROI" -> "Estimated execution effort").
  - **Real-Time Asynchronous Loading**: Uses `vscode.workspace.fs` and `vscode.window.withProgress` to index the workspace asynchronously with full CancellationToken support, ensuring the UI thread remains unblocked even in massive projects.
- **Range Formatting Restored**: Re-implemented the `DocumentRangeFormattingEditProvider` safely. The formatting engine now maps the exact origins of generated output lines (including expanded tags and docstrings), allowing partial text selections to be formatted securely without data drift or corruption.
- **Formatter AST Engine Refactor**: Completely rewrote the Gherkin formatting engine using strict `@cucumber/messages` AST parsing for flawless precision.
  - **Data Integrity**: Reconstructs data tables natively through AST `cell.value` and re-escapes pipes, preventing data corruption on complex markdown cells with `\|`.
  - **Idempotency**: Formatting a perfectly formatted document now returns zero text edits, keeping your Git and Undo stacks clean.
  - **Encoding Preservation**: Dynamically detects and preserves exact `CRLF` or `LF` encodings and final newlines natively.
  - **DocString Perfection**: Properly preserves internal spacing for multi-line blocks like JSON payloads, while shifting the base indentation relatively.
- **Universal Multilingual Support (DialectService)**: Centralized all keyword parsing to use the official `@cucumber/gherkin` dialect database. The extension now natively understands translated keywords (e.g., `Dado`, `Angenommen`, `Soit`) for English, Spanish, French, German, and all other 70+ languages supported by Cucumber.
  - Automatically detects dialect via the `# language: <lang>` header.
  - Syntax Highlighting, Hover, Auto-completion, Code Actions, Go-To Definition, and Formatting seamlessly adapt to the document's locale.
  - Dynamically resolves `And` / `But` continuations in all supported languages by parsing preceding step context.
- **Context-Aware Autocompletion**: The `CompletionProvider` is now context-aware! It strictly filters Python suggestions based on the semantic step keyword typed (e.g., `Given` only suggests `@given` steps) and resolves the root context of `And`/`But` chains. Regex capture groups and Behave placeholders (`{param:d}`) are securely translated into VS Code Snippet tab stops.
- **Asynchronous Non-Blocking Workspace Indexing**: The `SymbolCache` has been completely rewritten using `vscode.workspace.findFiles` to index `.py` steps asynchronously without blocking the UI thread. Added public settings `gherkinPowerTools.behave.stepGlobs` and `gherkinPowerTools.behave.ignoreGlobs` to tune directory coverage securely.

## [1.7.2] - 2026-07-15

### Added
- **Robust Behave Step Generation**: The "Create empty step definition" Quick Fix has been completely overhauled for Python/Behave projects.
  - Safely escapes Gherkin strings containing quotes, backslashes, and emojis (`u'...'`).
  - Generates valid, collision-free Python function names (`def step_impl_1(context)`).
  - Semantically resolves `And` and `But` keywords by scanning upwards to inherit the preceding `@given`, `@when`, or `@then` decorator.
- **Ambiguous Step Linter (`AMBIGUOUS_STEP`)**: Detects and warns users in real-time when a Gherkin step matches multiple overlapping regular expressions (e.g., generic decorators like `@given(r'I am an (.*) step')`) in your Python code, mimicking runtime errors.
- **Scenario Outline Parameter Autocomplete**: Typing `<` inside a step within a `Scenario Outline` will now automatically parse the block and provide an IntelliSense dropdown with the column headers from the underlying `Examples` table. Selecting a parameter automatically appends the closing `>` bracket.


### Fixed
- **Deterministic Cache Initialization**: Fixed a critical race condition during extension startup where files were linted against an empty cache, causing false-positive `UNDEFINED_STEP` errors. Cache initialization is now governed by a strict asynchronous state machine.
- **Stale Asynchronous Diagnostics**: Implemented a per-URI debounce mechanism (250ms) and request tracker for the Linter to eliminate a race condition where rapid typing caused outdated parsing results to overwrite newer diagnostic states.

### Security
- **Webview XSS Hardening**: Secured the Statistics Dashboard against Cross-Site Scripting (XSS) and HTML injection by disabling JavaScript (`enableScripts: false`), enforcing a strict Content-Security-Policy (`default-src 'none'; style-src 'unsafe-inline'`), replacing animations with pure CSS, and sanitizing all user-provided data via a centralized `escapeHtml` utility.
  Added a dedicated security test suite.

## [1.7.1] - 2026-07-13

### Performance
- **Turbocharged Activation (Esbuild)**: Migrated the build system from standard TypeScript (`tsc`) to **Esbuild**. The extension now bundles all source code and dependencies into a single minified `extension.js` file, slashing the `.vsix` payload size and dropping activation times to a flat 0ms.

### Added
- **Tag Blast Radius Hover**: Hovering over any Gherkin tag (`@tag`) now dynamically calculates and displays the total number of scenarios affected by that tag across the entire workspace, taking into account `Feature`/`Rule` tag inheritance and multiplying by `Scenario Outline` data rows.
- **Gherkin PowerTools Output Channel**: Added a native VS Code Output Channel for transparent logging. Users can now monitor cache indexing progress, parser fallback events, and trace syntax errors without needing Developer Tools.
- **Enterprise-Grade Testing**: Drastically expanded the testing architecture to achieve a **92.7% Code Coverage**.
  - Expanded unit tests to strictly cover edge cases in AST Fallbacks, Code Actions, and Symbol Caching.
  - Implemented 8 comprehensive Headless E2E scenarios via `@vscode/test-electron` covering real UI interactions (Hover, Definition, Quick Fixes, Autocomplete).

### Security
- **Strict Webview CSP**: Hardened the Statistics Dashboard Webview by implementing a strict Content Security Policy (`<meta http-equiv="Content-Security-Policy">`), preventing inline script execution and complying with top-tier VS Code security standards.

## [1.7.0] - 2026-07-10

### Features
- **Hover Provider (Documentation Preview)**:
  - Displays the Python function signature and docstring in a rich tooltip when hovering over a Gherkin step.
  - Automatically parses multiline function definitions and docstrings in Python to provide accurate context without switching files.
- **Smart Autocompletion Provider (IntelliSense)**:
  - Dynamically extracts string patterns from Python step definitions (`@given`, `@when`, etc.).
  - Instantly offers intelligent auto-complete suggestions the moment a user types a keyword.
  - Automatically transforms `Behave` parameters (`{var}`) and regex groups into VS Code interactive Snippet variables (`${1:var}`) for fast tabbing.
  - Smoothly overwrites typed text after the keyword instead of duplicating.

### Added
- **Symbol Cache**: Dramatically improved the performance of the "Go To Definition" feature in large projects. The extension now builds an in-memory index of all Python step definitions upon activation and dynamically updates it when files are modified, reducing lookup times to 0 milliseconds and eliminating continuous disk I/O.
- **Code Actions (Quick Fixes)**: The extension now provides VS Code Quick Fixes for Gherkin files.
  - **Undefined Steps**: Integrates with the Symbol Cache. If a step is not found in Python, a Quick Fix lets you automatically generate an empty Python step definition in your `steps/` directory.
  - **Syntax Error Auto-Corrections**: If you miss a colon on a block keyword (`Feature`, `Scenario`) or misspell a step keyword (`Givn`), Quick Fixes will offer to instantly auto-correct them.
  - **Structure Auto-Corrections**: If you add `Examples:` under a standard `Scenario`, a Quick Fix will offer to convert it to a `Scenario Outline`.
  - **Table Auto-Corrections**: If you forget to close a data table row with a pipe (`|`), a Quick Fix will offer to append it for you.
- **Fault-Tolerant Linter Engine**:
  - **Syntax Crash Resilience**: The Linter now employs a multi-pass hybrid parsing strategy. If severe syntax errors (like typos) crash the official AST parser, the Linter seamlessly falls back to a custom text-based scanner to continue providing structural diagnostics (like detecting `Examples` inside a standard `Scenario`).
  - **Precise Error Mapping**: Solved an issue where the AST parser would strip empty lines from description blocks, causing diagnostics (like missing colons) to point to the wrong lines. The extension now uses dynamic text-mapping to anchor errors to their exact physical line in your document.

### Security
- **Dependency Override**: Forced `serialize-javascript` to version `^7.0.5` via npm `overrides` to mitigate a critical Remote Code Execution (RCE) vulnerability (CVE-2020-7660 incomplete fix) caused by unescaped RegExp flags and Date properties. This secures the test framework (`mocha`) without requiring a major framework downgrade.

## [1.6.0] - 2026-06-29

### Added — AST Parsing Engine (Core)
- **Mathematical Precision**: Replaced the legacy Regex-based parser with the official `@cucumber/gherkin` Abstract Syntax Tree (AST) parser. This brings flawless, mathematical precision to code analysis.
- **Bulletproof Formatting**: Formatting rules now correctly ignore keywords embedded inside `"""` DocStrings, `|` Data Tables, and `#` Comments, preventing catastrophic layout breakages on complex files.
- **Diagnostics Reliability**: The Live Linter now uses the AST to surface syntax errors (like missing colons or invalid tokens) in real-time with 100% accuracy.

### Added — Omega Squeeze (Project Analytics V6)
- **Project Analytics**: Completely redesigned the `Gherkin: Show Project Statistics` dashboard with a premium glassmorphism interface and animated dynamic numbers.
- **Code Actions (Quick Fixes)**: The extension now provides VS Code Quick Fixes for Gherkin files.
  - **Undefined Steps**: Integrates with the Symbol Cache. If a step is not found in Python, a Quick Fix lets you automatically generate an empty Python step definition in your `steps/` directory.
  - **Syntax Error Auto-Corrections**: If you miss a colon on a block keyword (`Feature`, `Scenario`) or misspell a step keyword (`Givn`), Quick Fixes will offer to instantly auto-correct them.
  - **Structure Auto-Corrections**: If you add `Examples:` under a standard `Scenario`, a Quick Fix will offer to convert it to a `Scenario Outline`.
  - **Table Auto-Corrections**: If you forget to close a data table row with a pipe (`|`), a Quick Fix will offer to append it for you.
- **Gherkin Quality Score (GQS)**: Added a proprietary algorithm to evaluate code quality based on Reusability (Backgrounds), Parametrization (Examples), Documentation (Comments), and Complexity (Avg Steps per Scenario).
- **Automation ROI Tracking**: Added a new metric to calculate the estimated manual hours saved by your automated tests, using the exact number of executable permutations.
- **Tags Intelligence**: Added in-memory tracking of all tags to display a "Top 5 Most Used Tags" leaderboard.
- **Density Metrics**: The dashboard now calculates the exact line density of your feature files, checking empty lines vs code lines.

### Added — Community & Open Source Infrastructure
- **Issue Templates**: Added `bug_report.yml` (with Gherkin-specific fields and VS Code version) and `feature_request.yml` via GitHub Issue Forms.
- **Pull Request Template**: Added `pull_request_template.md` with testing matrix tailored for VS Code extension development.
- **Dependabot**: Added `dependabot.yml` for automated weekly dependency updates (npm + GitHub Actions).
- **CODE_OF_CONDUCT.md**: Added Contributor Covenant Code of Conduct.
- **SECURITY.md**: Added security policy with coordinated disclosure process.
- **`.editorconfig`**: Added EditorConfig with rules for TypeScript (4 spaces), JSON/YAML (2 spaces), and `.feature` files (2 spaces).

### Added — CI/CD Pipelines
- **PR Labeler** (`labeler.yml`): Auto-labels PRs based on changed file paths (core, documentation, testing, dependencies, DevOps, configuration, assets).
- **PR Hygiene & Intelligence Gate** (`gate-check.yml`): Validates PR title/description and generates AI-powered summaries on every PR.
- **Release** (`release.yml`): Automatically compiles TypeScript, packages `.vsix` with `@vscode/vsce`, and creates a GitHub Release on `v*` tags.
- **Deploy Docs** (`pages.yml`): Deploys MkDocs Material documentation to GitHub Pages on pushes to `main`.

### Added — Documentation Site (MkDocs Material)
- **`mkdocs.yml`**: Full MkDocs Material configuration with deep purple theme, dark/light mode, search, code copy, and Mermaid diagrams.
- **14 documentation pages**: Home, Installation, Configuration, 7 feature pages (Formatter, Linter, Go To Definition, Outline, Statistics, Highlighting, Snippets), Architecture (with Mermaid diagrams), Contributing, Code of Conduct, Security, and Changelog.
- Documentation will be deployed to `https://carlos-camara.github.io/vscode-gherkin-powertools/`.

### Changed
- **`src/formatter.ts`**: Prefixed unused parameters with underscore (`_options`, `_token`) to suppress TypeScript lint warnings.
- **`src/highlighter.ts`**: Replaced raw hex colors with professional VS Code native palette (`#C586C0`, `#569CD6`, `#4EC9B0`).
- **`src/definition.ts`**: Removed unused `path` import.
- **`src/linter.ts`**: Removed unused `inTable` variable.
- **`src/outline.ts`**: Prefixed unused `_token` param, narrowed return type to `DocumentSymbol[]`.
- **`src/statistics.ts`**: Prefixed unused `_context` parameter.
- **`README.md` & `CONTRIBUTING.md`**: Complete rewrite with modern layout, feature showcase with GIF/PNG demos, configuration table, roadmap section, and author footer. Upgraded to use native GitHub Alerts (`> [!NOTE]`).
- **Documentation (`docs/`)**: Upgraded all markdown pages to use MkDocs Admonitions (`!!! tip`) and visual emojis.
- **Packaging**: Highly optimized `.vscodeignore` to exclude heavy `docs/` and `assets/` folders, dropping the `.vsix` payload size from 18 MB to 408 KB while maintaining functional URLs in the Marketplace.
- **Testing**: Upgraded integration tests to run on Node 22 via `@vscode/test-electron@3.0.0`.
- **Internal / CI**:
  - Migrated tests from custom programmatic Mocha runner to the official `@vscode/test-cli`.
  - Removed `nyc` in favor of built-in `c8` V8 coverage reporting.
  - Migrated code coverage reporting in Pull Requests to a reusable GitHub Action from the `qa-hub-actions` repository (replacing the local bash script to maximize modularity).

### Fixed
- **Packaging**: Removed `node_modules/**` from `.vscodeignore` so the AST parser runtime dependencies are correctly bundled in the VSIX.
- **Go To Definition**: Fixed greedy Regex matching that consumed entire lines in Behave steps.
- **Go To Definition**: Added support for Python string literal prefixes (`r`, `u`, `f`, `b`) in `@given`, `@when`, `@then` decorators.
- **Go To Definition**: Fixed escaping of `*` in the Regex generator to prevent ReDoS and matching failures.

## [1.5.0] - 2026-06-25
### Added
- **Multi-language Support (i18n)**: Formatter now fully supports formatting, indenting, and Auto-Casing for English, Spanish, French, and German Gherkin keywords.
- **Diagnostic Provider (Linter)**: Hardened the linter rules to strictly enforce colons (`:`) on block keywords and spaces on step keywords, immediately flagging syntax errors.
- **Cascading Indentation**: The formatter now uses a beautiful cascading (stair-step) indentation style by default: 2 spaces for `Scenario`, 3 for `Given/When/Then`, and 4 for `And/But`.
- **Inline Comment Alignment**: Formatter now dynamically aligns inline comments (`#`) to the same vertical column for perfect visual readability.
- **Outline Provider**: Added an interactive tree view in the VS Code "Outline" panel for quick navigation between `Feature`, `Rule`, and `Scenario` blocks.
- **Context Menu Command**: Added a "Format Gherkin Document" action to the editor's right-click context menu.
- **Snippets**: Bundled comprehensive autocompletion snippets for common Gherkin blocks (`feature`, `scenario`, `outline`, `rule`).
- **Configuration `gherkinPowerTools.tags.format`**: Added option to format tags either as `wrap` (80 chars max line length) or `singleLine`.
- **Configuration `gherkinPowerTools.emptyLines.betweenScenarios`**: Added setting to customize the exact number of blank lines to enforce between major blocks.
- **Go to Definition (Python/Behave)**: You can now `Cmd + Click` (or `F12`) on any Gherkin step (e.g. `Given I login`) and VS Code will automatically search your `steps/` folder and jump directly to the Python `.py` file where that `@given` or `@step` decorator is defined.
- **Project Statistics Dashboard**: Added a new command (`Gherkin: Show Project Statistics`) that scans your workspace and displays a beautiful HTML dashboard with metrics on your Features, Rules, and Scenarios. This is also accessible by Right-Clicking inside the editor.
- **Beautiful Syntax Highlighting**: Overrides default VS Code themes to dynamically colorize Gherkin files. Features a stunning **Magenta** for structural keywords (`Feature`, `Scenario`, `Rule`) and **Blue** for action steps (`Given`, `When`, `Then`).
- **Real-time Diagnostic Linter**: Includes a built-in Linter that monitors your feature files as you type. If you mistype a keyword or use invalid syntax, the editor will immediately underline it in red and provide an explanation.
- **Built-in Snippets**: Includes standard autocompletion snippets. Type `feature`, `scenario`, `outline`, or `rule` inside a blank document and press `Tab` to instantly scaffold properly formatted templates.

### Changed
- Refactored internal formatting engine to use dynamic Regex mapping for multi-language support.
- Excluded development dependencies and test artifacts (`.vscode-test`, `node_modules`) from the VSIX package via `.vscodeignore`.

## [1.4.0] - 2026-06-24
### Added
- **Auto-Casing**: Formatter now automatically PascalCases Gherkin keywords (`Given`, `When`, `Then`, `Feature`, etc.) regardless of user input.
- **Tag Sorting & Formatting**: Sorts tags alphabetically (e.g., `@smoke @api` -> `@api @smoke`) and formats them based on user configuration. By default, it wraps tags if they exceed 80 characters, but this can be configured to remain on a single line.
- **Whitespace Cleanup**: Automatically collapses consecutive empty lines into a standardized format and trims all trailing whitespace, preventing dirty git commits.
- **Inline Comment Alignment**: Dynamically aligns inline comments (`#`) to the same vertical column within the same code block, creating a beautiful and consistent reading experience.
- **Variable Normalization**: Automatically trims useless spaces inside `Scenario Outline` variables (e.g. `< user name >` becomes `<user name>`) to prevent runner failures.

## [1.3.0] - 2026-06-24
### Added
- **Configuration Settings**: Added support for customizing the formatter via `settings.json`.
  - `gherkinPowerTools.indentation.steps`: Allows changing step indentation (e.g. from 4 to 2 spaces).
  - `gherkinPowerTools.tables.alignToKeyword`: Allows toggling the dynamic table alignment behavior.

## [1.2.0] - 2026-06-24
### Added
- **Format Selection Support**: Implemented `DocumentRangeFormattingEditProvider`. Now you can highlight a specific block of text (like a single table) and format only that section without touching the rest of the file using `Cmd+K Cmd+F` (`Ctrl+K Ctrl+F`).

## [1.1.0] - 2026-06-24
### Added
- **Smart Block Spacing**: Automatically ensures exactly one blank line before major blocks (Scenarios, Rules, Backgrounds, Tags).
- **Dynamic Table Alignment**: Tables now automatically inherit the exact indentation level of their preceding keyword.

## [1.0.0] - 2026-06-24
### Added
- Initial release.
- Core Gherkin indentation formatting engine.
- Intelligent data table alignment algorithm.
- Integration with VS Code `DocumentFormattingEditProvider`.
