# Analytics & Statistics

Gherkin PowerTools includes a built-in Workspace Analytics dashboard that provides immediate insights into the health and structure of your BDD suite.

---

## What the Dashboard Does

The Analytics Dashboard parses your workspace's `.feature` files and generates heuristics based on the underlying Cucumber AST.

It helps you understand **Source-Level Structure**, including:
- How many Feature files, Scenarios, and Steps exist in the workspace.
- Which tags are used most frequently.
- Which Scenarios are the most complex (ranked by step count).

**Important:** This dashboard provides *static source analysis*. It does **not** provide runtime test execution results, code coverage, pass/fail rates, or act as an Allure replacement.

---

## How to View Statistics

To generate the dashboard:
1. Open the Command Palette (<kbd>Ctrl+Shift+P</kbd> or <kbd>Cmd+Shift+P</kbd>).
2. Type and select **Gherkin PowerTools: Show Project Statistics**.

A Webview panel will open in VS Code displaying the generated HTML report.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/dashboard.gif" alt="Statistics dashboard - workspace metrics generated from the Cucumber AST" width="600" />
</div>

---

## Tag Blast Radius

In addition to the global dashboard, the extension provides inline analytics for tags via Hover.

Hover your mouse over any `@tag` in a `.feature` file to calculate exactly how many Scenarios, Backgrounds, and Example rows that tag affects across your entire workspace.

This helps you understand the "blast radius" of executing a specific tag before you push code to CI.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-tags.gif" alt="Hover on a tag - shows the number of scenarios it affects across the workspace" width="600" />
</div>

---

## Limitations

- The dashboard relies on the internal `FeatureCache`, which parses all `.feature` files upon workspace load. Extremely large repositories (thousands of feature files) may take several seconds to generate the report.
- Excluded folders (like `node_modules` or `.venv`) are appropriately ignored to maintain performance.
