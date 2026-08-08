# ▶️ Execute Tests from the Test Explorer

Gherkin PowerTools integrates natively with the **VS Code Testing sidebar** — no terminal commands needed.

Open the Testing sidebar with `Cmd+Shift+T` (macOS) or `Ctrl+Shift+T` (Windows/Linux), or click the flask icon in the Activity Bar.

---

## Live Feature Tree

The sidebar shows a **real-time, structured tree** of your entire workspace:

```text
📁 features/
  📄 login.feature
    ├─ ▶ Scenario: Successful login
    ├─ ▶ Scenario: Failed login — wrong password
    └─ ▶ Scenario Outline: Login with roles
         ├─ ▶ Row: admin / read-write
         └─ ▶ Row: editor / read-only
```

The tree updates **as you type** (with a 400 ms debounce) — no save required. Add a new scenario and it appears in the sidebar instantly.

---

## Running Tests

Click **▶** next to any item to run it:

- **Feature file** — runs the entire file with `behave <path>`
- **Scenario** — runs only that scenario by line number: `behave <path>:<line>`
- **Example row** — runs only that specific parameterized case

Live output streams to the integrated **Terminal** panel. After completion, each item receives a **pass ✅** or **fail ❌** badge.

---

## Debugging Tests

Click **🐞** next to any item to launch a full VS Code debug session:

- Behave runs under **`debugpy`** — the official Python debug adapter
- Set a breakpoint in any Python step definition file and execution pauses there
- VS Code automatically switches to the **Debug Console** where Behave output streams in real-time
- Inspect **variables**, **call stack**, and use the **Debug Console** to evaluate expressions
- The spinner clears automatically when the session ends
- **Test Results are not modified** — your previous ✅ / ❌ history is preserved intact after debugging

> 💡 **Tip:** Custom arguments set via **✏️ Edit Args** apply equally to both `▶ Run` and `🐞 Debug` modes.

---

## Custom Arguments (Edit Mode)

Click **✏️** to open the **Edit Args** dialog before running:

- Enter extra Behave arguments (e.g. `--tags=@wip`, `-D env=staging`)
- Choose **Save to Workspace** to persist them in `settings.json`, or **Keep for Session** to apply them only to the current VS Code session
- Saved args are applied automatically to every subsequent `▶ Run` **and** `🐞 Debug` execution until explicitly cleared

---

**Zero-Config Environment Discovery:**

By default, the extension integrates securely with the **Microsoft Python extension** to detect your active virtual environment (whether it's Poetry, Pipenv, venv, or Conda) and executes Behave within it automatically. You do not need to configure anything if your Python environment is correctly selected in VS Code.

If you need to override the execution engine entirely (e.g., wrapping Behave inside a docker command), you can configure the base executable securely for your project:

```json
"gherkinPowerTools.behave.execution": {
    "executable": "docker-compose",
    "arguments": ["run", "--rm", "test-runner", "behave"]
}
```

If you need a strictly local machine-specific override (e.g., an absolute path to a Python interpreter or virtual environment), configure `localExecutable` in your **User Settings**:

```json
"gherkinPowerTools.behave.localExecutable": "/home/user/.venv/bin/behave"
```
