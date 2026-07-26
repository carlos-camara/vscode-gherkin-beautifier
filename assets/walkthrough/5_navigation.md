# 🧭 Navigate Your BDD Suite

Gherkin PowerTools provides a full suite of navigation and intelligence features, so you spend less time searching and more time writing tests.

---

## Go to Definition — `F12`

Right-click any Gherkin step (or press `F12`) to jump directly to the Python `@given`, `@when`, or `@then` decorator that implements it.

- Works with **regex-based** and **parse-expression** step matchers
- Automatically resolves **`And`** and **`But`** steps by scanning upward to inherit the correct preceding keyword context (`Given`, `When`, `Then`)
- Supports **multi-file workspaces** — the definition can be in any indexed `.py` file

---

## Hover Documentation

Hover over any Gherkin step to instantly see:

- The **Python function name** and **full signature**
- The **docstring** (if present) of the step implementation
- Whether the step is matched by **regex** or **parse expression**

Hover over any `@tag` to see its **blast radius** — the number of scenarios across your workspace that carry that tag.

---

## IntelliSense Completions

After typing `Given `, `When `, `Then `, `And `, or `But `, the extension suggests matching step definitions from your Python cache.

Inside a `Scenario Outline`, type `<` to trigger **parameter autocompletion** — the extension reads your `Examples:` table headers and inserts the correct `<column>` placeholder.

---

## Outline Panel

Open the VS Code **Outline** sidebar (`View → Open View → Outline`) to see a structured tree of your `.feature` file:

```
Feature: User Authentication
  ├─ Scenario: Successful login
  ├─ Scenario: Failed login — wrong password
  └─ Scenario Outline: Login with multiple roles
       ├─ Examples Row: admin
       └─ Examples Row: editor
```

---

> **Tip:** Use `Cmd+Shift+O` (macOS) or `Ctrl+Shift+O` (Windows/Linux) to open the symbol picker and jump to any scenario in the file instantly.
