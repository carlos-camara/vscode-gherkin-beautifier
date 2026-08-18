# Troubleshooting

This guide addresses common problems organized by observable symptoms.

---

## First-Run Onboarding did not appear
**Symptom:** You installed the extension but you never saw the welcome notification for Python Behave projects.
**Likely Causes:** The workspace doesn't have any `.feature` files, it isn't recognized as a Python Behave project, or you dismissed the notification previously.
**Diagnostic Steps:** Ensure you have `.feature` files in your workspace.
**Resolution:** Run **Gherkin PowerTools: Replay Onboarding** from the Command Palette to reset the state and manually trigger the detection process.

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

## I see double squiggles for Undefined or Ambiguous Steps
**Symptom:** Your feature file displays two overlapping underlines (e.g., one yellow, one red) for the same undefined or ambiguous step.
**Likely Causes:** Both the realtime Linter and the BDD Anti-pattern Detection Engine are configured to report on the same file, but the filtering mechanism failed or configuration is conflicting.
**Diagnostic Steps:** Check if `"gherkinPowerTools.antiPatterns.enabled": true` is set. The Anti-pattern Diagnostics Manager is designed to automatically filter out `undefined-steps` and `ambiguous-steps` from visual editor diagnostics to prevent conflicts with the realtime Linter (which provides the Quick Fixes).
**Resolution:** This should be handled automatically by the extension. If you still see it, try reloading the VS Code window, or temporarily set the conflicting rule to `"off"` in `gherkinPowerTools.antiPatterns.rules`.

## Impact Analysis CodeLenses are not appearing
**Symptom:** You open a Python step definition file, but you do not see the CodeLenses displaying the number of affected scenarios.
**Likely Causes:** The feature is disabled in settings, or the `WorkspaceGraph` is still indexing the feature files.
**Diagnostic Steps:** Check if `"gherkinPowerTools.impactAnalysis.enabled": true` is set in your configuration. Wait for the workspace indexing to complete.
**Resolution:** Enable the setting and ensure your `.feature` files and Python files are correctly mapped in your `stepGlobs`.

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

## Test Execution is Blocked
**Symptom:** You attempt to run a test from the Test Explorer, but VS Code blocks the execution.
**Likely Causes:** The extension uses VS Code's Workspace Trust API to prevent arbitrary command execution. If your workspace is marked as "Untrusted" (Restricted Mode), test execution is disabled.
**Resolution:** Click the "Restricted Mode" banner in the bottom status bar and select "Trust Workspace & Install" to enable test execution.

## Run fails (Behave executable is not found)
**Symptom:** You click "Play" in the Test Explorer, but the test immediately fails with a "Command not found" or "behave is not recognized" error in the output.
**Likely Causes:** `behave` is not installed, or your virtual environment is not active in the shell that VS Code spawns.
**Resolution:**
If using a virtual environment manager like Poetry or Pipenv, update your configuration in `.gherkin-powertoolsrc.json` or `.vscode/settings.json`:
```json
"gherkinPowerTools.behave.execution": {
    "executable": "poetry",
    "arguments": ["run", "behave"]
}
```
If you need to point to a specific local Python virtual environment via an absolute path, configure the machine-specific override in your global User Settings to prevent committing absolute paths to your repository:
```json
"gherkinPowerTools.behave.localExecutable": "/absolute/path/to/.venv/bin/behave"
```

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

## Statistics history data is lost or corrupted
**Symptom:** The historical trend charts are missing data points or show errors.
**Likely Causes:** State corruption or an extreme refactoring drastically altering the codebase.
**Resolution:**
1. Run the **Clear History** command to purge corrupted records safely.
2. The dashboard will start generating a fresh baseline on the next run.

## Remote Development (WSL, SSH, Dev Containers, Codespaces)
**Symptom:** The extension cannot find Python, Behave, or local workspace paths when running inside a remote environment.
**Likely Causes:** Gherkin PowerTools correctly executes on the remote machine where the workspace is hosted (as a `workspace` extension). Absolute paths configured for a local OS (e.g., Windows `C:\...`) will fail when the extension evaluates them on the Linux remote host.
**Resolution:**
1. Ensure your `gherkinPowerTools.behave.localExecutable` or `python.defaultInterpreterPath` uses the path inside the remote environment.
2. Ensure you have installed the Behave dependencies on the remote host/container.
3. If using the CLI (`npx @carlos-camara/gherkin-pt`), ensure you run it from the **Integrated Terminal** in VS Code, which is connected to your remote environment, rather than your local OS terminal.

## Statistics are empty or incomplete
**Symptom:** The Project Statistics dashboard shows 0 features.
**Likely Causes:** The workspace indexer was interrupted, or you opened the dashboard immediately upon launching VS Code before the 2-second background scan completed.
**Resolution:** Wait a few seconds, then close and reopen the dashboard.

## Large workspace performance is poor
**Symptom:** VS Code feels slow when typing in `.feature` files.
**Likely Causes:** The extension is scanning too many files (e.g., inside `.venv` or `node_modules`), or parsing a massive file is bottlenecking the AST.
**Resolution:**
1. Ensure `gherkinPowerTools.behave.ignoreGlobs` correctly ignores all dependency directories.
2. Enable `gherkinPowerTools.diagnostics.metricsEnabled` and run the **Show Developer Metrics** command to identify if specific files have high parsing durations or poor cache hit ratios.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/metrics-snapshot.gif" alt="Output Channel showing AST Parser and Cache performance metrics" width="600" height="340" />
</div>

## Gherkin Health Dashboard is empty or incomplete
**Symptom:** You run "Show Gherkin Health" but the dashboard says "0 Total Step Defs" or misses files you know exist.
**Likely Causes:** Your `gherkinPowerTools.behave.stepGlobs` configuration does not cover the locations of all your steps.
**Resolution:** Ensure your Python step paths are correctly set in settings (`gherkinPowerTools.behave.stepGlobs`). The proactive indexer will automatically scan them upon running the command.

## Rename Step does not find all usages
**Symptom:** You invoke the native VS Code `Rename Symbol` command (e.g., <kbd>F2</kbd>) on a Gherkin step, rename it, but some `.feature` files still use the old step name.
**Likely Causes:** The affected `.feature` files were not yet indexed in the `WorkspaceGraph`.
**Diagnostic Steps:**
1. Ensure the Python step file containing the definition is within your configured `stepGlobs`.
2. Run **Gherkin PowerTools: Diagnose Workspace** and check the "Discovered Steps" and "Workspace Graph" sections.
**Resolution:** Verify `stepGlobs` covers all relevant step files, then retry the rename. The graph is rebuilt automatically when files are saved.

## Rename Step is not visible in the Context Menu
**Symptom:** You right-click in the editor, but "Rename Step" does not appear in the context menu.
**Likely Causes:** To reduce clutter, the "Rename Step" command dynamically appears only when your cursor is positioned directly on a valid step line.
**Resolution:** Ensure your text cursor is placed on a line starting with `Given`, `When`, `Then`, `And`, or `But`, then right-click again.

## Extract Step does not produce a Python stub
**Symptom:** You select multiple steps and invoke the Code Action, but no stub appears in the target file.
**Likely Causes:** The selection may not span multiple step lines, or no Python step files were found in the workspace.
**Diagnostic Steps:**
1. Ensure you have selected at least two step lines (the selection must include both start and end lines).
2. Confirm that at least one Python step file exists within your `stepGlobs`.
**Resolution:** If no Python files appear in the file picker, add the correct glob to `gherkinPowerTools.behave.stepGlobs`.

## Files are missed or falsely flagged as duplicates (macOS/Windows)
**Symptom:** When scanning large workspaces, some `.feature` or `.py` files are ignored, or Behave step definitions are falsely reported as duplicated.
**Likely Causes:** In earlier versions, case-insensitive file systems could cause path mismatches inside the internal graph.
**Resolution:** Ensure you are running version 1.8.2 or newer, which includes robust case-insensitive URI normalization for macOS and Windows.

## I accidentally dismissed a Contextual Recommendation
**Symptom:** You clicked "Don't show again" on a helpful popup (like the Formatting or Dashboard recommendation) and want it back.
**Likely Causes:** The extension saved your dismissal in the VS Code Global State.
**Resolution:** Currently, VS Code does not expose a UI to edit global state directly. You can reset all internal extension state (including dismissals) by running the **Developer: Reset Extension State** command from the VS Code Command Palette (note that this resets state for *all* extensions).

## Standalone CLI fails to resolve dependencies
**Symptom:** Running `npx @carlos-camara/gherkin-pt analyze` fails with a "Cannot find module '@cucumber/gherkin'" error.
**Likely Causes:** The CLI was installed globally or npm cached an outdated, non-scoped version of the CLI package.
**Resolution:** Ensure you are using the explicitly scoped package (`@carlos-camara/gherkin-pt`) and force a cache clear by running `npx --yes --clear-cache @carlos-camara/gherkin-pt`.

## How to Report a Bug
If none of these steps resolve your issue, please run **Gherkin PowerTools: Diagnose Workspace**, copy the output, and [Report an Issue on GitHub](https://github.com/carlos-camara/vscode-gherkin-powertools/issues).
