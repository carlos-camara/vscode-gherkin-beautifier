# 🌳 Outline Provider

Navigate massive `.feature` files with ease using VS Code's native **Outline** panel and **Breadcrumb** navigation. Powered by the official `@cucumber/gherkin` AST Parser, the Outline faithfully represents the exact semantic structure of your Gherkin document.

Unlike regex-based parsers, the AST implementation is never confused by keywords hidden inside comments, docstrings, or data tables.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/outline.gif" alt="Outline Provider Demo" width="700" />
</div>

---

## ⚡ How to Access

**Outline Panel:**

Open the Explorer sidebar (`Cmd+Shift+E` / `Ctrl+Shift+E`) and look for the **Outline** section at the bottom.

**Symbol Picker (fastest):**

Press <kbd>Cmd+Shift+O</kbd> (macOS) or <kbd>Ctrl+Shift+O</kbd> (Windows/Linux) to open a fuzzy-searchable symbol picker — type a few letters of a scenario name and jump to it instantly.

**Breadcrumb Navigation:**

The full Feature → Rule → Scenario hierarchy is always visible in the VS Code **breadcrumb bar** at the top of the editor. Click any crumb to navigate directly to that node.

---

## 🗺️ Hierarchical Structure

The Outline panel displays a perfectly nested tree that mirrors your BDD specification:

```text
📁 Feature: User Authentication
  📁 Rule: Login Flow
    📄 Scenario: Successful login with valid credentials
    📄 Scenario: Failed login — wrong password
    📄 Scenario: Account locked after 3 failed attempts
  📁 Rule: Registration
    📄 Scenario Outline: New user signup with multiple roles
         📄 Examples Row: admin / full-access
         📄 Examples Row: editor / read-only
  📄 Background: Common preconditions
```

Every `Examples` table row in a `Scenario Outline` is exposed as an **individual, independently navigable node** — so you can jump directly to a specific parameterized case.

---

## 🚀 Workflow Benefits

| Benefit | Detail |
|---------|--------|
| **Rapid navigation** | Click any item to jump there — no scrolling |
| **Structural overview** | See the full complexity of a feature at a glance before diving in |
| **Breadcrumb integration** | Always know where you are in the file hierarchy |
| **Symbol search** | Fuzzy-search across all scenarios with `Cmd+Shift+O` |
| **AST accuracy** | No false positives from keyword text inside steps, comments, or docstrings |

---

## 🧩 Integration with Test Explorer

Each node in the Outline corresponds directly to a node in the **Test Explorer** (`Cmd+Shift+T`). Use the Outline for navigation within a file, and the Test Explorer to run or debug any node across your entire workspace.

> **Tip:** The outline updates live as you type — within 400 ms and without saving. Adding a new scenario is reflected in the outline immediately.
