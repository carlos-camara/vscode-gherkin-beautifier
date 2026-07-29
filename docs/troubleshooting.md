# Troubleshooting

This guide addresses common problems organized by observable symptoms.

---

## Formatting does not run or `.feature` file is not detected
**Symptom:** You press <kbd>Shift+Alt+F</kbd> and nothing happens, or the extension doesn't seem to activate.
**Likely Causes:** The file is not recognized as a Gherkin document, or the formatter is disabled.
**Diagnostic Steps:**
1. Check the bottom right corner of VS Code. Does the language mode say "Feature"? If not, click it and select "Feature".
2. Check your settings for `"gherkinPowerTools.formatter.enabled": false`.
**Resolution:** Ensure the file extension is `.feature`. Remove the disabling setting.

## Python steps are not found (Go to Definition / Autocomplete fail)
**Symptom:** You use Python Behave, but steps show as "Undefined" in the Linter, and Go to Definition does not work.
**Likely Causes:** The extension is looking in the wrong directory, or your virtual environment is causing performance timeouts.
**Diagnostic Steps:**
1. Run **Gherkin PowerTools: Diagnose Workspace** from the Command Palette. Check the "Discovered Steps" count.
2. Verify where your Python steps actually live.
**Resolution:**
Update your settings to include your custom path:
```json
"gherkinPowerTools.behave.stepGlobs": [
    "**/my_custom_folder/steps/**/*.py"
]
```
Ensure virtual environments are excluded in `ignoreGlobs` to prevent the parser from scanning thousands of irrelevant files.

## Ambiguous steps are reported unexpectedly
**Symptom:** The linter flags a step as "Ambiguous" even though Behave runs it fine.
**Likely Causes:** You have multiple regular expressions in your Python decorators that match the exact same string (e.g., overlapping wildcards like `(.*)`).
**Resolution:** Tighten your regular expressions in Python to be mutually exclusive.

## Generated step location is wrong
**Symptom:** The Quick Fix generates a step, but places it in a file you didn't expect.
**Likely Causes:** The extension tries to append the new step to the most recently modified `.py` file within your `stepGlobs` paths. If you have no step files, it will create one based on standard conventions.
**Resolution:** Open the specific `steps.py` file you want to use, save it, and try generating the step again. The extension will pick up that file as the active target.

## Test Explorer is empty
**Symptom:** You open the Testing sidebar, but no feature files or scenarios appear.
**Likely Causes:** The extension hasn't finished indexing, or there are no valid `.feature` files in the workspace.
**Diagnostic Steps:**
Wait a few seconds for the lazy-initialization to complete. If it still doesn't appear, ensure your `.feature` files contain valid Gherkin syntax (at least a `Feature:` keyword).
**Resolution:** Fix any critical syntax errors in your Gherkin.

## Run fails (Behave executable is not found)
**Symptom:** You click "Play" in the Test Explorer, but the test immediately fails with a "Command not found" or "behave is not recognized" error in the output.
**Likely Causes:** `behave` is not installed, or your virtual environment is not active in the shell that VS Code spawns.
**Resolution:**
If using a virtual environment manager like Poetry or Pipenv, update your configuration:
```json
"gherkinPowerTools.behave.command": "poetry run behave"
```
Or use the absolute path to your virtual environment's executable: `".venv/bin/behave"`.

## Debugging does not stop at breakpoints
**Symptom:** You click the "Debug" icon, the test runs, but it ignores your red breakpoints.
**Likely Causes:** The Python extension is missing, or the debug session failed to attach to the `behave` process.
**Resolution:**
1. Ensure the official Microsoft Python extension is installed and active.
2. Ensure you clicked the **Debug (Bug icon)** in the Test Explorer, not the **Run (Play icon)**.

## Live Step Tracking animation is not visible
**Symptom:** The scenario runs in the Test Explorer, but the active step is not highlighted in the editor.
**Likely Causes:** The custom Formatter isn't emitting `step_start` events, or the file is not currently focused.
**Resolution:** Ensure your `behave` process has not overridden the custom JSON formatter, and verify that the `.feature` file you are running is currently open and active in the editor.

## Syntax Errors cascade into massive false-positives
**Symptom:** You missed a colon on a `Scenario`, and suddenly all steps below it have red underlines.
**Likely Causes:** This was a known limitation of the AST parser in older versions.
**Resolution:** Upgrade to version 1.7.9+. The linter now gracefully falls back to a text-based scanner to isolate severe structural errors from your valid steps.

## Statistics are empty or incomplete
**Symptom:** The Project Statistics dashboard shows 0 features.
**Likely Causes:** The workspace indexer was interrupted, or you opened the dashboard immediately upon launching VS Code before the 2-second background scan completed.
**Resolution:** Wait a few seconds, then close and reopen the dashboard.

## Large workspace performance is poor
**Symptom:** VS Code feels slow when typing in `.feature` files.
**Likely Causes:** The extension is scanning too many files (e.g., inside `.venv` or `node_modules`).
**Resolution:** Ensure `gherkinPowerTools.behave.ignoreGlobs` correctly ignores all dependency directories.

## How to Report a Bug
If none of these steps resolve your issue, please run **Gherkin PowerTools: Diagnose Workspace**, copy the output, and [Report an Issue on GitHub](https://github.com/carlos-camara/vscode-gherkin-powertools/issues).
