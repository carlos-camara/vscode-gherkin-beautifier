# Python Behave Integration

Gherkin PowerTools provides deep, native integration for **Python Behave** projects.

*Note: The features on this page require Python Behave. If you are using Cucumber.js, SpecFlow, or other frameworks, these specific features will not activate.*

---

## Workspace Discovery & Project Detection

Gherkin PowerTools automatically scans your workspace to discover Python step definition files.

It does this through a lazy-initialized background indexer that parses your `*.py` files looking for Behave decorators (`@given`, `@when`, `@then`, `@step`). This happens automatically within a few seconds of opening your project.

### Zero-Config Virtual Environment Discovery
To prevent false matches and eliminate performance overhead from indexing irrelevant files, the extension implements **Zero-Config Virtual Environment Discovery**. It automatically detects and excludes local virtual environments (`node_modules`, `.venv`, `venv`, `env`, etc.) by default.

### Supported Project Structures
By default, the extension searches for Python steps in:
- `**/steps/**/*.py`
- `**/features/steps/**/*.py`

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

When navigating the Autocomplete suggestion list, the details panel (hover) will explicitly display:
- The underlying Python function name and its docstring.
- The **exact Regex** (or raw pattern) the parser generated.
- The **Source** file path where the definition is located.

### Smart Context-Aware Ranking
Suggestions are not simply sorted alphabetically or purely by popularity. Gherkin PowerTools uses a strict **5-tier Lexicographical Ranking model** to guarantee semantic relevance always outranks popularity:
- **Tier 1 (Text Compatibility)**: Exact text matches or token prefixes to what you've typed are strictly prioritized.
- **Tier 2 (Semantic Compatibility)**: Steps that precisely match your Gherkin keyword (`Given`/`When`/`Then`) are prioritized over generic `@step` definitions.
- **Tier 3 (Matcher Specificity)**: Punishes highly permissive or overly broad regex matchers.
- **Tier 4 (Context Affinity)**: Using the mathematically robust `WorkspaceGraph`, the extension checks which steps are used in your current `.feature` file or are frequently found alongside your scenario's tags (e.g., `@ui`).
- **Tier 5 (Learned Signals)**: Your recently accepted completions (LRU cache) and global workspace usage counts act as the final tiebreakers.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/completion.gif" alt="IntelliSense - type-ahead suggestions from your Python step library" width="600" height="340" />
</div>

### Scenario Outline Parameters
If you are inside a `Scenario Outline` table, typing `<` inside a step will automatically prompt you with the column headers from your `Examples:` table.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/outline-completion.gif" alt="Autocomplete suggesting Examples table column headers" width="600" height="340" />
</div>

---

## Go to Definition

You can jump from any Gherkin step directly to its implementing Python decorator.

- **macOS:** <kbd>Cmd+Click</kbd>
- **Windows/Linux:** <kbd>Ctrl+Click</kbd>
- Or place your cursor on the step and press **`F12`**.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/goto-definition.gif" alt="Go to Definition - jump from Gherkin step to Python decorator" width="600" height="340" />
</div>

If a step is ambiguous (matches multiple Python definitions), a Peek View will open allowing you to select the correct one.

---

## Hover Information

Hovering over any valid step in your `.feature` file reveals its Python implementation details in a tooltip, including:
- The exact Python file and line number.
- The Python function signature.
- The Python docstring (if provided).

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-step.gif" alt="Hover on a step - shows the Python function signature and docstring" width="600" height="340" />
</div>

---

## Impact Analysis (Blast Radius)

When modifying existing Python step definitions, it is critical to know how many scenarios will be affected. Gherkin PowerTools includes a real-time **Impact Analysis** engine.

A CodeLens appears directly above every step definition in your `.py` files showing its usage impact:
- **Impact: High** (Used in 20+ scenarios)
- **Impact: Medium** (Used in 5+ scenarios)
- **Impact: Low** (Used in 1 to 4 scenarios)
- **Impact: Unused** (Not referenced anywhere)

Clicking the CodeLens opens an interactive menu listing every specific scenario that uses this step. The QuickPick menu uses a simplified path display for better readability. Selecting a scenario instantly opens the `.feature` file and navigates directly to the exact step (rather than just the top of the scenario), allowing you to quickly prioritize your testing when refactoring.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/impact-analysis.gif" alt="Impact Analysis - Blast Radius CodeLens" width="600" height="340" />
</div>
*(Note: Impact Analysis can be disabled via the `gherkinPowerTools.impactAnalysis.enabled` setting if you prefer to reduce CodeLens noise).*

---

## Diagnostics: Undefined & Ambiguous Steps

The realtime Linter actively validates your steps against the Python backend:

- **Undefined Steps:** If a step has no matching Python decorator, it is underlined with an error (configurable via `gherkinPowerTools.rules`).
- **Ambiguous Steps:** If a step matches multiple regular expressions in your Python files (e.g., overlapping wildcards), it is flagged so you can tighten your patterns.
- **Semantic And/But Matching:** Steps using the `And` or `But` keywords inherit the semantic context of their preceding step (`Given`, `When`, or `Then`). This ensures precise pattern matching, preventing false positives for "Unused Steps" and accurately disambiguating steps that share the same regex but have different keyword decorators.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/recommendation-engine.gif" alt="Diagnostic warnings for ambiguous and undefined steps" width="600" height="340" />
</div>

---

## BDD Anti-pattern Detection

Gherkin PowerTools includes a comprehensive **BDD Anti-pattern Detection Engine** that inspects your entire workspace to ensure your `.feature` files and Python step definitions are healthy and maintainable.

**Proactive Indexing**: When you run the analysis, the extension proactively scans and parses all `.feature` and `.py` files across your entire workspace, ensuring 100% accuracy even if you haven't opened those files in your current session.

You can generate this report by running the **Gherkin PowerTools: Show Gherkin Health** command from the Command Palette. It opens an interactive **Dashboard Webview** displaying actionable Anti-patterns:

- **Unused Steps:** Detects step definitions that are never referenced by any parsed `.feature` file in your workspace, nor invoked programmatically via `context.execute_steps()` in other Python files. Unused steps are grouped by their parent Python file for easy bulk-cleaning.
- **Duplicated Implementations:** Finds identical step definitions (same matcher type, keyword, and regex pattern) across different files which will cause a runtime failure in Behave.
  Semantic analysis ensures identical patterns with different keywords (e.g. `@given` vs `@then`) are correctly allowed.
  The structural identity engine robustly handles patterns containing complex regular expressions, unicode characters, and colons without false positives.
- **Oversized Scenarios & Excessive Tags:** Flags overly complex features that degrade test maintainability.

**Interactive Navigation**: Every file reference in the dashboard is an interactive link. Click any file path to instantly open that file in VS Code at the exact line number.

---

## Step Refactoring

Gherkin PowerTools provides step refactoring operations accessible from the editor. All refactoring operations use VS Code's `WorkspaceEdit` API, which allows you to preview and undo all changes.

### Rename Step

<figure>
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/rename-step.gif" alt="Rename a Gherkin step across multiple feature files simultaneously" width="600" height="340" />
</figure>

The native VS Code `Rename Symbol` action (default <kbd>F2</kbd>) on a Gherkin step or Python step decorator renames the step text and updates all usages across `.feature` files.

1. Place your cursor on a step in a `.feature` file, or the string inside `@step(...)` in Python.
2. Press <kbd>F2</kbd> or right-click and select **Rename Symbol**.
3. Enter the new step name.
4. The extension updates the Python decorator **and** all matching Gherkin steps in the workspace.

> **Note:** Rename operates via the Workspace Graph. The step must be indexed (i.e., the Python file must be within your configured `stepGlobs`) for the rename to locate all usages.

### Extract Step

1. In a `.feature` file, select multiple Gherkin step lines.
2. Press <kbd>Ctrl+.</kbd> (<kbd>Cmd+.</kbd> on macOS) to open the Code Actions lightbulb.
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
4. The extension will automatically extract string and integer parameters into variables, create the correct `@given/@when/@then` decorator, and determine the safest destination for the stub:
   - **Workspace Aware Destination**: Instead of blindly generating files in `features/steps`, the engine inspects your `gherkinPowerTools.behave.stepGlobs` configuration to understand your specific project architecture.
   - **Intelligent Inference**: If there is a clear, standard destination (e.g. an existing step file next to your feature, or a single configured step directory), the engine will automatically select or create the correct `steps.py` file there.
   - **Missing Files**: If no matching Python files are found (or the project is empty), you will be prompted to create one first.
   - **Ambiguity Resolution**: If your configuration allows multiple valid destinations, a clean QuickPick menu will appear, ensuring you retain control over where code is generated.
   - **Auto-Save & Background Reactivity**: Upon generation, the target Python file is automatically saved. The extension instantly detects this file-system change in the background, rebuilds the internal step registry, and clears the original "Undefined Step" error squiggle in real-time.
   - **Safety First**: The generation logic prioritizes reading the in-memory, unsaved state of your open editors instead of the disk state. This strictly prevents concurrent file modification race conditions, guaranteeing your unsaved work is never accidentally overwritten when appending new steps.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif" alt="Quick Fix - generate a Python stub for an undefined step" width="600" height="340" />
</div>

---

## Known Limitations

- **Dynamic Python Expressions:** The extension's parser evaluates string literals in decorators (`@given("I login")`). It cannot statically evaluate dynamic Python variables or function calls at runtime (`@given(MY_CONSTANT)`). These dynamic steps will not appear in autocomplete or Go to Definition.
- **Parse Types:** Behave's custom `parse` types (e.g., `@given(u'I log in as {user:User}')`) are indexed, but autocomplete strictly uses the raw pattern.
