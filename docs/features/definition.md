# 🧭 Go To Definition

> Stop searching for step implementations manually. Gherkin PowerTools lets you **instantly jump** from any `.feature` step directly to its Python implementation — with a single keystroke.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/goto-definition.gif" alt="Go To Definition Demo" width="600" />
</div>

---

## ⚡ How to Trigger

| Method | Action |
|---|---|
| 🖱️ **Mouse** | `Cmd + Click` (macOS) · `Ctrl + Click` (Windows/Linux) on any step |
| ⌨️ **Keyboard** | Place cursor on a step → press **`F12`** |
| 📋 **Context Menu** | Right-click on a step → **Go to Definition** |

---

## 🧠 How It Works

Gherkin PowerTools uses a **lazy-initialized In-Memory Symbol Cache** that guarantees near-zero startup impact. When the extension activates, all language providers are registered immediately — but the heavy file I/O of scanning your Python step files is deferred ~2 seconds after startup.

On first use, any provider that needs the cache (`Go to Definition`, `Hover`, `IntelliSense`) calls `ensureInitialized()` — which returns the already-built index instantly or transparently awaits the background scan. In practice, the index is ready within seconds of opening any workspace.

When you request a definition (e.g., clicking `Given I login as "admin"`):

1. **Extract** — The semantic step text is extracted (`I login as "admin"`).
2. **Normalize** — Dynamic variables are stripped and the string is normalized.
3. **Lookup** — The Symbol Cache is queried via `getStepDefinitions()` using **Semantic Context-Aware Matching**, respecting strict `@given`/`@when`/`@then` decorators. `And` and `But` steps are resolved dynamically by scanning upwards through the scenario.
4. **Navigate** — VS Code opens the matching Python file at the exact decorator line.

> 💡 **Ambiguous Matches:** If a step matches multiple overlapping patterns, a native **Peek View** opens showing all possible definitions instead of arbitrarily picking one.

### 🔄 Reactive Watchers & Live Configuration Reloading

File system watchers automatically rebuild the index whenever you update `gherkinPowerTools.behave.stepGlobs` or your `.gherkin-powertoolsrc.json`. File events are debounced (100 ms) and filtered against `ignoreGlobs` — keeping your symbol index in sync without CPU overhead and **without requiring a VS Code restart**.

---

## ⚙️ Discovery Requirements

> ⚠️ **Discovery Requirements** — Your workspace must satisfy these conditions for Go to Definition to work correctly.
>
> - Step files are discovered via `gherkinPowerTools.behave.stepGlobs` (defaults: `**/steps/**/*.py`, `**/features/steps/**/*.py`). Custom directories can be added in Settings.
> - Virtual environments and external dependencies are automatically excluded via `gherkinPowerTools.behave.ignoreGlobs` (defaults: `node_modules`, `.venv`, `venv`, `env`).
> - Python functions must be decorated with `@given`, `@when`, `@then`, or `@step`.
> - **Automated Project Onboarding** detects step files in non-standard folders and offers a 1-click configuration update on first open.

---

## 🐍 Supported Python Decorators

Compatible with standard `behave` and `pytest-bdd` decorators. Supports complex regex, f-strings, raw strings, and multi-line formatting:

```python
# Standard exact match
@given('I login')
def step_login(context): ...

# Regex with named groups
@when(r'I click the button "(?P<button_name>[^"]*)"')
def step_click(context, button_name): ...

# F-string & bracket variables
@then(f'I should see the {dashboard}')
def step_see(context, dashboard): ...

# Unicode prefix & @step alias
@step(u'I perform an action')
def step_action(context): ...
```

---

## ⚠️ Known Limitations

Because Gherkin PowerTools evaluates step matches inside the Node.js (V8) environment, it uses a custom bounded tokenizer to extract Python patterns — without invoking a full Python parser.

### ✅ Fully Supported Patterns

The tokenizer accurately resolves step patterns defined as **string literals**, including:

| Pattern | Example |
|---|---|
| Single / double quotes | `'step text'`, `"step text"` |
| Triple-quoted strings | `'''...'''`, `"""..."""` |
| Prefixed strings | `r"..."`, `u"..."`, `f"..."`, `b"..."`, `rf"..."` |
| Escaped quotes | `"I type \"hello\""` |

### ❌ Unsupported Patterns

| Limitation | Detail |
|---|---|
| **Dynamic expressions** | `@given(MY_CONSTANT)` or `@when("str" + "ing")` — kept in the index for navigation, excluded from live matching |
| **V8-incompatible regex** | Advanced Python-specific lookbehinds or group referencing syntax — preserved for Go to Definition, not used for real-time linting |
