# 📊 Project Analytics Dashboard

Stop flying blind. Get instant, enterprise-grade BDD analytics about your entire project with the project statistics dashboard.

<div style="border-radius: 8px; overflow: hidden; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid #d1d5db;">
  <div style="background: #1f2937; padding: 10px 16px; display: flex; align-items: center; gap: 8px;">
    <span style="font-size: 16px;">💡</span>
    <span style="color: #f9fafb; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase;">How to Launch</span>
  </div>
  <div style="background-color: #ffffff; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;">
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="color: #6b7280; font-size: 16px; flex-shrink: 0; line-height: 1;">◆</span>
      <span style="color: #374151; font-size: 13px;"><strong style="color: #111827;">Right-click</strong> inside any <code style="background:#f3f4f6; padding: 1px 5px; border-radius: 3px; color: #1f2937;">.feature</code> file → <strong style="color: #111827;">Gherkin: Show Project Statistics</strong></span>
    </div>
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="color: #6b7280; font-size: 16px; flex-shrink: 0; line-height: 1;">◆</span>
      <span style="color: #374151; font-size: 13px;">Open the
        <strong style="color: #111827;">Command Palette</strong> (
        <kbd style="background:#f3f4f6; border: 1px solid #d1d5db; border-radius: 3px; padding: 1px 5px; font-size: 11px; color: #1f2937;">⌘⇧P</kbd> /
        <kbd style="background:#f3f4f6; border: 1px solid #d1d5db; border-radius: 3px; padding: 1px 5px; font-size: 11px; color: #1f2937;">Ctrl+Shift+P</kbd>) →
        <strong style="color: #111827;">Gherkin: Show Project Statistics</strong>
      </span>
    </div>
  </div>
</div>

---

## 🏆 The Gherkin Quality Indicator
The dashboard acts as an automated Quality Auditor for your BDD suite. It calculates a heuristic score from **0 to 100** based on strict BDD best practices:

- **+ Background Reuse**: Earn points for actively using `Background` blocks to eliminate precondition repetition.
- **+ Data Density**: Earn points for using `Scenario Outline` with `Examples` and Data Tables to condense testing permutations.
- **+ Documentation**: Earn points for having a high ratio of explanatory comments (`#`).
- **- Complexity Penalty**: Lose points if your scenarios are excessively long (penalizes average lengths of >12 steps per scenario).

Formulas for the indicators are documented via tooltips when hovering over the respective items in the dashboard!

## 🧠 Scenario Intelligence & Archetypes
- **Scenario Intelligence**: Tracks vocabulary richness, average step conciseness, data density, and actively flags the "Longest scenario" in your suite so you know exactly where to refactor.
- **Behavioral Archetypes**: Scans and classifies your step vocabulary to determine if your project is heavily focused on UI testing, API operations, or Database manipulation.
- **Step Execution Breakdown**: Real-time progress bars charting the exact distribution of `Given`, `When`, `Then`, and `And`/`But` usages across the suite.

## 🚀 Estimated Execution Effort
Stop guessing the value of your automated tests. The dashboard now calculates:

- **Executable Tests**: It doesn't just count scenarios. It mathematically calculates every single test permutation by parsing `Scenario Outline` execution rows.
- **Estimated Execution Effort**: Calculates the estimated manual hours saved by your suite every test run (assuming an industry baseline of 5 minutes per manual test execution).

## 🏷️ Tags & Step Intelligence
- **Top Tags Leaderboard**: Scans and indexes every tag in your workspace, displaying an interactive leaderboard of the most frequently used elements (`@smoke`, `@regression`, etc.).
- **Reusability Index**: Compares total written steps against the number of uniquely instantiated step definitions.

---

## ⚙️ Architecture

The dashboard is rendered as an interactive, fully responsive **HTML Webview** inside VS Code. It features a premium glassmorphism UI built with raw HTML and CSS animations.

When triggered, the extension deeply parses all `.feature` files in the workspace (including unsaved buffers) through the `@cucumber/gherkin` and `@cucumber/messages` AST, leveraging asynchronous parsing with cancellation support to prevent UI blocking. It aggregates the data in memory and paints the dashboard without any external dependencies or telemetry.

### 🔒 Webview Security
Following strict enterprise security standards, the Webview implements a robust Content Security Policy (CSP).
The injected `<meta http-equiv="Content-Security-Policy">` tag completely prevents the execution of inline scripts
(`script-src 'none'`), replacing old script animations with pure CSS equivalents. Furthermore, all dynamic inputs
parsed from the workspace (such as scenario names, tags, and step definitions) are comprehensively sanitized and
HTML-escaped before rendering. This safeguards the editor environment from potential Cross-Site Scripting (XSS)
vectors when rendering external or untrusted `.feature` data.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/dashboard.gif" alt="Dashboard Demonstration" width="600" />
</div>
