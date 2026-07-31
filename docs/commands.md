# Command Reference

Gherkin PowerTools contributes several commands to improve your workflow. All commands are prefixed with `Gherkin PowerTools:` in the Command Palette.

---

## Gherkin PowerTools: Command Center
- **Identifier**: `gherkinPowerTools.commandCenter`
- **Where it appears**: Command Palette.
- **Required context**: None.
- **Input**: None.
- **Result**: Opens a unified QuickPick menu giving access to formatting, statistics, running tests, debugging, and workspace diagnostics.
- **Default shortcut**: None.

---

## Format Gherkin Document
- **Identifier**: `gherkinPowerTools.format`
- **Where it appears**: Command Palette, Editor Context Menu (Right-click in `.feature` file).
- **Required context**: An active `.feature` file.
- **Input**: None.
- **Result**: Formats the active Gherkin document or the current selection according to your configuration profile.
- **Related setting**: `gherkinPowerTools.profile`, `gherkinPowerTools.indentation.steps`, etc.
- **Default shortcut**: Depends on VS Code's `editor.action.formatDocument` (e.g., <kbd>Shift+Alt+F</kbd>).

---

## Diagnose Workspace
- **Identifier**: `gherkinPowerTools.diagnoseWorkspace`
- **Where it appears**: Command Palette, Editor Context Menu.
- **Required context**: An active `.feature` file or workspace.
- **Input**: None.
- **Result**: Analyzes environment versions, workspace layout, discovered feature/step files, indexed definitions, Python extension status, and `.gherkin-powertoolsrc.json` validity. Generates an Output Channel report with a 1-click `Copy Sanitized Report` action.
- **Default shortcut**: None.

---

## Show Gherkin Health
- **Identifier**: `gherkinPowerTools.showStatistics`
- **Where it appears**: Command Palette, Editor Context Menu.
- **Required context**: An active `.feature` file.
- **Input**: None.
- **Result**: Parses all discovered feature files in the workspace and displays an interactive HTML dashboard containing project health, maintainability, tag impact, and complexity distribution.
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

## Edit Behave args & Run
- **Identifier**: `gherkinPowerTools.testExplorerEditAndRun`
- **Where it appears**: Testing Sidebar (Title Menu).
- **Required context**: Active Testing view.
- **Input**: Opens an interactive dialog to enter Behave arguments (e.g., `--tags=@wip`).
- **Result**: Prompts whether to save the arguments permanently to the workspace settings (`gherkinPowerTools.behave.additionalArguments`) or use them once for the current session. Then executes the selected tests.
- **Related setting**: `gherkinPowerTools.behave.additionalArguments`
- **Default shortcut**: None.

---

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

---

## Refactoring Commands

These commands assist with step-level refactoring operations in feature files and Python step definition files. They use VS Code `WorkspaceEdit` internally, so all changes are previewed and can be undone (`Ctrl+Z` / `Cmd+Z`).

### Extract Step
- **Identifier**: `gherkinPowerTools.refactor.extractStep`
- **Where it appears**: Editor lightbulb (💡) / Code Actions when multiple Gherkin steps are selected in a `.feature` file.
- **Required context**: An active `.feature` file with a multi-line selection.
- **Input**: Prompts for a new step name, then asks you to select the target Python step file.
- **Result**: Extracts the selected steps into a new Python step definition stub, using the appropriate `@given`/`@when`/`@then` decorator inferred from the step keywords in the selection.
- **Undo support**: Yes — via VS Code's standard undo stack (`Ctrl+Z` / `Cmd+Z`).
- **Default shortcut**: None (invoked via Code Actions or Command Palette).

### Move Step Definition
- **Identifier**: `gherkinPowerTools.refactor.moveStep`
- **Where it appears**: Command Palette.
- **Required context**: Cursor on a Python step decorator or a Gherkin step that has a definition.
- **Input**: None.
- **Result**: Placeholder command for moving a step definition to another Python file. Currently shows an information message; full implementation is in progress.
- **Default shortcut**: None.
