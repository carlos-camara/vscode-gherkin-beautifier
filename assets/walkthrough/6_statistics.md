# 📊 Project Statistics Dashboard

Get a data-driven view of your BDD test suite health at a glance.

**How to open:**

- Open the **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run `Gherkin PowerTools: Show Statistics`
- Or select **Statistics** from the **Command Center**

**What the dashboard shows:**

| Metric | Description |
|--------|-------------|
| **Total Features** | Number of `.feature` files in the workspace |
| **Total Scenarios** | All `Scenario` and `Scenario Outline` blocks |
| **Total Examples Rows** | Expanded parameterized rows from all `Scenario Outline` blocks |
| **Effective Test Cases** | Actual number of test executions (scenarios + expanded rows) |
| **Step Definitions** | Number of Python step implementations indexed from your step globs |
| **Coverage** | Ratio of Gherkin steps that have a matching Python implementation |
| **Tag Distribution** | Bar chart of the most used tags across your workspace |
| **Most Complex Scenarios** | Scenarios with the highest step count — candidates for refactoring |

**Why it matters:**

The Statistics Dashboard gives QA leads and project managers a living snapshot of test coverage without running a single test. Use it to spot gaps, track growth over sprints, and identify bloated scenarios that should be split.

> **Tip:** The dashboard is generated from the Cucumber AST — it is always consistent with what Behave would actually execute, including expanded `Scenario Outline` rows.
