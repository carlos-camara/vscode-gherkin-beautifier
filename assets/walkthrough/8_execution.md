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
- Inspect **variables**, **call stack**, and use the **Debug Console** to evaluate expressions
- The spinner clears automatically when the session ends

---

## Custom Arguments (Edit Mode)

Click **✏️** to open the **Edit Args** dialog before running:

- Enter extra Behave arguments (e.g. `--tags=@wip`, `-D env=staging`)
- Choose **Save to Workspace** to persist them in `settings.json`, or **Keep for Session** to apply them only to the current VS Code session
- Saved args are applied automatically to every subsequent run until explicitly cleared

---

**Custom Behave command:**

If you use `pipenv`, `poetry`, or a virtual environment, configure the base command:

```json
"gherkinPowerTools.behave.command": "pipenv run behave"
```
