# 🚀 Behave Execution & Test Explorer

Stop switching between editor and terminal. Gherkin PowerTools gives you **two deeply integrated ways** to execute your Behave tests without leaving VS Code.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/run-debug.gif" alt="Execute Scenarios via CodeLens — One-click isolated execution and custom arguments" width="600" />
</div>

---

## Overview: Two Execution Surfaces

| Surface | Best For | Access |
|---------|----------|--------|
| **CodeLens** | Run or debug the scenario/feature you are currently editing | Inline buttons above each `Feature`, `Scenario`, and `Examples` row |
| **Test Explorer** | Run multiple tests, view pass/fail history, re-run failures | <kbd>⌘⇧T</kbd> (macOS) · <kbd>Ctrl+Shift+T</kbd> (Windows/Linux) |

Both surfaces share the same underlying execution engine and respect your configured interpreter, additional arguments, and environment.

---

## Part 1 — CodeLens Execution

### What You'll See in the Editor

Above every `Feature`, `Scenario`, and `Scenario Outline` in your `.feature` files, three inline action buttons appear:

```
Feature: User Authentication                           ▶ Run Feature  🐞 Debug  ✎ Edit
  Scenario: Login with valid credentials               ▶ Run Scenario  🐞 Debug  ✎ Edit
```

Inside `Examples` tables, each **individual data row** also gets its own minimal run/debug icons, perfectly aligned to the left of the table:

```
  Examples:
    | username | role  |
  ▶ 🐞 | admin    | super |
  ▶ 🐞 | guest    | read  |
```

This lets you execute or debug a single parameter set from a `Scenario Outline` without running the entire outline!

> [!NOTE]
> **Resilient CodeLens Engine:** The button provider uses a dialect-aware **text scanner** rather than a strict AST parser. This guarantees that Run/Debug buttons **always appear** even when there are severe syntax errors elsewhere in the file. Both `feature` and `gherkin` VS Code language IDs are fully supported.

---

### `▶ Run`

Executes the feature or scenario directly in a VS Code **Background Task** (visible in the Terminal panel → **Tasks**).

**How it works:**

1. **Interpreter resolution** — The extension queries the `ms-python.python` extension for the currently active Python interpreter. This guarantees that your virtual environment, `conda` environment, or DevContainer Python is used automatically. Falls back to the configured `behave.command` if the Python extension is not available.
2. **Secure argument construction** — Arguments are built as an **array** and passed to `vscode.ProcessExecution` directly — never via a raw shell string. This completely prevents shell injection attacks, even for file paths containing spaces, quotes, or special characters.
3. **Line-level targeting** — When running a scenario, the exact line number is appended to the path argument (e.g. `["./features/login.feature:12"]`), so Behave executes only that specific scenario.
4. **Duplicate guard** — If the same scenario is already running, the extension shows a warning instead of launching a duplicate process.

> [!IMPORTANT]
> A workspace folder **must be open** for execution to work safely. The extension uses `vscode.workspace.getWorkspaceFolder(uri)` to resolve relative paths. Opening a lone `.feature` file without a workspace will show an error.

---

### `🐞 Debug`

Launches a Behave debug session using the official VS Code Python debugger, allowing you to **set breakpoints in your Python step definitions** and pause execution mid-test.

**How it works:**

1. The extension dynamically constructs a `DebugConfiguration` of type `python` targeting Behave via `-m behave`.
2. It launches the session using `vscode.debug.startDebugging()` — no `launch.json` needed.
3. Your breakpoints in `steps/*.py` will pause execution, letting you inspect `context`, step arguments, and call stacks.

```python
@given('I login as "{role}"')
def step_login(context, role):
    # 🔴 Breakpoint here → execution pauses, you can inspect `role`
    context.client.login(role)
```

> [!IMPORTANT]
> The **Python extension** (`ms-python.python`) or **Debugpy extension** (`ms-python.debugpy`) must be installed. If neither is found, the extension will show an error with a direct link to the Marketplace install page.

#### Debugging Limitations

> [!WARNING]
> **Scenario Outlines:** When debugging an individual example row, Behave resolves the scenario by **line number**. If Behave's line-number resolution is disabled, it falls back to name matching — which may match multiple scenarios with the same name across files. Ensure your scenario names are unique.
>
> **Rule Backgrounds:** Scenarios nested inside a `Rule` block may trigger grouping behaviors in Behave's runner when launched via a debug adapter, potentially executing more scenarios than intended.

---

### `✎ Edit` — Interactive Arguments

Use the **Edit** button whenever you need to pass temporary flags to Behave without permanently changing your configuration — for example, to run only `@wip` scenarios or suppress output during a debugging session.

**Workflow:**

1. Click **`✎ Edit`** above any Feature or Scenario.
2. An input box opens, pre-filled with your current `additionalArguments` (or the last session's custom arguments).
3. Add, remove, or modify flags inline:

   ```
   --tags=@wip --no-capture --format progress
   ```

4. Press **Enter**. A prompt asks how to persist the changes:

| Choice | Behavior |
|--------|----------|
| **Save to Workspace** | Parses arguments and writes them permanently to `.vscode/settings.json` under `gherkinPowerTools.behave.additionalArguments`, scoped to the active Workspace Folder. Fully compatible with DevContainers and multi-root workspaces. |
| **Just for this session** | Stores arguments in volatile memory. Applied to all subsequent executions until VS Code is restarted or another Edit is confirmed. |

> [!TIP]
> **Session arguments survive multiple runs.** Once set, they remain active for all subsequent CodeLens clicks (Run and Debug) until you explicitly change them again via Edit. The input box will always be pre-filled with the latest session value.

---

## Part 2 — Test Explorer Integration

The **Test Explorer** (VS Code's built-in Testing sidebar) provides a structured, persistent view of your entire test suite — with run history, pass/fail badges, and the ability to re-run failed tests.

### How to Open

| Method | Action |
|--------|--------|
| **Keyboard** | <kbd>⌘⇧T</kbd> (macOS) · <kbd>Ctrl+Shift+T</kbd> (Windows/Linux) |
| **Activity Bar** | Click the **🧪 beaker icon** on the left sidebar |
| **Command Palette** | `View: Show Test Explorer` |

### Tree Structure

Gherkin PowerTools registers a native `GherkinTestController` that maps your workspace to the following hierarchy:

```
🗂 TESTING
└─ 📄 login.feature
    └─ 📁 Feature: User Authentication
        ├─ 📄 Scenario: Login with valid credentials
        └─ 📁 Scenario Outline: Login with multiple roles
            ├─ 📄 Example: username=admin, role=super
            └─ 📄 Example: username=guest, role=read
└─ 📄 checkout.feature
    └─ 📁 Feature: Shopping Cart
        ├─ 📄 Rule: Guest Checkout
        │   └─ 📄 Scenario: Guest adds item to cart
        └─ 📄 Scenario: Authenticated checkout
```

Every node in the tree is independently executable. Click `▶` next to any item to run only that file, feature, rule, scenario, or individual example row.

---

### Real-Time Tree Updates

The tree refreshes **as you type** — no save required.

The controller subscribes to `vscode.workspace.onDidChangeTextDocument` with a **400 ms debounce** per file URI. After 400 ms of inactivity, it re-parses the in-memory document buffer and updates the tree atomically.

| Action | Tree behavior |
|--------|--------------|
| Type a new `Scenario:` line | New node appears within ~400 ms |
| Rename a scenario | Label updates without saving |
| Delete a scenario block | Node disappears without saving |
| Create a new `.feature` file | Node added (via `FileSystemWatcher`) |
| Delete a `.feature` file on disk | Node removed (via `FileSystemWatcher`) |

> [!NOTE]
> The `FileSystemWatcher` (`**/*.feature`) handles **disk-level** events (external tools, git checkouts, file renames). The `onDidChangeTextDocument` listener handles **in-editor** changes. Both are active simultaneously and complement each other.

---

### Run Profiles

The Test Explorer exposes two run profiles selectable from the Testing panel toolbar:

| Profile | Icon | Behavior |
|---------|------|----------|
| **▶ Run** | ▶ | Executes selected tests as Behave Tasks. Shows pass ✅ / fail ❌ badges after completion. |
| **🐞 Debug** | 🐞 | Launches the Python debugger. Breakpoints in step files are respected. Badge shows after session terminates. |

### Test State Lifecycle

```
[Enqueued 🔄] → [Running ⏳] → [Passed ✅]
                             ↘ [Failed ❌]
                             ↘ [Cancelled —]
```

The controller uses VS Code's `TestRun` API to transition each item through these states. Internally, it waits for the correct platform event depending on the active profile:

| Profile | Event listened | Why |
|---------|----------------|-----|
| `▶ Run` | `onDidEndTaskProcess` | VS Code Tasks emit this event with an exit code when the process terminates. |
| `🐞 Debug` | `onDidTerminateDebugSession` | Debug sessions emit a separate event, never `onDidEndTaskProcess`. Using the wrong event would leave the spinner active for 5 minutes. |

> [!TIP]
> **Cancellation:** Press the **⏹ Stop** button in the Testing panel toolbar at any time. The extension respects VS Code's `CancellationToken` and immediately stops launching new scenarios. Any already-running Behave process must be stopped from the Terminal panel.

---

## Configuration Reference

> [!NOTE]
> All settings also accept project-level overrides via `.gherkin-powertoolsrc.json`. See the [Configuration documentation](../configuration.md) for the full precedence rules.

### `gherkinPowerTools.behave.command`

The base command used to invoke Behave.

- **Type:** `string`
- **Default:** `"behave"`
- **Used when:** The Python extension is not installed, or no active interpreter is detected.
- **Examples:**

  | Environment | Value |
  |-------------|-------|
  | System `behave` | `"behave"` *(default)* |
  | Poetry | `"poetry run behave"` |
  | Pipenv | `"pipenv run behave"` |
  | Custom script | `"./scripts/run_tests.sh"` |

### `gherkinPowerTools.behave.additionalArguments`

Extra flags appended to every Behave invocation.

- **Type:** `array` of `string`
- **Default:** `[]`
- **Examples:**

  ```json
  // Run only @smoke and suppress captured output
  "gherkinPowerTools.behave.additionalArguments": ["--tags=@smoke", "--no-capture"]

  // Use the progress formatter with verbose output
  "gherkinPowerTools.behave.additionalArguments": ["--format", "progress", "--verbose"]
  ```

> [!TIP]
> Use the `✎ Edit` CodeLens button to override these arguments **interactively at runtime** without editing `settings.json`. Session overrides are applied to all subsequent executions until VS Code restarts.

---

### Full Configuration Example

**`.gherkin-powertoolsrc.json`** (recommended for teams — commit to source control):

```json
{
    "behave": {
        "command": "poetry run behave",
        "additionalArguments": ["--no-capture", "--format", "progress"]
    }
}
```

**`.vscode/settings.json`** (personal workspace overrides):

```jsonc
{
  "gherkinPowerTools.behave.command": "poetry run behave",
  "gherkinPowerTools.behave.additionalArguments": ["--no-capture"],

  // Enable Format on Save while you're here
  "[feature]": {
    "editor.defaultFormatter": "carloscamara.vscode-gherkin-powertools",
    "editor.formatOnSave": true
  }
}
```

---

## Troubleshooting

### ❓ The Run button launches the wrong Python environment

**Cause:** The extension picks the interpreter from the `ms-python.python` extension. If you have multiple environments, the wrong one may be active.

**Fix:** Click the interpreter badge in the VS Code status bar (bottom right) and select the correct environment. The extension will pick it up automatically on the next run — no restart needed.

---

### ❓ "A workspace folder must be open to execute Behave tests safely"

**Cause:** You opened a single `.feature` file directly (without a folder in the workspace).

**Fix:** Use **File → Open Folder** to open your project root. The extension needs a workspace folder to resolve relative paths like `./features/login.feature:12`.

---

### ❓ The debug session launches but no breakpoints are hit

**Causes and fixes:**

| Cause | Fix |
|-------|-----|
| Python extension not installed | Install `ms-python.python` from the Marketplace |
| Wrong interpreter active | Switch interpreter via the status bar |
| `justMyCode: true` filtering out Behave internals | The extension sets `justMyCode: false` automatically |
| Breakpoint in an uncovered step | Verify that the step text matches a `@given`/`@when`/`@then` decorator |

---

### ❓ The test spinner doesn't clear after debugging

This is a known resolved issue. Ensure you are on the latest version of Gherkin PowerTools. In older versions, `onDidEndTaskProcess` was incorrectly used for debug sessions (which never fire that event). The fix introduces `onDidTerminateDebugSession` for debug runs.

---

### ❓ The Test Explorer tree is outdated / missing scenarios

**Possible causes:**

- The file is brand new and the extension hasn't discovered it yet → Open the file in the editor, or trigger `Reload Window`.
- A glob pattern is excluding your file → Run `Gherkin: Diagnose Workspace` from the Command Palette to inspect discovery.
- The file has severe syntax errors preventing parsing → Fix the Gherkin syntax and the tree will recover automatically.
