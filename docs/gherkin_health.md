# Gherkin Health & Analytics

Gherkin PowerTools includes a built-in **Gherkin Health Dashboard** that provides immediate insights into the architecture, quality, and maintainability of your BDD suite.

---

## What the Dashboard Does

The Analytics Dashboard analyzes your workspace in real-time leveraging the in-memory **Workspace Graph** (which connects Features, Scenarios, Steps, and Python Step Definitions) and the **Recommendation Engine**.

It generates deep heuristics and scores, including:

- **Overall Health Score**: A unified metric indicating the general state of your test suite.
- **Maintainability Score**: Penalized by technical debt such as unused step definitions, duplicated patterns, and undefined steps in feature files.
- **Complexity Score**: An inverse metric tracking the verbosity of your suite (e.g. overly long scenarios, massive feature files).
- **Technical Debt Breakdown**: Immediate access to unused steps, duplicated steps, ambiguous steps, and undefined steps flagged by the Recommendation Engine.
- **Actionable Insights**: Prioritized recommendations (High, Medium, Low severity) such as breaking down oversized scenarios or removing duplicated regex patterns.
- **Architecture Insights**: Rankings of the top 10 largest features and scenarios by step count, and top 50 most frequent tags.

**Interactive Navigation**: Every metric in the dashboard is clickable. Clicking on an oversized scenario, a duplicated step, or an unused step definition will instantly open the file and scroll to the exact line in your VS Code editor.

**Important:** This dashboard provides *static source analysis*. It does **not** provide runtime test execution results, code coverage, pass/fail rates, or act as an Allure replacement.

---

## How to View the Dashboard

To generate the dashboard:
1. Open the Command Palette (<kbd>Ctrl+Shift+P</kbd> or <kbd>Cmd+Shift+P</kbd>).
2. Type and select **Gherkin PowerTools: Show Gherkin Health**.

A Webview panel will open in VS Code displaying the generated HTML report.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/dashboard.gif" alt="Gherkin Health Dashboard - showing maintainability, complexity, and tech debt metrics" width="600" />
</div>

> **Note**: The legacy "Analyze Step Definitions" command has been fully integrated into the new Gherkin Health Dashboard. Both commands now launch the same unified view.

---

## Tag Blast Radius

In addition to the global dashboard, the extension provides inline analytics for tags via Hover.

Hover your mouse over any `@tag` in a `.feature` file to calculate exactly how many Scenarios, Backgrounds, and Example rows that tag affects across your entire workspace.

This helps you understand the "blast radius" of executing a specific tag before you push code to CI.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-tags.gif" alt="Hover on a tag - shows the number of scenarios it affects across the workspace" width="600" />
</div>

---

## Performance

- The dashboard relies on the internal `WorkspaceGraph` and `SymbolCache`, which parse all `.feature` and Python step files upon workspace load.
- Thanks to the graph architecture, the dashboard generation is completely $O(1)$ after initial indexing and loads instantaneously, even on enterprise repositories.
- Excluded folders (like `node_modules` or `.venv`) are appropriately ignored during the initial index to maintain performance.
