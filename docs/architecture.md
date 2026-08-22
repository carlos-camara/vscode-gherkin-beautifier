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
   The extension initializes exactly *one* set of VS Code file system watchers and text document listeners. These are orchestrated from the composition root (`extension.ts`) and specific services (`discovery.ts`).
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

### Secure Execution Gateway & Workspace Trust
To mitigate command injection vulnerabilities and protect users from malicious workspaces, test execution runs through a **Secure Execution Gateway**:
1. **Workspace Trust Integration**: Before any process is spawned, the extension verifies the environment using VS Code's native `workspace.isTrusted` API. Test execution is strictly blocked in untrusted workspaces.
2. **Structured Execution Model**: Instead of parsing free-form shell commands, the extension enforces a structured `behave.execution` object (separating the `executable` and its `arguments`).
3. **Safe Process Spawning**: The underlying child process is spawned securely using `cp.spawn` with `shell: false`, ensuring arguments are passed directly to the executable without shell evaluation, thereby neutralizing injection vectors.
4. **Machine-Specific Configuration Isolation**: To prevent absolute executable paths (e.g., local Python interpreters) from being inadvertently committed to version control in shared `.gherkin-powertoolsrc.json` or `.vscode/settings.json` files, the execution model introduces a strict `behave.localExecutable` override scoped exclusively to the user's machine settings.
5. **Zero-Config Virtual Environment Discovery**: To eliminate manual setup, the extension leverages the official Microsoft Python API to detect the active virtual environment. If a global interpreter is active, Gherkin PowerTools automatically scans the workspace and prioritizes local virtual environments (like `.venv`, `venv`, `env`) implicitly.

### Performance Characteristics
- **Debounced Updates**: Groups rapid file system events (e.g. typing or git checkouts) into 300ms windows to prevent thrashing.
- **Incremental Indexing**: Uses a diffing algorithm (via `computeDiff()`) so that only new, modified, or deleted Python files trigger regex extraction. Unchanged files are skipped entirely.
- **Resource Identity Canonicalization**: Utilizes the `ResourceIdentity` abstraction to determine canonical URIs dynamically. It correctly enforces case-sensitivity on Linux, WSL, and remote filesystems, while safely applying case-insensitive lowercasing only on macOS and Windows. This prevents duplicate keys and collision bugs across different operating systems.
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
1. **Lazy Loading:** The onboarding check is deferred using the `DeferredBootstrap` orchestration layer inside the extension's activation lifecycle. This ensures that the heavy work of scanning the workspace for Python Behave indicators does not block VS Code's critical startup path, adhering to strict performance best practices.
2. **State Tracking:** The extension queries `context.globalState` to determine if the user has previously completed or dismissed the onboarding.
3. **Workspace Discovery:** If it's a first run, the `BehaveDetector` lightly scans the workspace. If it finds `.feature` files and indications of a Behave project, it triggers a welcome notification. If no Behave indicators are found, the extension remains completely silent to avoid annoying non-Behave users.
4. **Actionable Outcomes:** The notification routes users immediately to the Walkthrough or the Gherkin Health Dashboard, driving immediate time-to-value.

## AST Repository

To optimize performance and eliminate redundant parsing of the same document across multiple providers (formatter, linter, hover, definitions), Gherkin PowerTools centralizes Gherkin parsing through the **AST Repository** (`AstRepository`).

### Safe-Unit Formatting Model
The formatter leverages the AST Repository to implement a **Safe-Unit Expansion Model** for range formatting.
Instead of resolving selections to purely hierarchical AST nodes (which often over-expanded to entire Scenarios),
the AST is mapped into a flat array of contiguous multi-line groups (`groupIds`) for atomic units (DataTables, DocStrings, Tag Blocks).
The range formatter performs O(1) bounds-checking on this array to securely contain formatting edits to the absolute minimum safe lines, radically reducing structural blast radius.

### Formatter Error UX Separation
To provide a native and non-intrusive VS Code experience, the extension strictly decouples the error reporting behavior of formatting based on the invocation context:
1. **Automatic Invocations (e.g., Format on Save):** If the AST Repository detects structural syntax errors, the formatter silently returns no edits. It completely suppresses toast warnings (`showWarningMessage`) to ensure the user's typing flow is never interrupted by popups while drafting incomplete documents.
2. **Explicit Invocations (Command Palette / Shortcuts):** Explicitly requested formatting commands proactively check the AST for errors and provide a concise, actionable toast warning if formatting cannot proceed, confirming to the user why their manual action was rejected.

### How the Repository Works
1. **Memoization:** When a provider requests the AST for a document, the repository checks its cache. If a cached `ParseResult` exists for the current document version, it is returned immediately.
2. **Thundering Herd Protection:** The repository caches the *Promise* of the parse operation. If multiple providers request the AST simultaneously before the first parse completes, they all await the exact same Promise, guaranteeing the document is only parsed once per version.
3. **Resilient Module Loader:** The extension dynamically loads the official `@cucumber/gherkin` ESM libraries via a robust retry strategy. If module resolution fails intermittently (e.g., during Extension Host initialization), the cached rejection is safely evicted and retried (up to 3 times) to ensure the parser recovers automatically without a window reload.
4. **Event-Driven Invalidation:** The repository listens to the `WorkspaceEventBus`. When a `featureFileChanged` or `featureFileDeleted` event fires, the repository automatically purges the stale AST from its internal LRU cache.
5. **Memory Management:** To safely index massive enterprise workspaces without exhausting the VS Code Extension Host process limits, the repository enforces a **Soft Memory Budget** (Weighted LRU cache).
   The budget is statically capped at ~50MB. Rather than arbitrarily evicting files based on count, it dynamically estimates AST size based on character count and sheds the oldest documents only when memory pressure demands it.
6. **Diagnostics & Telemetry:** If metrics are enabled, the repository integrates with the `MetricsLogger` to track parse durations, cache hit ratios, cache evictions, real-time memory usage, and parser failures. The logger uses an event-driven configuration listener to avoid synchronous IPC polling, imposing zero overhead when disabled.
   To prevent memory leaks and ensure stable test environments, the `MetricsLogger` lifecycle is formally bound to the extension's initialization phase (`extension.activate()`). Its configuration listeners are explicitly tracked via `context.subscriptions`, and its state is actively isolated between Extension Host test runs using a dedicated `reset()` mechanism.
### Synchronous Execution & Threading Model
The native `@cucumber/gherkin` parser operates synchronously within the VS Code Extension Host. While a `worker_threads` architecture was evaluated, benchmark audits revealed that 99% of real-world `.feature` files (under 1,000 scenarios) parse in `<20ms`.
Serializing the enormous JSON AST across IPC to a background worker would consistently exceed this 20ms baseline, effectively making the extension slower for typical workloads.

As a result, parsing remains on the main Extension Host thread. Massive, pathologically large files (>10,000 scenarios) may cause momentary stuttering (~75ms Event Loop delay) but fall well below VS Code's critical 500ms warning threshold. The repository mitigates UI blocking entirely through strict *debouncing* (memoization), ensuring the parser only runs when document edits stabilize.

### Architecture Validation
To ensure long-term stability and prevent regressions in these core architectural patterns, Gherkin PowerTools employs an **Architecture Validation Test Suite**. This suite runs in CI and automatically validates that:
- Every command declared in `package.json` is successfully registered in the extension context.
- Every registered provider (CodeLens, Hover, Definition, CodeAction, Completion) is properly pushed to the context subscriptions for disposal.
- All file watchers and the Event Bus are correctly disposed during deactivation.
- All core modules and services initialize successfully without exceptions during bootstrap.
- No duplicate command registrations exist.

## Deferred Activation Lifecycle

To optimize VS Code startup time and ensure extension stability, Gherkin PowerTools employs a minimal composition root pattern in `extension.ts` and delegates capability registration to specialized modules (`src/activation/*`). It delays the initialization of heavy components (such as caches, indexes, and workspace graph traversal) and the registration of file watchers.

This process is strictly orchestrated by the `DeferredBootstrap` component, which replaces simple and unsafe timeouts with a deterministic, cancellable state machine.

### Activation Submodules
The extension bootstrap is broken down into clean submodules under `src/activation/`:
1. **`migration.ts`**: Handles graceful upgrades of legacy settings (e.g. `behave.command`).
2. **`contextService.ts`**: Configures internal VS Code "when" contexts for dynamic UI.
3. **`commands.ts`**: Registers all user-facing Command Palette commands.
4. **`walkthrough.ts`**: Manages the one-time first-run onboarding experience.

### Lifecycle Diagram

```mermaid
sequenceDiagram
    participant VSCode
    participant Extension
    participant DeferredBootstrap
    participant CancellationToken
    participant Watchers
    participant Caches

    VSCode->>Extension: activate()
    Extension->>DeferredBootstrap: new()
    Extension->>DeferredBootstrap: start(2000)
    Extension-->>VSCode: Promise<void> resolved

    alt Normal Execution
        Note over DeferredBootstrap: 2 seconds pass
        DeferredBootstrap->>CancellationToken: isCancellationRequested?
        DeferredBootstrap->>Watchers: createFileSystemWatcher() (Essential, Sync)
        Note over DeferredBootstrap: Watchers run immediately

        par Capability: Symbol Cache
            DeferredBootstrap->>Caches: runWithRetry(symbolCache)
        and Capability: Usage Indexer
            DeferredBootstrap->>Caches: runWithRetry(usageIndexer)
        and Capability: Feature Cache
            DeferredBootstrap->>Caches: runWithRetry(featureCache)
        end

        Caches-->>DeferredBootstrap: Settled (Ready or Failed)
        Note over DeferredBootstrap: Capability state updated

    else Cancelled (VSCode deactivates)
        VSCode->>DeferredBootstrap: dispose()
        DeferredBootstrap->>CancellationToken: cancel()
        DeferredBootstrap->>DeferredBootstrap: cleanup()
    end
```

### Capability-Based Fault Isolation
To ensure high availability of critical services (like file watchers), the initialization process is broken down into isolated **Capabilities**.
- **Essential Capabilities** (e.g., File Watchers, Event Bus): Run synchronously. If they fail, the error is logged, but they don't halt other services.
- **Optional Capabilities** (e.g., Feature Cache, Usage Indexer): Initialized concurrently. A failure in an optional capability does not affect essential systems.
- **Dependent Capabilities** (e.g., Workspace Graph): Only execute if their parent (Symbol Cache) initializes successfully.

### Safety & Idempotency
- **Bounded Exponential Retries**: I/O-bound caches utilize a `runWithRetry` helper. They automatically recover from transient read errors (up to 3 attempts with exponential backoff) without causing retry storms.
- **Cancellable Contexts**: The internal `CancellationToken` is checked at every step—before tasks start, during retries, and before chaining dependent tasks—preventing orphan subscriptions if VS Code deactivates early.
- **Fail-Safe Cleanup**: The state machine tracks every capability (`pending`, `running`, `ready`, `failed`, `cancelled`). Single-capability failures isolate their state, keeping the overall extension responsive.

## Workspace Relationship Graph

To enable instantaneous, O(1) semantic queries across massive projects, the extension introduces the **Workspace Relationship Graph** (`WorkspaceGraph`).

### VFS URI Canonicalization (Cross-Platform Matcher)
VS Code URIs (`document.uri.toString()`) inherently preserve the filesystem casing (e.g. `/Users/carlos/...` vs `/users/carlos/...`), which poses a massive risk for dictionary/map lookups during graph traversal on case-insensitive operating systems (macOS, Windows).
The `WorkspaceGraph` completely mitigates this by abstracting all VFS interactions through a strict `ResourceIdentity.getCanonicalUriString()` resolver, ensuring that nodes are strictly mapped and queries are seamlessly resolved despite underlying platform case idiosyncrasies.

### Transactional & Immutable Generation Model
To prevent race conditions during heavy background indexing and ensure dependent services query a stable state, the graph operates on a strictly **transactional model** utilizing an immutable generation container (`WorkspaceGraphGeneration`).

1. **Immutable Reads (`currentGeneration`):** All access to graph data (nodes, steps, usages) is performed through `graph.currentGeneration`. This guarantees that readers—such as the Test Explorer, Language Server providers, or Impact Analyzer—observe a consistent snapshot of the graph that cannot mutate during a read cycle.
2. **Atomic Writes (`executeTransaction`):** Any modification to the graph (adding files, updating step definitions) must happen inside an `executeTransaction` block. This block creates a mutable clone of the graph's internal state.
3. **Concurrency Isolation:** The transaction mechanism uses a `commitMutex` to ensure writes are serialized. Crucially, if a newer file update supersedes a pending transaction (detected via `updateRequests`), the stale transaction is safely dropped, preventing out-of-order writes from corrupting the graph.
4. **Failure Safety:** If an error occurs during parsing or inside a transaction block, the transaction is cleanly aborted, and the last known-good `currentGeneration` remains entirely unaffected.

### How the Graph Works
1. **Incremental, Event-Driven Construction:** Subscribes to the `WorkspaceEventBus`. When a Gherkin document or Python step file is changed, the graph updates only the affected nodes via `executeTransaction`.
2. **Zero-Overhead Parsing:** Instead of re-parsing text, it natively consumes the memoized AST from the `AstRepository` and the pre-indexed symbols from the `SymbolCache`.
3. **Semantic Mapping:** The graph establishes bi-directional edges between Gherkin steps and Python step definitions (`StepNode` <-> `StepDefNode`), and tracks Tag inheritance downwards to Scenarios. Crucially, it tracks `semanticType` (Given/When/Then) context for continuation keywords (`And`, `But`), preventing ambiguous step errors when distinct step definitions share the same regex.
4. **O(1) Queries & Known Mutation Limits:** Powers ultra-fast operations like `getUsages`, `getReferences`, `getImpactedScenarios`, and `getDuplicateImplementations` without iterating over regex patterns on every hover or go-to-definition request.
   However, graph mutation during massive file changes (e.g. branch switches in 5,000+ step workspaces) currently scales at O(N²) due to full-workspace regex re-evaluations. Algorithmic optimizations to introduce Resource-to-Node IDs and Semantic Prefix indexing are planned to eliminate this bottleneck.
5. **Dashboard Webviews:** The graph directly powers the Gherkin Health Dashboard. The backend queries the graph for complexity metrics, tag distributions, unused, duplicated, and ambiguous nodes, serializes them into a JSON payload, and injects them into an HTML Webview.
   Standard VS Code message passing (`acquireVsCodeApi().postMessage`) bridges the UI clicks back to the extension host to trigger `vscode.window.showTextDocument` for interactive file navigation.
   The extension also uses `MetricsHistory` to persist a lightweight snapshot of the metrics securely inside VS Code's `ExtensionContext.workspaceState`. This local storage enables the dashboard to render Historical Trend Analysis charts using Chart.js without sending any data off the machine.
   - **Metrics Versioning & Isolation:** The storage architecture guarantees resilience by enforcing a strict schema (`HistorySchemaV1`). It implements branch-isolated metrics mapping by interrogating the active Git branch via `WorkspaceEventBus`. Deduplication logic further compresses the storage footprint by intelligently ignoring consecutive identical snapshots.
6. **Encapsulation:** Internal diagnostics rules (such as `OversizedFeatureRule`, `DuplicatedStepsRule`, etc.) and configuration profiles remain strongly encapsulated.

### BDD Anti-Pattern Detection Engine

The extension implements a dedicated `AntiPatternEngine` that operates asynchronously to decouple heavy workspace analysis from real-time syntax linting.

1. **Event-Driven Execution:** The engine subscribes to `WorkspaceEventBus` and re-evaluates the active graph generation after a 500ms debounce window following file modifications.
2. **Decoupled from Linter:** Unlike the `GherkinLinter` (which performs instant, single-file AST syntax checks), the `AntiPatternEngine` analyzes the entire `WorkspaceGraph` for semantic and architectural debt (e.g., duplicated steps, oversized scenarios). This separation guarantees that typing remains 100% responsive without blocking the extension host.
3. **Diagnostics & Dashboard Integration:** The engine pushes VS Code `Diagnostic` objects to the Problems view, while also calculating aggregate metrics (Maintainability, Complexity) that power the Gherkin Health Dashboard.

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

## Dynamic UI Contexts

To reduce UI clutter and ensure contextual relevance, Gherkin PowerTools dynamically manages VS Code context keys (e.g., `gherkinPowerTools.isCursorOnStep`) to control the visibility of context menu commands.

### How Dynamic Context Works
1. **Selection Listening:** The extension subscribes to `vscode.window.onDidChangeTextEditorSelection`.
2. **Debounced Evaluation:** When the cursor moves, a lightweight evaluation checks if the active line matches a valid Gherkin step pattern.
3. **Context Injection:** The result is injected into VS Code's context using `executeCommand('setContext', ...)`. This drives the `when` clauses in `package.json` to dynamically show or hide commands like **Rename Step** only when applicable, maintaining a clean editor context menu.

## Command Line Interface (CLI) Build Architecture

To bring the Workspace Intelligence Engine into CI/CD environments without duplicating logic or maintaining two separate codebases, Gherkin PowerTools exposes a standalone CLI (`@carlos-camara/gherkin-pt`).

### How the CLI Reuses the Extension Core
1. **Shared Domain Logic:** The CLI directly imports and runs the core services (e.g. `WorkspaceGraph`, `AstRepository`, `Linter`, `Formatter`) that the extension uses.
2. **Build-Time Mocking:** Because the domain logic relies on `vscode` APIs (like `vscode.Uri`, `vscode.Range`, `vscode.Diagnostic`), the CLI cannot run in standard Node.js without a reference to `vscode`. Instead of refactoring the entire codebase to abstract away the `vscode` namespace, the build system (esbuild) utilizes an alias plugin (`vscode-mock.ts`).
3. **The VS Code Shim:** During the `esbuild` compilation step for the CLI (orchestrated by `scripts/build-npm-cli.js`), any `import * as vscode from 'vscode'` is intercepted and redirected to `src/cli/vscode-mock.ts`. This file provides a lightweight, pure-Node.js shim containing functional implementations of `Uri`, `Position`, `Range`, and diagnostic severities.
4. **Unified Configuration Layer (`defaults.ts`)**: To guarantee 100% feature parity between the CLI and the VS Code Extension, all default configuration values, schema validations, and precedence hierarchies are strictly centralized in a pure-TypeScript module (`defaults.ts`). This ensures both environments resolve profiles and settings identically without code duplication.
5. **Output Generation:** The CLI consumes the results of the `WorkspaceGraph` or `Formatter` and translates the mocked VS Code diagnostics/edits into standard `stdout` (human-readable console tables or machine-readable JSON), exiting with code `1` if issues are found.
