<!-- markdownlint-disable MD041 MD033 -->

<div align="center">

<img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/logo-transparent.png" alt="Gherkin PowerTools logo" width="120" /><br/>

# Gherkin PowerTools

### The professional-grade BDD toolkit for VS Code

**From syntax highlighter to full IDE.** Format, validate, navigate, generate, run and debug Behave scenarios — all without leaving the editor.

<br/>

[![Install from Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Install%20Now-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools)

<br/>

[![Version](https://vsmarketplacebadges.dev/version-short/carloscamara.vscode-gherkin-powertools.svg?style=flat-square&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools)
[![Installs](https://vsmarketplacebadges.dev/installs-short/carloscamara.vscode-gherkin-powertools.svg?style=flat-square&color=28A745)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools)
[![Downloads](https://vsmarketplacebadges.dev/downloads-short/carloscamara.vscode-gherkin-powertools.svg?style=flat-square&color=8A2BE2)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.93-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://github.com/carlos-camara/vscode-gherkin-powertools/blob/main/LICENSE)

</div>

---

**Jump to:** [See it in action](#see-it-in-action) · [Why PowerTools?](#why-powertools) · [All Features](#features) · [Compatibility](#who-is-this-for) · [vs. Cucumber](#compared-to-cucumber-official) · [Quick Start](#quick-start) · [Configuration](#configuration) · [Full Docs](https://carlos-camara.github.io/vscode-gherkin-powertools/)

---

## See It in Action

<div align="center">

![Generate a Python step stub from undefined Gherkin — press Cmd+. and the function appears](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif)

*Write a step. See a warning. Press `⌘.` — the Python function appears in your `steps/` folder. No copy-pasting. No boilerplate.*

</div>

---

## Why PowerTools?

Most Gherkin extensions stop at syntax highlighting. **PowerTools goes all the way** — from formatting to debugging, from undefined step detection to workspace analytics.

| Pain point every QA engineer knows | How PowerTools eliminates it |
|---|---|
| "My tables are a mess and PRs have noisy whitespace diffs" | AST-powered formatter aligns everything in **one keystroke** |
| "I wrote a step but the Python function doesn't exist yet" | Real-time linter flags it. `⌘.` generates the stub instantly |
| "I don't know how many tests my `@regression` tag actually runs" | **Hover over any tag** to see the exact workspace-wide count |
| "Running one scenario means alt-tabbing to the terminal" | Click ▶ next to any Scenario or Example row. Done. |
| "Setting up step discovery for our monorepo took a full day" | The extension **auto-detects your Behave project** and configures itself |
| "Checking our test suite coverage means running Allure locally" | Open the **Statistics Dashboard** — it's built right in |

---

## Features

### ⚡ 1-Click Step Generation

Write a Gherkin step. The linter underlines it — the Python implementation is missing. Press `⌘.` / `Ctrl+.`. A valid Python stub with the correct decorator and extracted regex parameters appears in your `steps/` folder. No boilerplate. No copy-pasting.

> 📖 [Code Actions documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/code_actions.html)

---

### 🔭 Tag Blast Radius — Industry-First Feature

Hover over any `@tag`. PowerTools instantly calculates and displays **exactly how many Scenarios, Backgrounds, and Example rows** that tag affects across all your feature files. No more accidentally triggering a 500-test run when you meant to run 5.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-tags.gif" alt="Tag Blast Radius — hover over a tag, see exactly how many scenarios it covers workspace-wide" width="600" />
</div>

> 💡 **This feature exists in no other VS Code extension for Gherkin.**

> 📖 [Hover documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/hover.html)

---

### 📊 Workspace BDD Analytics — No Allure Required

Stop context-switching to external dashboards. PowerTools parses every `.feature` file and renders a **live analytics dashboard** with total features, scenarios, step breakdowns, tag frequency, and most-complex scenarios ranked by step count.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/dashboard.gif" alt="BDD Analytics Dashboard — workspace-wide metrics generated live from the Cucumber AST" width="600" />
</div>

> 📌 **No external tools. No CI pipeline. No Allure server. It lives inside VS Code.**

> 📖 [Statistics documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/statistics.html)

---

### 🚀 Native Test Explorer — Run & Debug from the Sidebar

Open the Testing panel (`⌘⇧T` / `Ctrl+Shift+T`). A live tree of every Feature, Rule, Scenario, and Example row appears — updated **as you type**, no save needed. Click ▶ to run, 🐞 to debug with full breakpoint and variable inspection support.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/run-demo.gif" alt="Run a Behave scenario from Test Explorer — live terminal output, pass/fail badges" width="600" />
</div>

**You can run:** entire Feature · individual Scenario · single Example row · all workspace tests at once.

> 📖 [Execution & Debugging documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/execution.html)

---

### 🛡️ Real-Time Linter — Catch Errors Before CI Does

A **dialect-aware AST linter** flags structural errors across **70+ Gherkin languages** as you type. Quick Fixes (`⌘.` / `Ctrl+.`) auto-correct the most common mistakes in one keystroke.

| What the linter catches | |
|---|---|
| Missing `:` on block keywords | `Feature`, `Scenario`, `Background`, `Examples`... |
| Misspelled keywords | Levenshtein-based smart suggestion |
| Wrong block structure | `Examples:` inside a plain `Scenario` |
| Malformed tables | Unclosed `\|` pipes, inconsistent column count |
| Undefined steps | No matching Python decorator found |
| Ambiguous steps | Multiple regex patterns match simultaneously |

> 📖 [Linter & Quick Fixes documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/linter.html)

---

### 🔍 IntelliSense & Navigation — Zero Config Required

As you type, PowerTools suggests matching steps from your Python backend — **context-aware by keyword**. `⌘+Click` / `Ctrl+Click` any step to jump to its Python decorator. Hover to preview the function signature and docstring without leaving the editor.

> 📖 [Go to Definition](https://carlos-camara.github.io/vscode-gherkin-powertools/features/definition.html) · [Hover](https://carlos-camara.github.io/vscode-gherkin-powertools/features/hover.html) · [IntelliSense](https://carlos-camara.github.io/vscode-gherkin-powertools/features/snippets.html)

---

### ✨ AST-Powered Formatter — Beautiful Gherkin, Every Time

Tables snap to the step text column. Tags wrap cleanly. Indentation is standardized across the whole file. **100% idempotent** — run it ten times, get the same result. Say goodbye to whitespace noise in pull requests.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/formatter.gif" alt="Formatter — aligns tables, wraps tags, and enforces indentation in one keystroke" width="600" />
</div>

Enable **Format on Save** for your whole team in two lines:

```json
// .vscode/settings.json
"[feature]": {
  "editor.defaultFormatter": "carloscamara.vscode-gherkin-powertools",
  "editor.formatOnSave": true
}
```

> 📖 [Formatter documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/formatter.html)

---

### And More...

| Feature | Description |
|---|---|
| 🎨 **Semantic Syntax Highlighting** | Curated colour palette for keywords, tags, parameters, and table cells — works on any VS Code theme |
| 🗂️ **Document Outline** | Collapsible Feature → Rule → Scenario → Example Row tree with breadcrumb navigation |
| 🤖 **Automated Onboarding** | Detects your Behave project on first open and configures step discovery in one click |
| 🎛️ **Command Center** | Searchable quick-pick for all extension capabilities — no shortcut memorization needed |
| 🩺 **Workspace Diagnostics** | Full structured health report — Python path, step files found, extension config status |

> 📖 [Full Demo Gallery](https://carlos-camara.github.io/vscode-gherkin-powertools/demos/)

---

## Who Is This For?

Gherkin PowerTools is built for **QA engineers, developers, and BDD teams** who write and maintain `.feature` files.

### Do I need Python or Behave?

**No.** The extension works in two tiers:

| Feature | Any `.feature` file | Python / Behave |
|---|:---:|:---:|
| AST-powered formatter | ✅ | ✅ |
| Real-time syntax linter (70+ dialects) | ✅ | ✅ |
| Keyword Quick Fixes | ✅ | ✅ |
| Range selection formatting | ✅ | ✅ |
| Semantic syntax highlighting | ✅ | ✅ |
| Outline & breadcrumb navigation | ✅ | ✅ |
| Workspace Analytics Dashboard | ✅ | ✅ |
| Tag Blast Radius hover | ✅ | ✅ |
| Step IntelliSense autocomplete | — | ✅ |
| Go to Python Definition | — | ✅ |
| Hover: function signature & docstring | — | ✅ |
| Scenario Outline parameter completion | — | ✅ |
| 1-Click Run & Debug (Test Explorer) | — | ✅ |
| Undefined step stub generator | — | ✅ |
| Automated project onboarding | — | ✅ |

Works seamlessly with: **Behave · Cucumber.js · Playwright BDD · SpecFlow · Karate** — and every other Gherkin-based framework.

> 🐳 **DevContainer & Remote ready.** Fully compatible with WSL, SSH, GitHub Codespaces, and DevContainers. Execution processes spawn inside the container; settings sync without data loss.

---

## Compared to Cucumber Official

Both extensions coexist peacefully and are complementary:

| Capability | Gherkin PowerTools | Official Cucumber |
|---|:---:|:---:|
| Table alignment (dynamic to step) | ✅ | ✅ Basic |
| Tag wrapping & sorting | ✅ | — |
| Real-time structural linting | ✅ AST-based, 70+ dialects | ✅ Syntax + undefined steps |
| Keyword Quick Fixes | ✅ | — |
| Semantic syntax highlighting | ✅ | ✅ |
| Hover: function signature & docstring | ✅ | — |
| **Hover: Tag Blast Radius** ← unique | ✅ | — |
| Scenario Outline `<param>` completion | ✅ | — |
| Outline & breadcrumb navigation | ✅ | ✅ |
| Python / Behave Go to Definition | ✅ First-class | — |
| 1-Click Run & Debug (Test Explorer) | ✅ Pass/fail badges, live tree | — |
| Custom Behave arguments | ✅ | — |
| **Workspace Analytics Dashboard** ← unique | ✅ | — |
| Automated onboarding & diagnostics | ✅ | — |
| Language Server Protocol (LSP) | — | ✅ (all frameworks) |

> 💡 **Pro tip:** Install both. PowerTools handles formatting, linting, Python/Behave navigation, execution, and analytics. The official Cucumber extension provides generic LSP support for JavaScript and Java frameworks.

---

## Quick Start

**1.** Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools).  
**2.** Open any `.feature` file — the extension activates instantly.  
**3.** Press <kbd>Shift+Alt+F</kbd> (<kbd>⇧⌥F</kbd> on macOS) to format your first file.

For Python/Behave projects, the onboarding engine handles everything else automatically.

### Key Shortcuts

| Action | macOS | Windows / Linux |
|---|---|---|
| Format Document | `⇧⌥F` | `Shift+Alt+F` |
| Format Selection | `⌘K ⌘F` | `Ctrl+K Ctrl+F` |
| Quick Fix (generate step / fix error) | `⌘.` | `Ctrl+.` |
| Go to Definition | `⌘Click` | `Ctrl+Click` / `F12` |
| Trigger Completion | `⌃Space` | `Ctrl+Space` |
| Open Test Explorer | `⌘⇧T` | `Ctrl+Shift+T` |
| Command Center | `⌘⇧P` → `Command Center` | `Ctrl+Shift+P` → `Command Center` |
| Diagnose Workspace | `⌘⇧P` → `Gherkin: Diagnose Workspace` | `Ctrl+Shift+P` → `Gherkin: Diagnose Workspace` |

---

## Configuration

Commit a `.gherkin-powertoolsrc.json` to your project root to share formatting and step discovery settings across your whole team:

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

### Key Settings

| Setting | Default | Description |
|---|---|---|
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

> 📖 [Full Configuration Reference](https://carlos-camara.github.io/vscode-gherkin-powertools/configuration/) · [Full Documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/)

---

## Contributing & License

Contributions are welcome! Please read the [Contributing Guide](https://github.com/carlos-camara/vscode-gherkin-powertools/blob/main/CONTRIBUTING.md) before submitting a pull request.

Released under the [MIT License](https://github.com/carlos-camara/vscode-gherkin-powertools/blob/main/LICENSE) — © [Carlos Camara](https://github.com/carlos-camara).
