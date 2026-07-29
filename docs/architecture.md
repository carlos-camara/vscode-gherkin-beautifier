# Architecture

This document describes the high-level architecture of Gherkin PowerTools, focusing on how its internal services interact.

## Workspace Event Bus

To maintain high performance and decouple domain services from VS Code's extension lifecycle and file system watchers, Gherkin PowerTools uses a centralized **Workspace Event Bus** (`WorkspaceEventBus`).

### Why an Event Bus?
In earlier versions, each feature (like the Test Controller, Symbol Cache, and Linter) maintained its own `vscode.FileSystemWatcher` and subscribed independently to `vscode.workspace.onDidChangeTextDocument`. This caused:
- **Redundant Disk I/O:** Multiple services independently scanned the disk when files changed.
- **Race Conditions:** Different services updated their internal states at different times.
- **Memory Leaks:** It was difficult to ensure all watchers were properly disposed when features were toggled on or off.

### How it Works
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
When running Behave tests through the Test Explorer, the extension spawns Behave as a child process and injects a custom Python formatter (`vscode_behave_formatter.py`). This formatter translates Python-side test results and the final **Context Snapshot** into standardized JSON events (`##VSCODE_BEHAVE_EVENT:`). These stdout events are piped directly back to the extension, enabling the Test Controller to seamlessly bridge real-time execution states and context variables into the VS Code UI.

### Live Step Tracking
As the custom formatter receives step events, it emits a `step_start` payload precisely before a Python step function runs. The Test Controller listens to this and dynamically creates a transient text decoration in the active `vscode.TextEditor`. This achieves the real-time "animation" of tests moving down the Gherkin feature file.

### Lifecycle & Disposal
Every service that calls `eventBus.onEvent()` tracks its subscription with an `eventBusDisposable`. When a service is disposed, it automatically unregisters itself from the Event Bus. When the extension deactivates, the Event Bus itself is disposed, instantly severing all active subscriptions and preventing memory leaks.
