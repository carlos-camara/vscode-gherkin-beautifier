# Getting Started

> Get up and running in under 60 seconds. Gherkin PowerTools requires **no configuration** to start formatting and linting your Gherkin files.

---

## 1. Installation

The fastest way to install is via the VS Code Marketplace:

1. Open Visual Studio Code.
2. Open the Extensions panel: <kbd>Ctrl+Shift+X</kbd> (<kbd>Cmd+Shift+X</kbd> on macOS).
3. Search for **"Gherkin PowerTools"**.
4. Click **Install**.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/install.gif" alt="Installation from the VS Code Marketplace" width="600" height="340" />
</div>

---

## 2. Your First `.feature` File

Once installed, open any `.feature` file in your workspace. The extension activates automatically.

You immediately get:
- **Semantic Highlighting** for keywords, tags, and parameters.
- **Document Outline** in the explorer sidebar to navigate features and scenarios.

---

## 3. Formatting

Try out the AST-powered formatter. Mess up the alignment of an `Examples:` table, then format the document:

- **macOS:** <kbd>Shift+Option+F</kbd>
- **Windows / Linux:** <kbd>Shift+Alt+F</kbd>
- Or open the Command Palette and type **Format Document**.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/formatter.gif" alt="Formatter - full document alignment" width="600" height="340" />
</div>

---

## 4. Diagnostics & Quick Fixes

Write an invalid keyword, or leave out a colon `:` after `Scenario`. The real-time linter will underline the error.
Place your cursor on the underlined text and press <kbd>Ctrl+.</kbd> (<kbd>Cmd+.</kbd> on macOS) to apply a Quick Fix.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/linter.gif" alt="Linter - flags structural errors as you type" width="600" height="340" />
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/auto-corrections.gif" alt="Quick Fix - correct keyword typos with one keypress" width="600" height="340" />
</div>

---

## 5. Python Behave Setup (Optional)

If you are using Python Behave, Gherkin PowerTools provides advanced step generation, navigation, and Test Explorer integration.

On your first run in a Python workspace, the **First-Run Onboarding Experience** automatically detects if it is a Behave project. If detected, a welcome notification will appear, providing a quick summary of the features found and direct links to the Walkthrough and Project Health Dashboard.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/onboarding.gif" alt="First-Run Onboarding Experience" width="600" height="340" />
</div>

To generate your first Python step, write an undefined step in your `.feature` file, press <kbd>Ctrl+.</kbd>, and select **Generate Python Step Definition**.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif" alt="Quick Fix - generate a Python stub for an undefined step" width="600" height="340" />
</div>

You can also view the exact **Blast Radius** of your step definitions via interactive CodeLenses that appear directly above your Python functions, showing exactly how many scenarios will be impacted by a change.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/impact-analysis.gif" alt="Impact Analysis - Blast Radius CodeLens" width="600" height="340" />
</div>

To run your tests, simply open the **Testing** panel in the VS Code sidebar. The extension automatically detects your Scenarios and lets you run, debug, and visually track them in real-time.

---

## 6. Command Center

If you ever forget a command or shortcut, press <kbd>Ctrl+Shift+P</kbd> (<kbd>Cmd+Shift+P</kbd> on macOS) and search for **Gherkin PowerTools: Command Center**.

This opens an interactive quick-pick menu that groups all the extension's capabilities (formatting, running tests, diagnosing workspace, viewing statistics) into one unified searchable list.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/command-center.gif" alt="Command Center" width="600" height="340" />
</div>

---

## 7. Command Line Interface (CLI)

Gherkin PowerTools includes a powerful CLI (`gherkin-pt`) that brings the Workspace Intelligence Engine directly to your terminal or CI/CD pipelines.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/cli.gif" alt="Command Line Interface execution" width="600" height="340" />
</div>

Run diagnostics, extract metrics, and enforce formatting headless:

```bash
npx gherkin-pt analyze
npx gherkin-pt format --check
```

---

## 8. Contextual Feature Discovery

To help you get the most out of Gherkin PowerTools without getting in your way, the extension includes a non-intrusive **Contextual Feature Discovery** engine.

As you work, the engine analyzes your actions locally (e.g., struggling with table alignment, or leaving a step undefined for a while) and surfaces lightweight contextual popups (like "Did you know you can auto-format this?" or "Would you like to generate this step?"). (Note: This is distinct from the static *BDD Anti-pattern Detection Engine* which runs globally via the Dashboard).

You can always dismiss these suggestions or click "Don't show again" to permanently silence a specific recommendation.

---

## Next Steps

Explore the full capabilities:
- [Gherkin Editing](gherkin_editing.md) (Formatting & Linting)
- [Python Behave](python_behave.md) (Navigation & Generation)
- [Run and Debug](run_and_debug.md) (Test Explorer)
- [Command Line Interface (CLI)](cli.md) (Headless Execution & CI/CD)
- [Configuration Reference](configuration.md)
