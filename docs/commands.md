# Commands Reference

Gherkin PowerTools contributes several commands to help you format, execute, and analyze your BDD projects.

## Central Command Center

### `gherkinPowerTools.commandCenter`
* **Title:** Gherkin PowerTools: Command Center
* **Description:** Opens a unified interactive QuickPick menu to access all extension capabilities (formatting, execution, debugging, step navigation, and diagnostics) from a single place.
* **Access:** Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

## Core Features

### `gherkinPowerTools.format`
* **Title:** Format Gherkin Document
* **Description:** Formats the currently active `.feature` file according to your configured formatting rules.
* **Access:** Command Palette, or standard format shortcut (`Shift+Alt+F` / `⇧⌥F`).

### `gherkinPowerTools.showStatistics`
* **Title:** Show Project Statistics
* **Description:** Opens a Webview showing rich analytics (tag usage, scenario complexity, etc.) across your entire Gherkin workspace.
* **Access:** Command Palette, or the Editor Title menu.

### `gherkinPowerTools.diagnoseWorkspace`
* **Title:** Diagnose Workspace
* **Description:** Scans the workspace and outputs internal diagnostics about Python step discovery and caching. Useful for troubleshooting.
* **Access:** Command Palette.

## Test Explorer & Execution (Behave Only)

These commands are primarily driven through the Test Explorer UI, but can be invoked manually or bound to keyboard shortcuts.

### `gherkinPowerTools.runFeature`
* **Title:** Run Feature
* **Description:** Executes all scenarios in the active feature file using Python Behave.
* **Access:** Test Explorer, Editor Title menu.

### `gherkinPowerTools.runScenario`
* **Title:** Run Scenario
* **Description:** Executes the specific scenario under the cursor.
* **Access:** Test Explorer, CodeLens, Editor context menu.

### `gherkinPowerTools.runFeatureWithArgs`
* **Title:** Edit Feature...
* **Description:** Prompts for additional Behave CLI arguments before executing the active feature file.
* **Access:** Test Explorer context menu.

### `gherkinPowerTools.runScenarioWithArgs`
* **Title:** Edit Scenario...
* **Description:** Prompts for additional Behave CLI arguments before executing the selected scenario.
* **Access:** Test Explorer context menu.

### `gherkinPowerTools.debugFeature`
* **Title:** Debug Feature
* **Description:** Launches the active feature file using the Python debugger, stopping at any set breakpoints in your step definitions.
* **Access:** Test Explorer.

### `gherkinPowerTools.debugScenario`
* **Title:** Debug Scenario
* **Description:** Launches the specific scenario under the cursor using the Python debugger.
* **Access:** Test Explorer, CodeLens.

### `gherkinPowerTools.testExplorerEditAndRun`
* **Title:** Edit Behave args & Run
* **Description:** Same as run with args, available directly as an inline action in the Test Explorer nodes.
* **Access:** Test Explorer inline actions.

*(Note: Internal commands such as `gherkinPowerTools.internal.recordCompletion` are omitted as they are triggered automatically by extension logic and are not meant for manual invocation).*
