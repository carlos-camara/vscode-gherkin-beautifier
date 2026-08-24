# Command Reference

Gherkin PowerTools contributes several commands to improve your workflow. All commands are prefixed with `Gherkin PowerTools:` in the Command Palette.

---

## Command Center
- **Identifier**: `gherkinPowerTools.commandCenter`
- **Where it appears**: Command Palette.
- **Required context**: None.
- **Input**: None.
- **Result**: Opens a unified QuickPick menu giving access to formatting, statistics, running tests, debugging, and workspace diagnostics.
- **Default shortcut**: <kbd>Alt+Shift+G</kbd> (<kbd>Option+Shift+G</kbd> on macOS).

---

## Fix All Safe Auto-Fixable Problems
- **Identifier**: `gherkinPowerTools.fixAllSafe`
- **Where it appears**: Command Palette.
- **Required context**: An active `.feature` file.
- **Input**: None.
- **Result**: Automatically applies all non-overlapping, deterministic (semantics-preserving) Quick Fixes (e.g. missing colons, exact spelling corrections, and table alignments) across the entire active document without breaking undo history.
- **Default shortcut**: Depends on VS Code's `editor.action.fixAll` shortcut.

---

## Suppress Gherkin Rule Finding
- **Identifier**: `gherkinPowerTools.suppressFinding`
- **Where it appears**: Internal Code Action (hidden from Command Palette).
- **Required context**: Activated via the "Suppress finding" Quick Fix inside the editor.
- **Input**: The rule ID, file URI, and line range (passed internally by the Code Action). Prompts the user for an optional/required reason.
- **Result**: Adds an entry to `.gherkin-pt-suppressions.json` for the given rule and document line.
- **Default shortcut**: None.

---

## Format Gherkin Document
- **Identifier**: `gherkinPowerTools.format`
- **Where it appears**: Command Palette, Editor Context Menu (Gherkin PowerTools submenu).
- **Required context**: An active `.feature` file.
- **Input**: None.
- **Result**: Formats the active Gherkin document or the current selection according to your configuration profile.
- **Related setting**: `gherkinPowerTools.profile`, `gherkinPowerTools.indentation.steps`, etc.
- **Default shortcut**: Depends on VS Code's `editor.action.formatDocument` (e.g., <kbd>Shift+Alt+F</kbd>).

---

## Diagnose Workspace
- **Identifier**: `gherkinPowerTools.diagnoseWorkspace`
- **Where it appears**: Command Palette, Editor Context Menu (Gherkin PowerTools submenu).
- **Required context**: An active `.feature` file or workspace.
- **Input**: None.
- **Result**: Analyzes environment versions, workspace layout, discovered feature/step files, indexed definitions, Python extension status, and `.gherkin-powertoolsrc.json` validity. Generates an Output Channel report with a 1-click `Copy Sanitized Report` action.
- **Default shortcut**: <kbd>Alt+Shift+D</kbd> (<kbd>Option+Shift+D</kbd> on macOS).

---

## Show Gherkin Health
- **Identifier**: `gherkinPowerTools.showGherkinHealth`
- **Where it appears**: Command Palette, Editor Context Menu (Gherkin PowerTools submenu).
- **Required context**: An active `.feature` file.
- **Input**: None.
- **Result**: Parses all discovered feature files in the workspace and displays an interactive HTML dashboard containing project health, maintainability, tag impact, and complexity distribution.
- **Default shortcut**: <kbd>Alt+Shift+H</kbd> (<kbd>Option+Shift+H</kbd> on macOS).

---

## Show Impact Details
- **Identifier**: `gherkinPowerTools.showImpactDetails`
- **Where it appears**: CodeLens directly above Python step definitions.
- **Required context**: A configured Python Behave workspace and `gherkinPowerTools.impactAnalysis.enabled` must be true.
- **Input**: Clicking the CodeLens above a step definition.
- **Result**: Opens a QuickPick menu listing all scenarios that use the selected step definition. Selecting a scenario navigates you directly to it.
- **Default shortcut**: None.

---

## Show Developer Metrics
- **Identifier**: `gherkinPowerTools.showMetrics`
- **Where it appears**: Command Palette.
- **Required context**: The `gherkinPowerTools.diagnostics.metricsEnabled` setting must be enabled.
- **Input**: None.
- **Result**: Opens an Output Channel displaying real-time parser performance metrics, cache hit ratios, and AST complexities to aid in developer troubleshooting.
- **Related setting**: `gherkinPowerTools.diagnostics.metricsEnabled`
- **Default shortcut**: None.

---

## Export History as JSON
- **Identifier**: `gherkinPowerTools.analytics.exportHistory`
- **Where it appears**: Command Palette.
- **Required context**: None.
- **Input**: None.
- **Result**: Prompts for a file path and exports the complete snapshot history of your workspace metrics in JSON format.
- **Default shortcut**: None.

---

## Clear History
- **Identifier**: `gherkinPowerTools.analytics.clearHistory`
- **Where it appears**: Command Palette.
- **Required context**: None.
- **Input**: A confirmation dialog.
- **Result**: Irreversibly deletes all historical metric snapshots for the active workspace.
- **Default shortcut**: None.

---

## Replay Onboarding
- **Identifier**: `gherkinPowerTools.replayOnboarding`
- **Where it appears**: Command Palette.
- **Required context**: None.
- **Input**: None.
- **Result**: Resets the extension's first-run state and triggers the workspace discovery process again, showing the welcome notification if a Python Behave project is detected.
- **Default shortcut**: None.

---

## Reset Contextual Recommendations
- **Identifier**: `gherkinPowerTools.resetContextualRecommendations`
- **Where it appears**: Command Palette.
- **Required context**: None.
- **Input**: None.
- **Result**: Resets dismissed state for contextual discovery features (e.g. project setup hints), allowing them to prompt you again in this workspace.
- **Default shortcut**: None.

---

## Demo Quick Fix (Internal)
- **Identifier**: `gherkinPowerTools.demoQuickFix`
- **Where it appears**: VS Code Walkthrough.
- **Required context**: None.
- **Input**: None.
- **Result**: Opens a sample feature file to demonstrate the Quick Fix Code Actions.
- **Default shortcut**: None.

---

## Demo Go to Definition (Internal)
- **Identifier**: `gherkinPowerTools.demoGoToDefinition`
- **Where it appears**: VS Code Walkthrough.
- **Required context**: None.
- **Input**: None.
- **Result**: Opens a sample feature file to demonstrate the Go To Definition feature.
- **Default shortcut**: None.

---


## Edit Behave args & Run
- **Identifier**: `gherkinPowerTools.testExplorerEditAndRun`
- **Where it appears**: Testing Sidebar (Title Menu).
- **Required context**: Active Testing view.
- **Input**: Opens an interactive dialog to enter Behave arguments (e.g., `--tags=@wip`).
- **Result**: Prompts whether to save the arguments permanently to the workspace settings (`gherkinPowerTools.behave.additionalArguments`) or use them once for the current session. Then executes the selected tests.
- **Related setting**: `gherkinPowerTools.behave.additionalArguments`
- **Default shortcut**: None.

---

## Extract Step
- **Identifier**: `gherkinPowerTools.refactor.extractStep`
- **Where it appears**: Code Action / Quick Fix menu.
- **Required context**: Multiple selected step lines in a `.feature` file.
- **Input**: Prompts for a new step name, and then presents a file picker to select the target Python step file.
- **Result**: Extracts the selected steps into a new Python step definition, replacing them in the original feature file.
- **Default shortcut**: None (Invoked via <kbd>Ctrl+.</kbd> or <kbd>Cmd+.</kbd> on macOS).

---

## Rename Step
- **Identifier**: `gherkinPowerTools.refactor.renameStep`
- **Where it appears**: Gherkin PowerTools Submenu (Dynamic, only when cursor is on a valid Gherkin step).
- **Required context**: A Gherkin step in a `.feature` file or a Python step decorator string.
- **Input**: Prompts for the new step name.
- **Result**: Renames the step text and updates all usages across `.feature` files and the Python decorator.
- **Default shortcut**: VS Code Native Rename (<kbd>F2</kbd> by default).



## Test Execution Commands (CodeLens / Tree Nodes)

These commands typically appear as CodeLens buttons above Scenarios/Features, or are invoked internally by the Test Explorer.

### Run Feature
- **Identifier**: `gherkinPowerTools.runFeature`
- **Result**: Executes the entire `.feature` file using Python Behave.

### Run Scenario
- **Identifier**: `gherkinPowerTools.runScenario`
- **Result**: Executes a single Scenario or Scenario Outline.

### Debug Feature
- **Identifier**: `gherkinPowerTools.debugFeature`
- **Result**: Launches the Python debugger, attaching it to the Behave execution of the `.feature` file. Allows stopping at breakpoints in step definitions.

### Debug Scenario
- **Identifier**: `gherkinPowerTools.debugScenario`
- **Result**: Launches the Python debugger for a single Scenario or Scenario Outline.

### Edit Feature / Edit Scenario
- **Identifiers**: `gherkinPowerTools.runFeatureWithArgs` / `gherkinPowerTools.runScenarioWithArgs`
- **Result**: Interactively prompts for custom CLI arguments before running or debugging the target test.
