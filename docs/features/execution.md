# Behave Execution

Gherkin PowerTools allows you to execute your Behave tests directly from the editor without switching to the terminal.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/run-debug.gif" alt="Execute Scenarios via CodeLens" width="600" />
</div>

## Run Feature, Scenario, and Examples CodeLens

Above every `Feature`, `Scenario`, and `Scenario Outline` in your `.feature` files, you will see three CodeLens buttons:
- `▶ Run Feature` (or Scenario)
- `🐞 Debug`
- `✎ Edit`

Additionally, inside `Examples` tables, **every single data row** will display minimal, non-intrusive icons perfectly aligned to the left of the table element:
- `▶` (Run Example)
- `🐞` (Debug Example)

This allows you to execute or debug a single set of parameters from an Examples table without having to run the entire Scenario Outline!

> **Robust CodeLens Engine**: The extension's CodeLens provider uses a resilient, dialect-aware text scanner
> rather than relying on a strict AST parser. This guarantees that **all valid scenarios and examples will always
> display execution buttons**, even if there are severe syntax errors elsewhere in the file. CodeLenses fully
> support files identified with either the `feature` or `gherkin` VS Code language IDs.

### `▶ Run`

Clicking the **Run** button will:
1. Verify if the active Python interpreter is configured in your workspace. The extension **dynamically prioritizes your active `ms-python.python` environment**, ensuring absolute reliability when launching tests. If not available, it falls back to the configured `command`.
2. Construct the execution task securely using native **VS Code Tasks and array-based `ProcessExecution` APIs**. This completely eliminates the use of raw shells, guaranteeing that malicious or complex file paths (e.g. paths with spaces, quotes, or special characters) execute securely without shell injection vulnerabilities.
3. Execute the specific feature or scenario exactly where you clicked within a VS Code Background Task.

> **Note:** When running a scenario, the extension passes the exact line number of the scenario to Behave as an argument vector (e.g. `["features/login.feature:12"]`), ensuring that only that scenario runs.

### `✎ Edit` (Interactive Arguments)

Sometimes you want to pass extra flags to Behave, such as `--tags=@wip` or `--no-capture`.

Clicking the **Edit** button will:
1. Open an input box pre-filled with the exact command the extension is about to run.
2. Allow you to manually add parameters anywhere in the string.
3. Prompt you with a choice on how to save these arguments:
   - **Save to Workspace**: Parses your custom arguments and saves them permanently in your `.vscode/settings.json` under `gherkinPowerTools.behave.additionalArguments`. The extension intelligently targets the active **Workspace Folder**, ensuring that this setting survives and applies correctly inside **DevContainers** or multi-root workspaces.
   - **Just for this session**: Saves your customized arguments in volatile memory. They will be applied to subsequent executions but will be wiped when you restart the editor.

### `🐞 Debug`

Clicking the **Debug** button allows you to visually debug Python step definitions for the specific scenario.

When you click **Debug**:
1. The extension constructs a temporary debugging configuration for Behave securely using VS Code's launch APIs without intermediate shell commands.
2. It launches Behave using the official VS Code Python debugger (`ms-python.python`).
3. Execution pauses at any breakpoints you have placed in your Python step definitions, allowing you to inspect variables and step through code.

> **Important:** The debug button requires the **Python extension** (`ms-python.python`) to be installed in VS Code. It uses your workspace's configured Python interpreter and correctly handles any arguments defined in `additionalArguments` or via `Edit`.

#### Debugging Limitations

- **Scenario Outlines**: Debugging specific examples within a `Scenario Outline` using the line number relies on Behave's name-matching fallback behavior if line number resolution is disabled in Behave or if the debugger strips the line number.
  Due to Behave's runner logic, if you have multiple scenarios with the exact same name across different feature files (or identical examples), the debugger might execute all matching scenarios instead of just the one selected.
  To avoid this, ensure your scenarios have unique names.
- **Rule Backgrounds**: If the scenario is inside a `Rule`, Behave's execution engine might exhibit similar grouping behaviors when launched via a debug adapter.

---

## Test Explorer Integration

Gherkin PowerTools registers a native **VS Code Test Controller** (`GherkinTestController`) that populates the built-in **Testing** sidebar panel with a live tree of your `.feature` files.

The tree is structured as:

```
📄 login.feature
 └─ Feature: User Authentication
     ├─ Scenario: Login with valid credentials
     └─ Scenario Outline: Login with multiple roles
         ├─ Example: role=admin, status=200
         └─ Example: role=guest, status=403
```

Each node can be run or debugged directly from the Testing panel using the `▶ Run` and `🐞 Debug` run profiles.

### Real-Time Tree Updates

The feature tree updates **as you type** in a `.feature` file, without needing to save first.

The controller listens to `vscode.workspace.onDidChangeTextDocument` and re-parses the in-memory buffer with a **400 ms debounce**. This means:

- New scenarios appear in the tree within ~400 ms of being typed.
- Renamed scenarios refresh their label without a file save.
- Deleted scenarios are removed from the tree instantly.

The `FileSystemWatcher` still handles file creation and deletion on disk (e.g., when files are created externally or by scripts).

### Debug Session State Tracking

When you run a scenario in **debug mode** from the Testing panel, the tree correctly reflects the running/passed/failed state of the item using VS Code's native Test Run API.

Internally, the controller waits for the appropriate completion event depending on the execution mode:

| Mode | VS Code event waited | Resolves when |
|------|----------------------|---------------|
| `▶ Run` | `onDidEndTaskProcess` | The Behave background task exits |
| `🐞 Debug` | `onDidTerminateDebugSession` | The debug session is terminated |

> **Note:** The two events are dispatched by completely different VS Code subsystems. Using `onDidEndTaskProcess` for a debug session would cause the spinner to remain active for up to 5 minutes (the safety timeout). The controller uses `waitForDebugEnd()` for debug runs to clear the state immediately.

---

## Configuration

You can customize the execution behavior using the following settings:

### `gherkinPowerTools.behave.command`
The base command used to run Behave. If you use a virtual environment, `pipenv`, or `poetry`, you can change this to suit your project (e.g., `poetry run behave` or `pipenv run behave`).

*Note: This setting is only used if the Python extension (`ms-python.python`) is not active or if a custom interpreter is not detected.*
* **Type:** `string`
* **Default:** `"behave"`

### `gherkinPowerTools.behave.additionalArguments`
If you want to pass extra flags to Behave permanently across all sessions (like `--format progress`), you can add them to this array.
* **Type:** `array` of `string`
* **Default:** `[]`
* **Example:** `["--no-capture", "--tags", "@wip"]`

---

**Example `.gherkin-powertoolsrc.json` Configuration:**

```json
{
    "behave": {
        "command": "poetry run behave",
        "additionalArguments": ["--no-capture"]
    }
}
```
