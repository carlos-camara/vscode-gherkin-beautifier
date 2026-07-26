# 🖱️ Hover Documentation Preview

Context-switching between your `.feature` files and your Python codebase is a thing of the past. The Gherkin PowerTools includes a built-in **Hover Provider** that instantly gives you the underlying code context of any step.

## 🚀 How it Works

When you hover your mouse cursor over any step (e.g., `Given`, `When`, `Then`) in a `.feature` file, the extension parses your workspace in real-time and displays a rich tooltip.

### 1. Python Signature Extraction
The tooltip displays the exact Python function signature (`def step_impl(context, ...):`) that matches your step. It supports single-line and complex multi-line function declarations.
- **Semantic Matching**: Hover fully respects `@given`, `@when`, and `@then` semantics, and contextually resolves `And`/`But` chains.
- **Ambiguous Resolution**: If a step matches multiple wildcard decorators, Hover will explicitly list **all** matching signatures, rather than hiding collisions.
- **Unsupported Matcher Warnings**: If the matching Python regex uses lookbehinds or other constructs unsupported by the JS engine, Hover surfaces an explicit warning.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-step.gif" alt="Python Step Hover Demo" width="600" />
</div>

### 2. Docstring Parsing
If your Python developer left a docstring (`"""..."""` or `'''...'''`) explaining what the step does, the Hover Provider will extract it and render it safely inside the tooltip as plain untrusted text. This eliminates formatting bugs caused by stray markdown syntax within docstrings.

### 3. Tag Blast Radius
Hovering over any Gherkin tag (e.g., `@regression`) instantly calculates its "Blast Radius". The tooltip dynamically counts and displays the total number of executable scenarios affected by that tag across the entire workspace. This fully supports tag inheritance (from `Feature` or `Rule` levels) and multiplies data rows within `Scenario Outline` tables.

> **📝 Note:** **Lazy Initialization:** The Feature Cache that powers Tag Blast Radius is initialized transparently in the background, approximately 2 seconds after VS Code starts. On the very first hover after opening VS Code, the extension may take a brief moment to complete indexing. Subsequent hovers return results immediately from memory.

> **📝 Note:** **Live & Resilient Analytics:** The tag counter automatically hooks into VS Code's live text buffers,
> ensuring counts include your active, unsaved edits. Furthermore, if any files in your workspace are temporarily
> unreachable (like disconnected remote VMs) or suffer from severe syntax errors, the Hover Provider will elegantly
> display an inline warning indicating that the blast radius might be "stale" or "partial", rather than outright failing.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-tags.gif" alt="Hover on Tags Demo" width="600" />
</div>

## 💡 Usage Example

Imagine you have the following Python code in your `steps.py`:

```python
@given('the user enters valid credentials')
def step_when_user_enters_credentials(
    context,
    username,
    password
):
    """
    Simulates a user typing their credentials into the login form.
    It automatically bypasses CAPTCHA in the test environment.
    """
    pass
```

When you hover over `Given the user enters valid credentials` in your `.feature` file, you will instantly see a formatted popup showing:

<div style="border-radius: 8px; overflow: hidden; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid #d1d5db;">
  <div style="background: #1f2937; padding: 10px 16px; display: flex; align-items: center; gap: 8px;">
    <span style="font-size: 16px;">💡</span>
    <code style="color: #f9fafb; font-size: 12px; font-weight: 600;">def step_when_user_enters_credentials(context, username, password):</code>
  </div>
  <div style="background-color: #ffffff; padding: 14px 16px;">
    <span style="color: #374151; font-size: 13px;">Simulates a user typing their credentials into the login form.<br/>It automatically bypasses CAPTCHA in the test environment.</span>
  </div>
</div>

## ⚙️ Requirements
- Ensure your step definitions are written in Python using Behave decorators (`@given`, `@when`, `@then`, `@step`).
- Docstrings must immediately follow the `def` statement.
