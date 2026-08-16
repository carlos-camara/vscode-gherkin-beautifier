# 📊 Gherkin Health Dashboard

Get a data-driven view of your BDD test suite health, architecture, and maintainability.

**How to open:**

- Open the **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run `Gherkin PowerTools: Show Gherkin Health`
- Or select **Gherkin Health** from the **Command Center**

**What the dashboard shows:**

| Metric | Description |
|--------|-------------|
| **Overall Health** | A unified metric indicating the general state of your test suite. |
| **Maintainability** | Penalized by technical debt such as unused step definitions, duplicated patterns, and undefined steps. |
| **Complexity Score** | An inverse metric tracking the verbosity of your suite (e.g. overly long scenarios, massive feature files). |
| **Technical Debt** | Immediate access to unused steps, duplicated steps, ambiguous steps, and undefined steps flagged by the Anti-pattern Engine. |
| **Actionable Anti-patterns** | Prioritized rules to fix technical debt (configurable as Error, Warning, Info, Hint). |
| **Architecture Insights** | Rankings of the top 10 largest features and scenarios by step count, and top 50 most frequent tags. |
| **Historical Trends** | Evolution charts visualizing how your Technical Debt and Complexity change over time, isolated by Git branch. |

**Why it matters:**

The Gherkin Health Dashboard gives QA leads and project managers a living snapshot of test quality and technical debt without running a single test. The Anti-pattern Engine intelligently analyzes your workspace to find oversized scenarios, duplicate regex patterns, and unused Python step definitions.

> **Interactive Navigation:** Every metric and anti-pattern in the dashboard is clickable and will instantly open the file and scroll to the exact line in your VS Code editor.
