# Getting Started

> Get up and running in under 60 seconds. Gherkin PowerTools requires **no configuration** to start formatting and linting your Gherkin files.

---

## 1. Installation

The fastest way to install is via the VS Code Marketplace:

1. Open Visual Studio Code.
2. Open the Extensions panel: `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS).
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
</div>

---

## 5. Python Behave Setup (Optional)

If you are using Python Behave, Gherkin PowerTools provides advanced step generation, navigation, and Test Explorer integration.

On first run in a Python workspace, the **Onboarding Engine** automatically detects your `steps/` directory. If it needs a non-standard configuration, you will see a notification allowing you to 1-click configure your `stepGlobs`.

To generate your first Python step, write an undefined step in your `.feature` file, press <kbd>Ctrl+.</kbd>, and select **Generate Python Step Definition**.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif" alt="Quick Fix - generate a Python stub for an undefined step" width="600" height="340" />
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

## Next Steps

Explore the full capabilities:
- [Gherkin Editing](gherkin_editing.md) (Formatting & Linting)
- [Python Behave](python_behave.md) (Navigation & Generation)
- [Run and Debug](run_and_debug.md) (Test Explorer)
- [Configuration Reference](configuration.md)
