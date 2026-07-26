# 🧭 Go To Definition

Stop searching for step implementations manually. Gherkin PowerTools allows you to instantly jump from any `.feature` file step directly to its underlying Python execution code.

## ⚡ How to Trigger

- **Mouse**: `Cmd + Click` (macOS) or `Ctrl + Click` (Windows/Linux) on any step.
- **Keyboard**: Place your cursor on a step and press **`F12`**.
- **Context Menu**: Right-click on a step → **"Go to Definition"**.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/goto-definition.gif" alt="Go To Definition Demo" width="600" />
</div>

<div style="border-radius: 8px; overflow: hidden; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid #d1d5db;">
  <div style="background: #1f2937; padding: 10px 16px; display: flex; align-items: center; gap: 8px;">
    <span style="font-size: 16px;">⚠️</span>
    <span style="color: #f9fafb; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase;">Workspace & Discovery Requirements</span>
  </div>
  <div style="background-color: #ffffff; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;">
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="color: #6b7280; font-size: 16px; flex-shrink: 0; line-height: 1;">◆</span>
      <span style="color: #374151; font-size: 13px;">Python step implementation files are discovered using
        <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">gherkinPowerTools.behave.stepGlobs</code>
        (defaults to <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">**/steps/**/*.py</code> and
        <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">**/features/steps/**/*.py</code>).
        Custom directories can be added in settings.</span>
    </div>
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="color: #6b7280; font-size: 16px; flex-shrink: 0; line-height: 1;">◆</span>
      <span style="color: #374151; font-size: 13px;">Virtual environments and external dependencies are automatically excluded via
        <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">gherkinPowerTools.behave.ignoreGlobs</code>
        (defaults to <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">node_modules</code>,
        <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">.venv</code>,
        <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">venv</code>,
        <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">env</code>).</span>
    </div>
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="color: #6b7280; font-size: 16px; flex-shrink: 0; line-height: 1;">◆</span>
      <span style="color: #374151; font-size: 13px;">Python functions must be decorated with
        <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">@given</code>,
        <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">@when</code>,
        <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">@then</code>, or
        <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">@step</code>.
      </span>
    </div>
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="color: #6b7280; font-size: 16px; flex-shrink: 0; line-height: 1;">◆</span>
      <span style="color: #374151; font-size: 13px;">Automated Project Onboarding detects step files in non-standard folders and offers 1-click configuration updates.</span>
    </div>
  </div>
</div>


## 🧠 How It Works (The Symbol Cache & Live Watchers)

Gherkin PowerTools uses a **lazy-initialized In-Memory Symbol Cache** that guarantees near-zero VS Code startup time. When the extension activates, it registers all language providers immediately — but defers the heavy file I/O of scanning your Python step files by approximately 2 seconds after startup.

On first use (or when VS Code has just opened), any provider that needs the cache (`Go to Definition`, `Hover`, `IntelliSense`) calls `ensureInitialized()`, which either returns the already-completed index immediately or transparently awaits the background scan. In practice, the index is ready within a few seconds of opening a workspace.

Dynamic file watchers monitor file creation, modification, deletion, and rename events across multi-root workspaces. File events are debounced (100 ms) and filtered against `ignoreGlobs` to keep your symbol index instantaneously in sync without CPU overhead.

When you request a definition (e.g., clicking on `Given I login as "admin"`):

1. **Extraction**: The extension extracts the semantic step text (`I login as "admin"`).
2. **Evaluation**: It strips dynamic Gherkin data variables and normalizes the string.
3. **Lookup**: It queries the Symbol Cache in RAM via `getStepDefinitions()`. It performs **Semantic Context-Aware Matching**, respecting strict `@given`, `@when`, and `@then` decorators. `And` and `But` steps are dynamically resolved by scanning upwards through the scenario.
4. **Navigation**: It locates the matching Python decorator and instantly opens the file directly at that exact line.
   - **Ambiguous Matches**: If your step matches multiple overlapping wildcards, it opens a native Peek View showing all possible definitions instead of arbitrarily picking the first one.

<div style="border-radius: 8px; overflow: hidden; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid #d1d5db;">
  <div style="background: #1f2937; padding: 10px 16px; display: flex; align-items: center; gap: 8px;">
    <span style="font-size: 16px;">💡</span>
    <span style="color: #f9fafb; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase;">Reactive Watchers & Runtime Configuration Reloading</span>
  </div>
  <div style="background-color: #ffffff; padding: 14px 16px;">
    <span style="color: #374151; font-size: 13px;">File system watchers automatically rebuild when you update
      <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">gherkinPowerTools.behave.stepGlobs</code>
      or <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">.gherkin-powertoolsrc.json</code>,
      instantly re-indexing your custom step directories without requiring a VS Code restart.</span>
  </div>
</div>

---

## 🐍 Supported Python Decorators

The definition provider is natively compatible with standard `behave` and `pytest-bdd` Python decorators. It supports complex regex matching, f-strings, raw strings, and robust multi-line decorator formatting.

```python
# Standard Exact Match
@given('I login')
def step_login(context): ...

# Regex with Named Groups
@when(r'I click the button "(?P<button_name>[^"]*)"')
def step_click(context, button_name): ...

# Formatted F-Strings & Bracket Variables
@then(f'I should see the {dashboard}')
def step_see(context, dashboard): ...

# Unicode/Byte prefixes and @step alias
@step(u'I perform an action')
def step_action(context): ...
```

## ⚠️ Limitations

Because Gherkin PowerTools evaluates step matches inside the Node.js (JavaScript) environment, it relies on a custom bounded tokenizer to extract Python step definition patterns without invoking a full Python parser.

### Supported Python Patterns
The tokenizer accurately resolves step patterns defined as **string literals**, including:
- Single and double quotes (`'...'`, `"..."`)
- Multiline triple quotes (`'''...'''`, `"""..."""`)
- Prefixed string literals (`r"..."`, `u"..."`, `f"..."`, `b"..."`, `rf"..."`)
- Escaped quotes within strings (`"I type \"hello\""`)

### Limitations

1. **Dynamic Expressions:** Python steps defined via dynamic expressions, variables, or concatenated strings (e.g., `@given(MY_CONSTANT)` or `@when("str" + "ing")`) cannot be evaluated dynamically. They are preserved for navigation (Go To Definition) but will not support real-time linting or Hover.
2. **Regex Engine Differences:** Python-specific Regex constructs that are not supported by the V8 JavaScript Engine (such as advanced lookbehinds or specific group referencing syntax) cannot be evaluated dynamically. Like dynamic expressions, these are kept in the index for navigation but excluded from live text matching.
