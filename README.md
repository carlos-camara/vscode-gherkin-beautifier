<!-- markdownlint-disable MD033 MD041 -->

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/logo-transparent.png" alt="Gherkin PowerTools logo" width="120" />
</div>

<h1 align="center">Gherkin PowerTools: Workspace Intelligence for Python Behave</h1>

<p align="center">
  <strong>Visual execution, AST-powered linting, and real-time impact analysis for enterprise BDD teams.</strong><br>
  <em>A premium VS Code testing environment that transforms plain-text Gherkin specifications into an interactive, debuggable, and strictly validated codebase.</em>
</p>

<div align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools"><img src="https://img.shields.io/badge/VS%20Code%20Marketplace-Install%20Now-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white" alt="Install from Marketplace" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools"><img src="https://vsmarketplacebadges.dev/version-short/carloscamara.vscode-gherkin-powertools.svg?style=flat-square&color=007ACC" alt="Version" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools"><img src="https://vsmarketplacebadges.dev/downloads-short/carloscamara.vscode-gherkin-powertools.svg?style=flat-square&color=007ACC" alt="Downloads" /></a>
</div>

<div align="center">
  <strong><a href="https://carlos-camara.github.io/vscode-gherkin-powertools/">Read Documentation</a> • <a href="https://github.com/carlos-camara/vscode-gherkin-powertools/issues">Report Issue</a> • <a href="https://github.com/carlos-camara/vscode-gherkin-powertools">GitHub Repository</a></strong>
</div>

<br/>

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/debug-demo.gif" alt="Run and Debug a Behave scenario from Test Explorer" width="600" height="340" />
</div>

<p align="center">
  <em>Visually run, debug, and track your Python Behave scenarios directly from the VS Code Test Explorer.</em>
</p>

---

## ⚡ Quick Start

1. **Install** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools).
2. **Open** any `.feature` file to rapidly activate formatting and linting.
3. *(Behave only)* Gherkin PowerTools automatically discovers your project and offers a guided Walkthrough.

---

## Why Gherkin PowerTools?

A premium testing environment that eliminates the friction between plain-text `.feature` files and your Python backend logic:

- **Visual Testing Integration:** Run, debug, and trace Python Behave scenarios visually directly from the VS Code sidebar.
- **Workspace Intelligence:** Context-aware IntelliSense and <kbd>Cmd+Click</kbd> navigation with O(1) in-memory indexing.
- **Safe Step Refactoring:** View the exact blast radius of a step before refactoring, and rename it globally with 1-click.
- **Catch Errors Before CI:** Dialect-aware real-time AST linting catches malformed syntax as you type.

---

## 🌟 Feature Highlights

> **[See all features in the Full Documentation →](https://carlos-camara.github.io/vscode-gherkin-powertools/)**

### 1. Missing Python Step Generation
Press <kbd>Ctrl+.</kbd> (<kbd>Cmd+.</kbd> on macOS) to instantly generate a valid Python stub—complete with extracted regex parameters—from any undefined Gherkin step.
- **Workspace-Aware:** Intelligently infers the optimal destination based on your `stepGlobs` configuration, resolving ambiguity safely via QuickPick.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif" alt="Generate a Python step stub from undefined Gherkin" width="600" height="340" />
</div>

### 2. Gherkin Health Dashboard & Anti-pattern Engine
Powered by the new **BDD Anti-pattern Detection Engine**, you can now visually identify unused, duplicated, ambiguous, or highly complex step definitions and scenarios. Gherkin PowerTools calculates Technical Debt and Maintainability, persisting branch-isolated historical snapshots to securely visualize your project's evolution over time in a premium, interactive dashboard.
- **Finding Suppression:** Safely suppress deliberate anti-patterns using Quick Fixes, with all suppressions persisted to a centralized ledger (`.gherkin-pt-suppressions.json`).
- **Batch Fix Workflow:** Run the `Fix All Safe Auto-Fixable Problems` command to automatically correct semantics-preserving errors across a whole document.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/dashboard.gif" alt="Interactive BDD source analytics and project health dashboard" width="600" height="340" />
</div>

### 3. Real-Time Impact Analysis
A Blast Radius CodeLens appears above every Python step definition. View exactly how many scenarios will be impacted before refactoring, and jump to them with a single click.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/impact-analysis.gif" alt="Impact Analysis - Blast Radius CodeLens" width="600" height="340" />
</div>

---

## 🛠 Capabilities

Gherkin PowerTools acts in two tiers depending on your project:

### Generic BDD Frameworks (Cucumber, SpecFlow, Playwright)
- **AST-Powered Formatting:** Rapidly align tables, tags, and indentation (`Shift+Alt+F` or Editor Context Menu).
- **Structural Linting:** Catch malformed scenarios across 70+ spoken languages in real-time.
- **Document Outline:** Navigate complex `.feature` structures from the VS Code sidebar.
- **Gherkin Health Dashboard:** Interactive modern webview to analyze oversized features, tag usage, and architectural anti-patterns with built-in DOM node limits for massive workspaces.

### Exclusive to Python Behave
- **Context-Aware IntelliSense:** Autocomplete powered by recent-usage ranking and tag affinity.
- **Step Refactoring:** Safely extract steps or natively rename them across your entire workspace (<kbd>F2</kbd> or Context Menu).
- **Test Explorer Integration:** Run and debug features with line-by-line execution tracking and pristine Markdown-formatted error traces, ordered strictly chronologically as written in your code.
- **BDD Anti-pattern Detection Engine:** Instant technical debt diagnostics for unused, ambiguous, or duplicated step definitions. Features Object-based Configuration to dynamically scale heuristic severities (e.g. adjust max sizes per rule).
- **Standalone CLI (`@carlos-camara/gherkin-pt`):** Enforce formatting, run the Anti-pattern Engine, and calculate project health metrics natively in your CI/CD pipelines.
  The CLI uses the exact same parsing, formatting, and BDD Anti-pattern engine as the VS Code extension. [View the Capability Contract](https://carlos-camara.github.io/vscode-gherkin-powertools/capability_contract/). *(Note: In Remote Development environments like WSL or SSH, run the CLI from the VS Code Integrated Terminal, not your local OS terminal).*

---

## ⚙️ Essential Configuration

Share team formatting and diagnostic rules by committing a `.gherkin-powertoolsrc.json` to your project root.

| Setting | Default | Description |
| --- | --- | --- |
| `gherkinPowerTools.profile` | `"custom"` | Formatting baseline: `strict`, `team`, `minimal`, `legacy`, or `custom`. |
| `gherkinPowerTools.rules` | `{...}` | Diagnostic rule overrides. Accepts string severities (`"error"`) or configuration objects (`{ "severity": "warning", "maxSteps": 20 }`). |
| `gherkinPowerTools.behave.stepGlobs` | `["**/steps/**/*.py", ...]` | Paths to Python step definitions. |
| `gherkinPowerTools.behave.execution` | `{"executable": "behave", "arguments": []}` | Secure Test Explorer execution command (e.g., `{"executable": "poetry", "arguments": ["run", "behave"]}`). |
| `gherkinPowerTools.behave.localExecutable` | *None* | Machine-specific override for the Behave executable absolute path. |

*Visit the **[Configuration Reference](https://carlos-camara.github.io/vscode-gherkin-powertools/configuration/)** for all available settings.*

---
## Support & Contributions

- 📖 **[Read the Full Documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/)**
- 💬 **[Join GitHub Discussions](https://github.com/carlos-camara/vscode-gherkin-powertools/discussions)**
- 🐛 **[Report an Issue](https://github.com/carlos-camara/vscode-gherkin-powertools/issues)**

Contributions are welcome! Please read the [Contributing Guide](https://github.com/carlos-camara/vscode-gherkin-powertools/blob/main/CONTRIBUTING.md).

---
<div align="center">
  <br>
  <strong>Enjoying Gherkin PowerTools?</strong> <a href="https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools&ssr=false#review-details">Leave a rating on the Marketplace!</a> ⭐⭐⭐⭐⭐
</div>
