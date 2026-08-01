<!-- markdownlint-disable MD033 MD041 -->

<div align="center">

<img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/logo-transparent.png" alt="Gherkin PowerTools logo" width="120" /><br/>

# Gherkin PowerTools

**Format, validate, navigate, and execute Gherkin directly in VS Code.**

Core functionality provides advanced formatting and structural diagnostics for standard `.feature` files across any framework. Python Behave projects receive deep integration, including step navigation, stub generation, and integrated test execution.

<br/>

[![Install from Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Install%20Now-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools)

**[Watch Demo](#missing-python-step-generation) • [Read Documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/) • [Report Issue](https://github.com/carlos-camara/vscode-gherkin-powertools/issues)**

<br/>

</div>

---

<div align="center">

![Generate a Python step stub from undefined Gherkin — press Cmd+. and the function appears](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif)

*Automatically generate missing Python Behave steps directly from your feature files.*

</div>

---

## Designed for Two Workflows

Gherkin PowerTools provides two tiers of functionality depending on your technology stack:

### 1. Standard Gherkin Projects
Framework-independent tools for any BDD project (Cucumber, SpecFlow, Playwright BDD, Karate, etc.):

* **AST-Powered Formatter:** Align tables and standardize indentation.
* **Structural Linting:** Catch malformed Gherkin before committing.
* **Workspace Analytics:** Understand the structure and tag distribution of your BDD suite.
* **Document Outline:** Navigate scenarios and example rows efficiently.

### 2. Python Behave Projects
Specific integrations designed exclusively for Python Behave test suites:

* **Python Step Discovery:** Auto-detect and index Behave step definitions.
* **IntelliSense & Navigation:** Autocomplete steps and go to definition.
* **Code Actions:** Generate missing Python steps quickly.
* **Test Explorer:** Run and debug scenarios visually from the sidebar.

---

## Main Benefits

* **Keep feature files consistently formatted:** Standardize whitespace and table alignment across your team.
* **Catch malformed Gherkin before CI:** Identify missing colons, wrong block structures, and syntax errors as you type.
* **Find Python step definitions without searching manually:** Jump directly to the implementing Python function with a single click.
* **Generate missing Behave steps:** Create valid Python stubs for undefined steps directly.
* **Analyze step definitions:** Detect unused, duplicated, ambiguous, and suspiciously similar Python steps via the Gherkin Health dashboard.
* **Run or debug directly from VS Code:** Execute a specific scenario or example row without context-switching to the terminal.
* **Understand the BDD suite structure:** Analyze tag distribution, scenario complexity, and structural quality across your entire workspace.

---

## Quick Start

1. Install Gherkin PowerTools from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools).
2. Open any `.feature` file to activate the extension.
3. Press <kbd>Shift+Alt+F</kbd> (<kbd>⇧⌥F</kbd> on macOS) to format the document, or use the Command Palette (`Ctrl+Shift+P`) to explore commands.

*Note: For Python Behave projects, the extension automatically attempts to discover your step definitions. Check the [Configuration](#configuration) section if your files are in a custom location.*

---

## Capabilities

### Missing Python Step Generation
Write a Gherkin step. The linter underlines it if the Python implementation is missing. Press <kbd>Ctrl+.</kbd> (<kbd>Cmd+.</kbd> on macOS) to automatically generate a valid Python stub with the extracted regex parameters directly in your steps folder.

### Behave Test Explorer, Run, and Debug
Open the Testing panel to view a live tree of your features, rules, scenarios, and example rows. Click the Play button to execute, or the Bug icon to attach the Python debugger with full breakpoint support.

**Live Step Tracking:** As Behave runs your tests in the background, the exact step currently executing lights up dynamically in your `.feature` file, allowing you to visually track execution in real-time.

**Context Snapshot:** The runner automatically captures a Context Snapshot at the end of each scenario, injecting the final state of your `context` variables directly into the output panel so you can inspect internal state without stopping execution.
<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/run-demo.gif" alt="Run a Behave scenario from Test Explorer" width="600" />
</div>

### Python Navigation and IntelliSense
The extension suggests matching steps from your Python backend as you type. Unlike standard autocomplete, Gherkin PowerTools uses **Smart Context-Aware Ranking** to prioritize steps based on your recent usage, the current feature file, and semantic tag affinity.

<kbd>Ctrl+Click</kbd> (<kbd>Cmd+Click</kbd> on macOS) any step to jump to its Python definition, or hover to preview the function signature and docstring.
<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/goto-definition.gif" alt="Navigate from a feature file directly to the Python step definition" width="600" />
</div>

### Real-Time Gherkin Diagnostics and Quick Fixes
A dialect-aware AST linter flags structural errors across 70+ Gherkin languages. Identify misspelled keywords, malformed tables, and undefined steps immediately. Use Quick Fixes to correct common issues.
<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/linter.gif" alt="Real-time Gherkin diagnostics and Quick Fixes" width="600" />
</div>

### Gherkin Formatter
Align tables, wrap long tags, and standardize indentation using the built-in formatter. Configure formatting profiles to share a consistent baseline across your team.
<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/formatter.gif" alt="AST-powered Gherkin formatter aligning tables and standardizing indentation" width="600" />
</div>

</div>

### Gherkin Health & Recommendation Engine
Generate a comprehensive, interactive Webview report to ensure your project is healthy and maintainable. This dashboard analyzes your source structure to calculate your Overall Health, Maintainability, Complexity, and Technical Debt. It also automatically persists lightweight historical snapshots to visualize your project's evolution over time via interactive trend charts.

The built-in **Recommendation Engine** proactively flags:

* **Undefined Steps**: Identifies Gherkin steps that lack Python implementations.
* **Unused Steps**: Detects step definitions that are never referenced by any parsed `.feature` file in your workspace.
* **Duplicated Steps**: Finds identical Regex patterns declared in multiple files.
* **Ambiguous Steps**: Detects steps matching multiple overlapping Regex patterns.
* **Suspicious Similarities**: Highlights step definitions with very similar regex patterns (>85% similarity).
* **Oversized Scenarios**: Highlights overly complex scenarios that should be broken down.

Open the dashboard by running **Gherkin PowerTools: Show Gherkin Health** from the Command Palette.

*Note: This analyzes static source structure, not runtime test coverage or execution results.*
<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/dashboard.gif" alt="Interactive BDD source analytics and project health dashboard" width="600" />
</div>

### Step Refactoring
Gherkin PowerTools provides step refactoring operations accessible from the editor. All refactoring operations use VS Code's `WorkspaceEdit` API, which allows you to preview and undo all changes.

* **Rename Step (`F2` / `Cmd+Shift+R` on macOS)**: Renames the step text and updates all usages across `.feature` files and the Python decorator.
* **Extract Step (`Ctrl+.`)**: Select multiple Gherkin step lines and extract them to a new Python definition.

### Tag Impact Analysis
Hover over any tag to calculate exactly how many scenarios and example rows it affects across your workspace, helping you understand the execution scope before running tests.
<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-tags.gif" alt="Hover over a tag to see its impact across the workspace" width="600" />
</div>

---

## Additional Features

| Capability | Description |
| --- | --- |
| **Document Outline** | Navigate your file through a hierarchical view of Features, Rules, Scenarios, and Examples. |
| **Semantic Highlighting** | Enjoy a curated color palette for Gherkin keywords, tags, parameters, and tables. |
| **Command Center** | Access all extension capabilities from a single searchable quick-pick menu. |
| **Workspace Diagnostics** | Generate a health report of your environment, Python path, and discovered step files. |
| **Developer Metrics** | Track AST parsing performance, cache hit ratios, and parser failures in real-time. |
| **Gherkin Health Analysis** | Generate a comprehensive webview report to detect unused, duplicated, ambiguous, and suspiciously similar Python steps. |
| **Configuration Profiles** | Select from preset formatting rules (`strict`, `team`, `minimal`) to maintain consistency. |
| **Project Onboarding** | Benefit from automated detection and configuration suggestions for Behave projects. |

---

## Compatibility

**Framework-independent formatting and structural diagnostics** can be used with standard Gherkin `.feature` files across any compatible framework (e.g., Cucumber, SpecFlow, Karate).

**Python step navigation, generation, and execution** are designed specifically for Python Behave. The extension does not provide step definitions or execution integration for Cucumber.js, SpecFlow, or other frameworks.

Gherkin PowerTools is fully compatible with remote development environments, including WSL, SSH, GitHub Codespaces, and DevContainers.

---

## How Gherkin PowerTools Complements the Official Cucumber Extension

Gherkin PowerTools and the official Cucumber extension can be used together depending on your team's needs.

The official Cucumber extension provides generic Language Server Protocol (LSP) support, which is particularly beneficial for JavaScript and Java frameworks. Gherkin PowerTools focuses on deep Python Behave integration (execution, debugging, and step generation), as well as providing specialized Gherkin source analytics, AST-powered formatting, and tag impact analysis.

You can comfortably install and use both extensions side-by-side to get the best of both toolsets.

---

## Configuration

You can configure the extension in your VS Code settings, or commit a `.gherkin-powertoolsrc.json` to your project root to share formatting rules with your team:

```json
{
  "profile": "team",
  "behave": {
    "stepGlobs": [
      "**/steps/**/*.py",
      "**/features/steps/**/*.py",
      "**/integration_tests/steps/**/*.py"
    ]
  }
}
```

### Essential Settings

| Setting | Default | Description |
| --- | --- | --- |
| `gherkinPowerTools.profile` | `"custom"` | Formatting baseline: `strict`, `team`, `minimal`, `legacy`, or `custom`. |
| `gherkinPowerTools.behave.stepGlobs` | `["**/steps/**/*.py", "**/features/steps/**/*.py"]` | Glob patterns to locate Python step definitions. |
| `gherkinPowerTools.behave.ignoreGlobs` | `["**/node_modules/**", "**/.venv/**", ...]` | Paths to exclude from step indexing. |
| `gherkinPowerTools.behave.command` | `"behave"` | Base command for Test Explorer execution (e.g., `"poetry run behave"`). |

For a complete list of settings, visit the [Configuration Reference](https://carlos-camara.github.io/vscode-gherkin-powertools/configuration/).

---

## Documentation and Support

* 📖 **[Read the Full Documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/)**
* 💬 **[Join GitHub Discussions](https://github.com/carlos-camara/vscode-gherkin-powertools/discussions)**
* 🐛 **[Report an Issue](https://github.com/carlos-camara/vscode-gherkin-powertools/issues)**

---

## Contributing

Contributions are welcome! Please read the [Contributing Guide](https://github.com/carlos-camara/vscode-gherkin-powertools/blob/main/CONTRIBUTING.md) before submitting a pull request.

---

## License

Released under the [MIT License](https://github.com/carlos-camara/vscode-gherkin-powertools/blob/main/LICENSE) — © Carlos Camara.

<div align="center">

[![Version](https://vsmarketplacebadges.dev/version-short/carloscamara.vscode-gherkin-powertools.svg?style=flat-square&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.93-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://github.com/carlos-camara/vscode-gherkin-powertools/blob/main/LICENSE)

</div>
