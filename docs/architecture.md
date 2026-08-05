# Architecture

This document describes the high-level architecture of Gherkin PowerTools, focusing on how its internal services interact.

## Workspace Event Bus

To maintain high performance and decouple domain services from VS Code's extension lifecycle and file system watchers, Gherkin PowerTools uses a centralized **Workspace Event Bus** (`WorkspaceEventBus`).

### Why an Event Bus?
In earlier versions, each feature (like the Test Controller, Symbol Cache, and Linter) maintained its own `vscode.FileSystemWatcher` and subscribed independently to `vscode.workspace.onDidChangeTextDocument`. This caused:
- **Redundant Disk I/O:** Multiple services independently scanned the disk when files changed.
- **Race Conditions:** Different services updated their internal states at different times.
- **Memory Leaks:** It was difficult to ensure all watchers were properly disposed when features were toggled on or off.

### How the Event Bus Works
1. **Centralized Watchers (`extension.ts` and `discovery.ts`):**
   The extension initializes exactly *one* set of VS Code file system watchers and text document listeners at the root of the extension.
2. **Event Routing:**
   When a relevant VS Code event occurs (e.g., a `.feature` file is saved or a `step` file is modified), the root watchers convert it into a strongly typed `WorkspaceEvent` (e.g., `featureFileChanged` or `stepFileDeleted`).
3. **Publishing:**
   This event is published to the `WorkspaceEventBus`.
4. **Subscription & Debouncing:**
   Domain services inject the Event Bus as a dependency during initialization (`setEventBus`). They listen for specific event types. Services like the `GherkinLinter` or `FeatureCache` handle their own internal debouncing logic to ensure that rapid typing in the editor only triggers expensive operations (like AST parsing) once the user pauses.

### Event Payloads
The `WorkspaceEvent` union type includes payloads for:
- **Feature Files (`featureFileCreated`, `featureFileChanged`, `featureFileDeleted`)**: Triggers Test Explorer updates and Feature Cache invalidation.
- **Step Files (`stepFileCreated`, `stepFileChanged`, `stepFileDeleted`)**: Triggers Python parsing in the Symbol Cache to update step definitions.
- **Configuration (`configurationChanged`)**: Triggers full cache flushes when critical settings like `stepGlobs` are modified.
- **Editor State (`textDocumentOpened`, `textDocumentChanged`, `activeEditorChanged`)**: Drives real-time diagnostic linting and semantic highlighting.

### Execution Output & Custom Formatting
When running Behave tests through the Test Explorer, the extension spawns Behave as a child process and injects a custom Python formatter (`vscode_behave_formatter.py`).
This formatter translates Python-side test results and the final **Context Snapshot** into standardized JSON events (`##VSCODE_BEHAVE_EVENT:`).
These stdout events are piped directly back to the extension, enabling the Test Controller to seamlessly bridge real-time execution states and context variables into the VS Code UI.

### Performance Characteristics
- **Debounced Updates**: Groups rapid file system events (e.g. typing or git checkouts) into 300ms windows to prevent thrashing.
- **Incremental Indexing**: Uses a diffing algorithm (via `computeDiff()`) so that only new, modified, or deleted Python files trigger regex extraction. Unchanged files are skipped entirely.
- **Case-Insensitive URI Normalization**: Enforces strict `toLowerCase()` transformation natively within `getCanonicalUri()` before indexing and retrieval. This cross-platform architectural design ensures resilient behaviour on macOS and Windows file systems, preventing duplicate keys or cache misses.
- **Garbage Collection**: Deletes stale `StepDefinition` instances from memory when their parent file is deleted or when the workspace changes.

### Live Step Tracking
As the custom formatter receives step events, it emits a `step_start` payload precisely before a Python step function runs. The Test Controller listens to this and dynamically creates a transient text decoration in the active `vscode.TextEditor`. This achieves the real-time "animation" of tests moving down the Gherkin feature file.

### Context-Aware Completion Ranking
To provide intelligent Behave step autocomplete locally and deterministically, the extension implements a local `CompletionRankingService` backed by a background `UsageIndexer`.
1. **UsageIndexer**: Hooked into the `WorkspaceEventBus`, this indexer lazily scans `.feature` files in the background to build a tag affinity matrix (which steps are used with which tags) and track term frequency.
2. **LRU Cache Tracking**: When a user accepts a completion, an internal command (`gherkinPowerTools.internal.recordCompletion`) is fired, updating a Least Recently Used (LRU) cache to ensure recently used steps get a high priority boost.
3. **Deterministic Ranking**: When the user requests autocomplete, the `CompletionRankingService` calculates a score based on LRU presence, active feature context, tag affinity, and semantic string matching. The highest scores are assigned a lexicographical `sortText` (e.g., `000_`) to force VS Code's IntelliSense to present the most relevant steps at the top.

### Lifecycle & Disposal
Every service that calls `eventBus.onEvent()` tracks its subscription with an `eventBusDisposable`. When a service is disposed, it automatically unregisters itself from the Event Bus. When the extension deactivates, the Event Bus itself is disposed, severing all active subscriptions and preventing memory leaks.

## First-Run Onboarding Experience

To provide a zero-configuration setup experience, Gherkin PowerTools includes a dedicated `FirstRunExperience` module.

### How Onboarding Works
1. **Lazy Loading:** The onboarding check is deferred using a `setTimeout` inside the extension's activation lifecycle. This ensures that the heavy work of scanning the workspace for Python Behave indicators does not block VS Code's critical startup path, adhering to strict performance best practices.
2. **State Tracking:** The extension queries `context.globalState` to determine if the user has previously completed or dismissed the onboarding.
3. **Workspace Discovery:** If it's a first run, the `BehaveDetector` lightly scans the workspace. If it finds `.feature` files and indications of a Behave project, it triggers a welcome notification. If no Behave indicators are found, the extension remains completely silent to avoid annoying non-Behave users.
4. **Actionable Outcomes:** The notification routes users immediately to the Walkthrough or the Gherkin Health Dashboard, driving immediate time-to-value.

## AST Repository

To optimize performance and eliminate redundant parsing of the same document across multiple providers (formatter, linter, hover, definitions), Gherkin PowerTools centralizes Gherkin parsing through the **AST Repository** (`AstRepository`).

### How the Repository Works
1. **Memoization:** When a provider requests the AST for a document, the repository checks its cache. If a cached `ParseResult` exists for the current document version, it is returned immediately.
2. **Thundering Herd Protection:** The repository caches the *Promise* of the parse operation. If multiple providers request the AST simultaneously before the first parse completes, they all await the exact same Promise, guaranteeing the document is only parsed once per version.
3. **Event-Driven Invalidation:** The repository listens to the `WorkspaceEventBus`. When a `featureFileChanged` or `featureFileDeleted` event fires, the repository automatically purges the stale AST from its internal LRU cache.
4. **Memory Management:** The repository maintains a bounded Least-Recently-Used (LRU) cache (e.g., maximum 100 parsed documents) to prevent unbounded memory growth in large workspaces.
5. **Diagnostics & Telemetry:** If metrics are enabled, the repository integrates with the `MetricsLogger` to track parse durations, cache hit ratios, and parser failures without overhead.

### Architecture Validation
To ensure long-term stability and prevent regressions in these core architectural patterns, Gherkin PowerTools employs an **Architecture Validation Test Suite**. This suite runs in CI and automatically validates that:
- Every command declared in `package.json` is successfully registered in the extension context.
- Every registered provider (CodeLens, Hover, Definition, CodeAction, Completion) is properly pushed to the context subscriptions for disposal.
- All file watchers and the Event Bus are correctly disposed during deactivation.
- All core modules and services initialize successfully without exceptions during bootstrap.
- No duplicate command registrations exist.

## Workspace Relationship Graph

To enable instantaneous, O(1) semantic queries across massive projects, the extension introduces the **Workspace Relationship Graph** (`WorkspaceGraph`).

### How the Graph Works
1. **Incremental, Event-Driven Construction:** Subscribes to the `WorkspaceEventBus`. When a Gherkin document or Python step file is changed, the graph updates only the affected nodes.
2. **Zero-Overhead Parsing:** Instead of re-parsing text, it natively consumes the memoized AST from the `AstRepository` and the pre-indexed symbols from the `SymbolCache`.
3. **Semantic Mapping:** The graph establishes bi-directional edges between Gherkin steps and Python step definitions (`StepNode` <-> `StepDefNode`), and tracks Tag inheritance downwards to Scenarios. Crucially, it tracks `semanticType` (Given/When/Then) context for continuation keywords (`And`, `But`), preventing ambiguous step errors when distinct step definitions share the same regex.
4. **O(1) Queries:** Powers ultra-fast operations like `getUsages`, `getReferences`, `getImpactedScenarios`, and `getDuplicateImplementations` without iterating over regex patterns on every hover or go-to-definition request.
5. **Dashboard Webviews:** The graph directly powers the Gherkin Health Dashboard. The backend queries the graph for complexity metrics, tag distributions, unused, duplicated, and ambiguous nodes, serializes them into a JSON payload, and injects them into an HTML Webview.
   Standard VS Code message passing (`acquireVsCodeApi().postMessage`) bridges the UI clicks back to the extension host to trigger `vscode.window.showTextDocument` for interactive file navigation.
   The extension also uses `MetricsHistory` to persist a lightweight snapshot of the metrics securely inside VS Code's `ExtensionContext.workspaceState`. This local storage enables the dashboard to render Historical Trend Analysis charts using Chart.js without sending any data off the machine.
   - **Metrics Versioning & Isolation:** The storage architecture guarantees resilience by enforcing a strict schema (`HistorySchemaV1`). It implements branch-isolated metrics mapping by interrogating the active Git branch via `WorkspaceEventBus`. Deduplication logic further compresses the storage footprint by intelligently ignoring consecutive identical snapshots.
6. **Encapsulation:** Internal diagnostics rules (such as `OversizedFeatureRule`, `DuplicatedStepsRule`, etc.) and configuration profiles remain strongly encapsulated within the Anti-pattern Engine. By explicitly eliminating dead code and avoiding public `export` keywords for these internal utilities, the extension keeps its bundle size minimized and its API surface safe from regressions.

## Real-Time Impact Analysis Engine

Leveraging the `WorkspaceGraph`, the extension provides a real-time Impact Analysis engine (`ImpactAnalyzer`).

### How Impact Analysis Works
1. **Graph Traversal**: The `ImpactAnalyzer` queries the `WorkspaceGraph` for usages of a given step definition ID (`getUsages()`).
2. **Impact Calculation**: It traverses the relationships upwards to find the affected parent `Scenario` and `Feature` nodes. By evaluating the cardinality of affected scenarios, it calculates the severity (e.g., High, Medium, Low, Unused).
3. **Presentation**: The analysis results are exposed via the `ImpactCodeLensProvider`, which places interactive CodeLenses directly above Python decorators. Clicking the lens displays a quick pick menu of affected scenarios, enabling targeted testing and confident refactoring.

## Contextual Feature Discovery

To help users naturally discover advanced capabilities (like formatting, step generation, or the dashboard) without intrusive onboarding popups, the extension implements the **ContextualFeatureDiscoveryService**.

### How Discovery Works
1. **Event-Driven Heuristics:** The service subscribes to the `WorkspaceEventBus` (e.g., `featureFileChanged`, `textDocumentOpened`). It applies lightweight heuristic rules to user actions to detect when a specific feature would be highly valuable.
2. **Rules Engine:** Features are modeled as individual "Rules" (e.g., `FormatterRule`, `GenerateStepRule`). Each rule defines an `evaluate()` condition. For instance, the formatter rule fires if the user saves a `.feature` file that contains unaligned tables, while the generate step rule fires when the user pauses on an undefined step.
3. **State Tracking (Dismissals):** To ensure a non-intrusive experience, the service persists the state of recommendations in VS Code's `ExtensionContext.globalState`. If a user dismisses a recommendation or clicks "Don't show again", that specific rule is permanently silenced.
4. **Notification Debouncing:** The service queues recommendations and prevents rapid consecutive popups, ensuring users are not overwhelmed during fast editing sessions.

## Command Line Interface (CLI) Build Architecture

To bring the Workspace Intelligence Engine into CI/CD environments without duplicating logic or maintaining two separate codebases, Gherkin PowerTools exposes a standalone CLI (`gherkin-pt`).

### How the CLI Reuses the Extension Core
1. **Shared Domain Logic:** The CLI directly imports and runs the core services (e.g. `WorkspaceGraph`, `AstRepository`, `Linter`, `Formatter`) that the extension uses.
2. **Build-Time Mocking:** Because the domain logic relies on `vscode` APIs (like `vscode.Uri`, `vscode.Range`, `vscode.Diagnostic`), the CLI cannot run in standard Node.js without a reference to `vscode`. Instead of refactoring the entire codebase to abstract away the `vscode` namespace, the build system (esbuild) utilizes an alias plugin (`vscode-mock.ts`).
3. **The VS Code Shim:** During the `esbuild` compilation step for the CLI (`npm run esbuild`), any `import * as vscode from 'vscode'` is intercepted and redirected to `src/cli/vscode-mock.ts`. This file provides a lightweight, pure-Node.js shim containing functional implementations of `Uri`, `Position`, `Range`, and diagnostic severities.
4. **Unified Configuration Layer (`defaults.ts`)**: To guarantee 100% feature parity between the CLI and the VS Code Extension, all default configuration values, schema validations, and precedence hierarchies are strictly centralized in a pure-TypeScript module (`defaults.ts`). This ensures both environments resolve profiles and settings identically without code duplication.
5. **Output Generation:** The CLI consumes the results of the `WorkspaceGraph` or `Formatter` and translates the mocked VS Code diagnostics/edits into standard `stdout` (human-readable console tables or machine-readable JSON), exiting with code `1` if issues are found.
