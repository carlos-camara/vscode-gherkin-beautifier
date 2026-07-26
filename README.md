<!-- markdownlint-disable MD041 MD033 -->

<div align="center">

<img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/logo-transparent.png" alt="Gherkin PowerTools logo" width="120" /><br/>

# Gherkin PowerTools

**Write cleaner Gherkin. Catch errors earlier. Execute & Debug Behave scenarios in one click.**

AST-powered formatting, real-time validation, navigation, execution, debugging, and analytics for Gherkin projects — with first-class Python/Behave support.

<br/>

[![Install from Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Install-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools)
[![Version](https://vsmarketplacebadges.dev/version-short/carloscamara.vscode-gherkin-powertools.svg?style=flat-square&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools)
[![Installs](https://vsmarketplacebadges.dev/installs-short/carloscamara.vscode-gherkin-powertools.svg?style=flat-square&color=28A745)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools)
[![Downloads](https://vsmarketplacebadges.dev/downloads-short/carloscamara.vscode-gherkin-powertools.svg?style=flat-square&color=8A2BE2)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.93-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://github.com/carlos-camara/vscode-gherkin-powertools/blob/main/LICENSE)

</div>

---

**Jump to:** [Who is this for?](#who-is-this-for) · [Core Capabilities](#core-capabilities) · [Comparison](#compared-to-cucumber-official) · [Quick Start](#quick-start) · [Configuration](#configuration) · [Documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/)

---

## Primary Demo

<div align="center">

![Formatter demo — tables, tags and indentation aligned in one keystroke](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/formatter.gif)

*Format Document <kbd>⇧⌥F</kbd> — tables, tags and indentation aligned in one keystroke*

</div>

---

## Compatibility Matrix

| Feature | Any `.feature` file | Python / Behave | Notes |
|---------|:-------------------:|:---------------:|-------|
| Table & Tag Formatting | ✅ | ✅ | Cucumber, Playwright BDD, SpecFlow, Karate |
| Real-Time Syntax Diagnostics | ✅ | ✅ | 70+ languages via i18n `# language:` header |
| Keyword Quick Fixes | ✅ | ✅ | Inserts missing `:`, fixes typos, converts blocks |
| AST Range Selection Formatting | ✅ | ✅ | Format any selection, not just the whole file |
| Semantic Syntax Highlighting | ✅ | ✅ | Curated palette on top of any VS Code theme |
| Outline & Breadcrumb Navigation | ✅ | ✅ | Feature → Rule → Scenario → Example Row tree |
| Project Statistics Dashboard | ✅ | ✅ | Interactive HTML dashboard from Cucumber AST |
| Go to Definition | — | ✅ | Jump from step to Python `@given`/`@when`/`@then` |
| Step IntelliSense Autocomplete | — | ✅ | Context-aware by keyword; tab-through variables |
| Hover: Step Signature & Docstring | — | ✅ | Preview Python function signature and docstring |
| Hover: Tag Blast Radius | — | ✅ | Count of scenarios carrying each tag, workspace-wide |
| Run & Debug via Test Explorer | — | ✅ | Native sidebar — real-time tree, pass/fail badges, 1-click re-run |
| Undefined Step Stub Generator | — | ✅ | Generates Python function stub in your `steps/` folder |
| Scenario Outline `<param>` Completion | — | ✅ | Autocomplete column headers from Examples tables |

---

## Quick Start

1. Install **Gherkin PowerTools** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools).
2. Open any `.feature` file — the extension activates instantly.
3. Press <kbd>Shift+Alt+F</kbd> (<kbd>⇧⌥F</kbd> on macOS) to format your file.

* **⚡ Instant Activation:** Activates in O(1) time without blocking VS Code. Heavy workspace indexing (Python steps, feature file parsing) runs silently in background threads.
* **Automated Project Onboarding:** On first open of a Python Behave workspace, Gherkin PowerTools detects step files and offers 1-click workspace configuration — no manual JSON editing.
* **Zero-Config for Non-Behave Projects:** Pure Gherkin, Cucumber.js, Playwright BDD, and SpecFlow projects get formatting, linting, and statistics with zero configuration.
* **🐳 100% DevContainer & Remote Ready:** Fully compatible with VS Code Remote (WSL, SSH, GitHub Codespaces, DevContainers). Execution processes spawn inside containers; settings sync without data loss.

### Key Shortcuts

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Format Document | <kbd>⇧⌥F</kbd> | <kbd>Shift+Alt+F</kbd> |
| Format Selection | <kbd>⌘K ⌘F</kbd> | <kbd>Ctrl+K Ctrl+F</kbd> |
| Quick Fix | <kbd>⌘.</kbd> | <kbd>Ctrl+.</kbd> |
| Go to Definition | <kbd>⌘Click</kbd> | <kbd>Ctrl+Click</kbd> / <kbd>F12</kbd> |
| Trigger Completion | <kbd>⌃Space</kbd> | <kbd>Ctrl+Space</kbd> |
| Open Test Explorer | <kbd>⌘⇧T</kbd> | <kbd>Ctrl+Shift+T</kbd> |
| Command Center | <kbd>⌘⇧P</kbd> → `Command Center` | <kbd>Ctrl+Shift+P</kbd> → `Command Center` |
| Diagnose Workspace | Command Palette → `Gherkin: Diagnose Workspace` | Command Palette → `Gherkin: Diagnose Workspace` |

---

## Core Capabilities

### 1. 🎛️ Command Center

**Problem:** Discovering all extension capabilities requires memorizing command names and keyboard shortcuts.  
**Solution:** A unified searchable QuickPick menu gives you one-click access to Formatting, Execution, Diagnostics, Statistics, and Step Generation. Open via the Command Palette: `Gherkin PowerTools: Command Center`.

<div align="center">

![Command Center — all capabilities in one searchable menu](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/command-center.gif)

</div>

<sub>📖 [Command Center documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/command_center.html)</sub>

---

### 2. ⚡ AST-Powered Formatting

**Problem:** Misaligned table pipes, messy tags, and erratic indentation create noisy git diffs and slow down code reviews.  
**Solution:** Format Document rewrites your file using the official `@cucumber/gherkin` AST parser. Tables snap to the step text column, tags wrap cleanly, indentation is standardized. Formatting is 100% idempotent — run it multiple times, get the same result.

<div align="center">

![Formatter — aligns tables, wraps tags, enforces indentation](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/formatter.gif)

</div>

<sub>📖 [Formatter documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/formatter.html)</sub>

---

### 3. 🛡️ Real-Time Linter & Quick Fixes

**Problem:** A missing colon or misspelled keyword silently reaches CI and breaks the test pipeline.  
**Solution:** A **dialect-aware** AST linter flags structural errors across 70+ Gherkin languages as you type — no save required. One-click Quick Fixes (<kbd>Ctrl+.</kbd> / <kbd>⌘.</kbd>) auto-correct common mistakes instantly.

**What the linter catches:**
- Missing `:` on `Feature`, `Scenario`, `Scenario Outline`, etc.
- Misspelled Gherkin keywords (Levenshtein-based suggestion)
- `Examples:` inside a plain `Scenario` (wrong block structure)
- Malformed table rows (unclosed `|` pipes)
- Undefined steps with no matching Python decorator
- Ambiguous steps matching multiple regex patterns

<div align="center">

![Linter — real-time error detection as you type](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/linter.gif)

</div>

<div align="center">

![Quick Fix — auto-correct keyword typos and missing punctuation](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/auto-corrections.gif)

</div>

<sub>📖 [Linter & Quick Fixes documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/linter.html)</sub>

---

### 4. 🚀 1-Click Execution & Debugging (Test Explorer)

**Problem:** Context-switching between editor and terminal to run isolated scenarios or attach a debugger destroys focus.  
**Solution:** A native **VS Code Test Controller** populates the Testing sidebar (<kbd>⌘⇧T</kbd> / <kbd>Ctrl+Shift+T</kbd>) with a live, structured tree of all your `.feature` files. The tree updates **as you type** (400 ms debounce) — no save required.

**▶ Run** — streams live output to the Terminal; pass ✅ / fail ❌ badges appear after completion:

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/run-demo.gif" alt="Run a Behave scenario from Test Explorer — live terminal output, pass/fail badges" width="700" />
</div>

**🐞 Debug** — breakpoints, Variables panel, Call Stack, Debug Console — all native VS Code:

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/debug-demo.gif" alt="Debug a Behave scenario from Test Explorer — breakpoint hit, variables, call stack" width="700" />
</div>

**What you can run from the sidebar:**
- Entire Feature file
- Individual Scenario or Scenario Outline
- A single Example row from a parameterized table
- All tests in the workspace at once

**✏️ Edit Args** — set custom Behave flags (e.g. `--tags=@wip`, `-D env=staging`) before running, and choose to persist them or keep them volatile for the current session.

<sub>📖 [Execution & Debugging documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/execution.html)</sub>

---

### 5. 🔍 Python/Behave Navigation & IntelliSense

**Problem:** Finding the Python implementation behind a Gherkin step requires searching through step folders manually.  
**Solution:** <kbd>Cmd+Click</kbd> / <kbd>Ctrl+Click</kbd> any step to jump to its Python decorator. Get context-aware completions as you type and preview implementation details on hover — without leaving the editor.

**Go to Definition:**

<div align="center">

![Go to Definition — Cmd-click a step, land on the Python decorator](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/goto-definition.gif)

</div>

**Step IntelliSense — context-aware by keyword, tab-through variables:**

<div align="center">

![IntelliSense — type-ahead step completions from your Python step library](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/completion.gif)

</div>

**Hover: Python signature, docstring, and tag blast radius:**

<div align="center">

![Hover on a step — shows the Python function signature and docstring](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-step.gif)

</div>

<div align="center">

![Hover on a tag — shows the number of scenarios it affects workspace-wide](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-tags.gif)

</div>

<sub>📖 [Go to Definition](https://carlos-camara.github.io/vscode-gherkin-powertools/features/definition.html) · [Hover](https://carlos-camara.github.io/vscode-gherkin-powertools/features/hover.html) · [IntelliSense](https://carlos-camara.github.io/vscode-gherkin-powertools/features/snippets.html)</sub>

---

### 6. 📊 Workspace BDD Analytics

**Problem:** No quick way to assess the size, health, and distribution of your BDD suite.  
**Solution:** The Project Statistics dashboard compiles workspace metrics from the Cucumber AST: feature counts, total scenarios, effective test cases (expanded `Scenario Outline` rows), step coverage ratios, tag distribution, and most complex scenarios.

<div align="center">

![Project Statistics — workspace BDD metrics from the Cucumber AST](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/dashboard.gif)

</div>

<sub>📖 [Statistics documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/statistics.html) · [Full Visual Demo Gallery](https://carlos-camara.github.io/vscode-gherkin-powertools/demos.html)</sub>

---

### 7. 🤖 Zero-Configuration Onboarding & Diagnostics

**Problem:** Setting up step discovery paths for complex Python workspaces requires reading documentation and tweaking JSON.  
**Solution:** A silent background scanner detects Behave projects, analyzes coverage gaps, and offers to configure your workspace with 1 click — or generates a `.gherkin-powertoolsrc.json` for the whole team. Run deep diagnostics any time to troubleshoot setup issues.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/onboarding.gif" alt="Zero-Configuration Onboarding — 1-click workspace setup for Behave projects" width="600" />
</div>

<sub>📖 [Automated Onboarding](https://carlos-camara.github.io/vscode-gherkin-powertools/features/onboarding.html) · [Diagnostics](https://carlos-camara.github.io/vscode-gherkin-powertools/features/diagnostics.html)</sub>

---

## Who is this for?

Gherkin PowerTools is built for QA engineers, developers, and BDD teams working with Gherkin feature files.

### ❓ Do I need Behave / Python?

**No.**

* **Any `.feature` file (Cucumber.js, Playwright BDD, SpecFlow, Karate, etc.):**  
  Zero-configuration AST-based formatting, real-time syntax linting, 70+ language i18n support, range selection formatting, tag telemetry, syntax highlighting, outline navigation, and workspace statistics work out-of-the-box for **every** Gherkin project.

* **Python / Behave workspaces:**  
  Unlocks deep step definition indexing (Go to Definition, Hover, IntelliSense), undefined step detection, missing step stub generator, and 1-click test Execution & Debugging via the Test Explorer.

---

## Compared to Cucumber Official

Both extensions coexist peacefully and serve complementary purposes:

| Capability | Gherkin PowerTools | Official Cucumber |
|-----------|:-----------------:|:-----------------:|
| Table alignment (dynamic to step) | ✅ | ✅ Basic |
| Tag wrapping & sorting | ✅ | — |
| Real-time structural linting | ✅ AST-based, 70+ dialects | ✅ Syntax + undefined steps |
| Keyword Quick Fixes | ✅ | — |
| Hover: function signature & docstring | ✅ | — |
| Hover: tag blast radius | ✅ | — |
| Scenario Outline `<param>` completion | ✅ | — |
| Python / Behave Go to Definition | ✅ First-class | — |
| 1-Click Run & Debug (Test Explorer) | ✅ Pass/fail badges, real-time tree | — |
| Custom Arguments (Edit & Run) | ✅ | — |
| Workspace Statistics Dashboard | ✅ | — |
| Automated Onboarding | ✅ | — |
| Language Server Protocol (LSP) | — | ✅ (all frameworks) |

> **Pro tip:** Install both! Gherkin PowerTools handles formatting, linting, Python/Behave navigation, execution, and analytics. The Official Cucumber extension provides generic LSP support for JavaScript and Java frameworks.

---

## Configuration

Share formatting and step discovery settings across your team by committing a `.gherkin-powertoolsrc.json` to your project root:

```json
{
  "profile": "strict",
  "indentation": { "steps": 4 },
  "tags": { "format": "wrap", "sort": "alphabetical" },
  "behave": {
    "stepGlobs": ["**/steps/**/*.py", "**/features/steps/**/*.py"],
    "command": "behave"
  }
}
```

Enable **Format on Save** for the whole team:

```json
// .vscode/settings.json
"[feature]": {
  "editor.defaultFormatter": "carloscamara.vscode-gherkin-powertools",
  "editor.formatOnSave": true
}
```

### Key Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gherkinPowerTools.profile` | `"custom"` | Base formatting profile: `strict`, `team`, `minimal`, `legacy` |
| `gherkinPowerTools.indentation.steps` | `4` | Spaces to indent step keywords |
| `gherkinPowerTools.tables.alignToKeyword` | `true` | Align table pipes to the preceding step text column |
| `gherkinPowerTools.tags.format` | `"wrap"` | `"wrap"` or `"singleLine"` tag layout |
| `gherkinPowerTools.tags.sort` | `"preserve"` | `"preserve"` or `"alphabetical"` tag ordering |
| `gherkinPowerTools.emptyLines.betweenScenarios` | `1` | Blank lines enforced between Scenario blocks |
| `gherkinPowerTools.behave.stepGlobs` | `["**/steps/**/*.py", …]` | Glob patterns for Python step file discovery |
| `gherkinPowerTools.behave.ignoreGlobs` | `["**/node_modules/**", …]` | Paths excluded from step indexing |
| `gherkinPowerTools.behave.command` | `"behave"` | Base Behave command (e.g. `"poetry run behave"`) |
| `gherkinPowerTools.behave.additionalArguments` | `[]` | Extra flags added to every Behave invocation |

📖 [Full Configuration Reference](https://carlos-camara.github.io/vscode-gherkin-powertools/configuration/) · [Full Documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/)

---

## Contributing & License

Contributions are welcome! Please read the [Contributing Guide](https://github.com/carlos-camara/vscode-gherkin-powertools/blob/main/CONTRIBUTING.md) before submitting a pull request.

Released under the [MIT License](https://github.com/carlos-camara/vscode-gherkin-powertools/blob/main/LICENSE) — © [Carlos Camara](https://github.com/carlos-camara).
