# Run and Debug (Test Explorer)

Gherkin PowerTools integrates directly with the native VS Code **Testing** sidebar to let you run and debug your Behave scenarios without ever touching the terminal.

---

## Test Discovery

Open the Testing sidebar by clicking the flask icon in the Activity Bar, or press <kbd>Ctrl+Shift+T</kbd> (<kbd>Cmd+Shift+T</kbd> on macOS).

The Test Explorer populates a live tree of your workspace:
- **Feature Nodes**
- **Rule Nodes**
- **Scenario Nodes**
- **Scenario Outline Example Rows** (Allows you to run a single row of data from a table!)

The tree updates automatically as you type in your `.feature` files (debounced by 400ms). You do not need to save the file to see new tests appear.

---

## Running Scenarios

You can run your tests at any level of granularity:

- **Run Workspace:** Click the Play button at the top of the Testing view to run all feature files.
- **Run Feature:** Click the Play button next to a specific `.feature` file.
- **Run Scenario:** Click the Play button next to a single Scenario.
- **Run Example Row:** Click the Play button next to a single row inside a Scenario Outline.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/run-demo.gif" alt="Run a Behave scenario from Test Explorer" width="600" />
</div>

### Console Output & Failure Reporting
When you execute a test, the VS Code **Test Results** panel will display Behave's live standard output and standard error. 
If a test fails, the node in the tree will turn red, and the Test Results panel will show the exact failure stack trace and the step where it occurred.

### Cancellation
You can safely cancel a long-running execution by clicking the Stop button (Square icon) in the Test Explorer.

---

## Debugging

Gherkin PowerTools makes attaching the Python debugger to Behave trivial. 

*Note: You must have the official [Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python) installed to use the debugger.*

### How to Debug

1. Open your Python step definition file.
2. Click in the left margin to place a red **Breakpoint** inside the step you want to debug.
3. Open the Test Explorer.
4. Click the **Debug (Bug icon)** next to the Scenario or Feature you want to run.

The extension will launch Behave attached to `debugpy`. Execution will halt at your breakpoint, allowing you to inspect variables, step into functions, and evaluate expressions in the Debug Console.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/debug-demo.gif" alt="Debug a Behave scenario" width="600" />
</div>

### Debug vs Run Profiles
- The **Run** profile creates a test run and updates pass/fail badges in the UI.
- The **Debug** profile launches an isolated debug session. It intentionally does **not** overwrite your previous test history (green checkmarks remain intact).

---

## Customizing the Execution Environment

By default, the extension invokes the `behave` command.

If you are using Poetry, Pipenv, or a direct virtual environment, you can configure the base command in your settings:

```json
"gherkinPowerTools.behave.command": "poetry run behave"
```

You can also pass persistent arguments (like passing userdata to the environment):

```json
"gherkinPowerTools.behave.additionalArguments": [
    "-D", "env=staging",
    "--no-capture"
]
```

### Edit Arguments & Run
If you need to change arguments on the fly (e.g., adding `--tags=@wip` for a single run without modifying your settings), use the **Edit Behave args & Run** button at the top of the Test Explorer view.

---

## Troubleshooting Execution

- **"Behave command not found":** Ensure the virtual environment containing Behave is active, or update `gherkinPowerTools.behave.command` to point to the absolute path of your Behave executable (e.g., `.venv/bin/behave`).
- **Tests run but show no output:** Ensure you aren't passing arguments that suppress output, or add `--no-capture` to `additionalArguments` if you need to see `print()` statements.
- **Breakpoints not hitting:** Ensure you are clicking the "Debug" icon (bug), not the "Run" icon (play). Confirm your Python extension is active.
