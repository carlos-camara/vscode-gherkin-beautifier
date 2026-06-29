# 📊 Project Analytics Dashboard

Get instant, enterprise-grade BDD analytics about your entire project with the **Omega Squeeze** dashboard.

!!! tip "How to Use"
    - **Right-click** inside any `.feature` file → **Gherkin: Show Project Statistics**
    - Or open the **Command Palette** (`Cmd+Shift+P`) → **Gherkin: Show Project Statistics**

## 🏆 The Gherkin Quality Score (GQS)
The dashboard acts as an automated Quality Auditor for your BDD suite. It calculates a proprietary score from 0 to 100 based on BDD best practices:

- **+ BG Reuse**: Earn points for using `Background` blocks to avoid repetition.
- **+ Tables**: Earn points for using `Scenario Outline` with `Examples` tables.
- **+ Comments**: Earn points for having high comment density (`#`).
- **- Penalty**: Lose points if your scenarios are too long (average of >12 steps per scenario).

## 🧠 Scenario Intelligence & Archetypes
- **Scenario Intelligence**: Tracks vocabulary richness, average step conciseness, data density, and actively flags the "Most Complex Scenario" in your suite.
- **Behavioral Archetypes**: Scans step vocabulary to classify your project into UI, API, and DB operations.
- **Step Execution Breakdown**: Real-time progress bars charting the distribution of Given, When, Then, And/But usages.

## 🚀 Execution & Automation ROI
Stop guessing the value of your automated tests. The dashboard now calculates:

- **Total Executable Tests**: It doesn't just count scenarios; it calculates every single execution permutation by adding Scenario Outline data rows.
- **Automation ROI**: Calculates the estimated manual hours saved by your suite, assuming an industry average of 5 minutes per manual test execution.

## 🏷️ Tags & Step Intelligence
- **Top Tags & Steps**: Scans and indexes every tag and step in your workspace, displaying an interactive, expandable leaderboard of the most frequently used elements.
- **Code Density**: Tracks total lines of code versus empty lines to ensure formatting space health.

## How It Works

The dashboard is rendered as an interactive **HTML Webview** inside VS Code with a premium glassmorphism UI. It deeply parses all `.feature` files in the workspace (including unsaved buffers) and generates a responsive report with CSS animations.

![Dashboard Demonstration](../assets/dashboard.webp)
