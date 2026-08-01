# Python Behave Integration

Gherkin PowerTools provides deep, native integration for **Python Behave** projects.

*Note: The features on this page require Python Behave. If you are using Cucumber.js, SpecFlow, or other frameworks, these specific features will not activate.*

---

## Workspace Discovery & Project Detection

Gherkin PowerTools automatically scans your workspace to discover Python step definition files.

It does this through a lazy-initialized background indexer that parses your `*.py` files looking for Behave decorators (`@given`, `@when`, `@then`, `@step`). This happens automatically within a few seconds of opening your project.

### Supported Project Structures
By default, the extension searches for Python steps in:
- `**/steps/**/*.py`
- `**/features/steps/**/*.py`

Virtual environments (`node_modules`, `.venv`, `venv`, `env`) are **excluded** by default to prevent false matches and performance issues.

### Custom Step Paths
If your project uses a custom directory structure (e.g., a monorepo with `shared_steps/`), you can easily add those paths in your configuration:

```json
"gherkinPowerTools.behave.stepGlobs": [
    "**/steps/**/*.py",
    "**/features/steps/**/*.py",
    "**/shared_steps/**/*.py"
]
```
Changes take effect immediately—no window reload required! See [Configuration](configuration.md#behave-discovery-execution-settings) for details.

---

## Step Autocomplete (IntelliSense)

As you type in a `.feature` file, the extension offers context-aware autocompletion from your indexed Python steps.

It natively understands the state of your scenario. A `@when` step will only be suggested if you type `When` or a continuation keyword (`And`, `But`) that resolves semantically to a `When`.

### Smart Context-Aware Ranking
Suggestions are not simply sorted alphabetically. Gherkin PowerTools uses an intelligent, deterministic ranking algorithm to prioritize the steps you are most likely to need:
- **Recent Usage**: Steps you have recently accepted are boosted via an internal LRU (Least Recently Used) cache.
- **Tag Affinity**: The background indexer tracks which steps are frequently used alongside specific tags. If you are inside a `@ui` feature, UI-related steps will float to the top.
- **Feature Context**: Steps heavily used in the current `.feature` file or neighboring scenarios are ranked higher.
- **Semantic Matching**: Partial matches against the Python definition receive a score boost.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/completion.gif" alt="IntelliSense - type-ahead suggestions from your Python step library" width="600" />
</div>

### Scenario Outline Parameters
If you are inside a `Scenario Outline` table, typing `<` inside a step will automatically prompt you with the column headers from your `Examples:` table.

---

## Go to Definition

You can jump from any Gherkin step directly to its implementing Python decorator.

- **macOS:** <kbd>Cmd+Click</kbd>
- **Windows/Linux:** <kbd>Ctrl+Click</kbd>
- Or place your cursor on the step and press **`F12`**.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/goto-definition.gif" alt="Go to Definition - jump from Gherkin step to Python decorator" width="600" />
</div>

If a step is ambiguous (matches multiple Python definitions), a Peek View will open allowing you to select the correct one.

---

## Hover Information

Hovering over any valid step in your `.feature` file reveals its Python implementation details in a tooltip, including:
- The exact Python file and line number.
- The Python function signature.
- The Python docstring (if provided).

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-step.gif" alt="Hover on a step - shows the Python function signature and docstring" width="600" />
</div>

---

## Diagnostics: Undefined & Ambiguous Steps

The Linter actively validates your steps against the Python backend:

- **Undefined Steps:** If a step has no matching Python decorator, it is underlined with a warning.
- **Ambiguous Steps:** If a step matches multiple regular expressions in your Python files (e.g., overlapping wildcards), it is flagged so you can tighten your patterns.

---

## Step Definition Analysis

Gherkin PowerTools includes a comprehensive analyzer that inspects your entire workspace to ensure your Python step definitions are healthy and maintainable.

**Proactive Indexing**: When you run the analysis, the extension proactively scans and parses all `.feature` and `.py` files across your entire workspace, ensuring 100% accuracy even if you haven't opened those files in your current session.

You can generate this report by running the **Gherkin PowerTools: Show Gherkin Health** command from the Command Palette. It opens an interactive **Dashboard Webview** displaying:

- **Unused Steps:** Detects step definitions that are never referenced by any parsed `.feature` file in your workspace. Unused steps are grouped by their parent Python file for easy bulk-cleaning.
- **Duplicated Implementations:** Finds identical step definitions (same matcher type and regex pattern) across different files which will cause a runtime failure in Behave.
- **Ambiguous Step Usages:** Identifies specific steps in your feature files that match multiple definitions, helping you pinpoint exactly where Behave will fail.
- **Suspicious Similarities:** Highlights step definitions with very similar regex patterns (>85% similarity). These are often accidental duplicates with minor typos or overly generic patterns that could lead to ambiguity.

**Interactive Navigation**: Every file reference in the dashboard is an interactive link. Click any file path to instantly open that file in VS Code at the exact line number.

---

## Step Refactoring

Gherkin PowerTools provides step refactoring operations accessible from the editor. All refactoring operations use VS Code's `WorkspaceEdit` API, which allows you to preview and undo all changes.

### Rename Step

The `Rename Symbol` action (`F2` / `Cmd+Shift+R` on macOS) on a Gherkin step or Python step decorator renames the step text and updates all usages across `.feature` files.

1. Place your cursor on a step in a `.feature` file, or the string inside `@step(...)` in Python.
2. Press **`F2`** (or **`Cmd+Shift+R`** on macOS) or right-click and select **Rename Symbol**.
3. Enter the new step name.
4. The extension updates the Python decorator **and** all matching Gherkin steps in the workspace.

> **Note:** Rename operates via the Workspace Graph. The step must be indexed (i.e., the Python file must be within your configured `stepGlobs`) for the rename to locate all usages.

### Extract Step

1. In a `.feature` file, select multiple Gherkin step lines.
2. Press **`Ctrl+.`** (**`Cmd+.`** on macOS) to open the Code Actions lightbulb.
3. Select **Extract Steps to new definition**.
4. Enter a name for the new step.
5. Choose the target Python step file from the list.

The extension inserts a Python stub decorated with the correct `@given`, `@when`, or `@then` keyword, inferred from the keywords present in your selection.

---


## Step Stub Generation

If you write a step in your `.feature` file that doesn't exist yet, Gherkin PowerTools can generate the Python code for you.

1. Write the undefined step.
2. Place your cursor on the underlined step and press <kbd>Ctrl+.</kbd> (<kbd>Cmd+.</kbd> on macOS).
3. Select **Generate Python Step Definition**.
4. The extension will automatically extract string and integer parameters into variables, create the correct `@given/@when/@then` decorator, and insert the stub into your most recently modified `steps.py` file.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif" alt="Quick Fix - generate a Python stub for an undefined step" width="600" />
</div>

---

## Known Limitations

- **Dynamic Python Expressions:** The extension's parser evaluates string literals in decorators (`@given("I login")`). It cannot statically evaluate dynamic Python variables or function calls at runtime (`@given(MY_CONSTANT)`). These dynamic steps will not appear in autocomplete or Go to Definition.
- **Parse Types:** Behave's custom `parse` types (e.g., `@given(u'I log in as {user:User}')`) are indexed, but autocomplete strictly uses the raw pattern.
