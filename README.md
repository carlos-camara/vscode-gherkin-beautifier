<!-- markdownlint-disable MD033 MD041 -->

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/logo-transparent.png" alt="Gherkin PowerTools logo" width="120" />
</div>

<h1 align="center">Ship BDD Faster with Gherkin PowerTools</h1>

<p align="center">
  <strong>The all-in-one VS Code extension for formatting, validating, and debugging Gherkin feature files—with deep, first-class support for Python Behave.</strong>
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
2. **Open** any `.feature` file to instantly activate formatting and linting.
3. *(Behave only)* Gherkin PowerTools automatically discovers your project and offers a guided Walkthrough.

---

## Why Gherkin PowerTools?

Deliver behavior faster without wrestling with the terminal or configuration:

- **Never Write Regex Manually:** 1-click Python step generation from undefined Gherkin steps.
- **Catch Errors Before CI:** Dialect-aware real-time linting catches malformed syntax as you type.
- **Visual Testing Integration:** Run, debug, and trace Behave scenarios visually directly from the VS Code sidebar.
- **Navigate Instantly:** Context-aware IntelliSense and <kbd>Cmd+Click</kbd> bridge plain-text `.feature` files and Python backend logic.

---

## 🌟 Feature Highlights

> **[See all features in the Full Documentation →](https://carlos-camara.github.io/vscode-gherkin-powertools/)**

### 1. Missing Python Step Generation
Press <kbd>Ctrl+.</kbd> (<kbd>Cmd+.</kbd> on macOS) to instantly generate a valid Python stub—complete with extracted regex parameters—from any undefined Gherkin step.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif" alt="Generate a Python step stub from undefined Gherkin" width="600" height="340" />
</div>

### 2. Gherkin Health Dashboard & Anti-pattern Engine
Powered by the new **BDD Anti-pattern Detection Engine**, you can now visually identify unused, duplicated, ambiguous, or highly complex step definitions and scenarios. Gherkin PowerTools calculates Technical Debt and Maintainability, persisting branch-isolated historical snapshots to securely visualize your project's evolution over time.

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
- **AST-Powered Formatting:** Instantly align tables, tags, and indentation (<kbd>Shift+Alt+F</kbd>).
- **Structural Linting:** Catch malformed scenarios across 70+ spoken languages in real-time.
- **Document Outline:** Navigate complex `.feature` structures from the VS Code sidebar.

### Exclusive to Python Behave
- **Context-Aware IntelliSense:** Autocomplete powered by recent-usage ranking and tag affinity.
- **Step Refactoring:** Safely rename or extract steps across your entire workspace (<kbd>F2</kbd>).
- **Test Explorer Integration:** Run and debug features with line-by-line execution tracking.
- **Standalone CLI (`@carlos-camara/gherkin-pt`):** Enforce formatting, run the Anti-pattern Engine, and calculate project health metrics natively in your CI/CD pipelines with 100% feature parity to the VS Code extension.

---

## ⚙️ Essential Configuration

Share team formatting rules by committing a `.gherkin-powertoolsrc.json` to your project root.

| Setting | Default | Description |
| --- | --- | --- |
| `gherkinPowerTools.profile` | `"custom"` | Formatting baseline: `strict`, `team`, `minimal`, `legacy`, or `custom`. |
| `gherkinPowerTools.behave.stepGlobs` | `["**/steps/**/*.py", ...]` | Paths to Python step definitions. |
| `gherkinPowerTools.behave.execution` | `{"executable": "behave", "arguments": []}` | Secure Test Explorer execution command (e.g., `{"executable": "poetry", "arguments": ["run", "behave"]}`). |

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
