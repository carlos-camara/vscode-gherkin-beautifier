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

**Jump to:** [See it in action](#see-it-in-action) · [Why PowerTools?](#why-powertools) · [All Features](#features-that-set-us-apart) · [Compatibility](#who-is-this-for) · [vs. Cucumber](#compared-to-cucumber-official) · [Quick Start](#quick-start) · [Configuration](#configuration) · [Full Docs](https://carlos-camara.github.io/vscode-gherkin-powertools/)

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

## Features That Set Us Apart

### ⚡ 1-Click Step Generation — The "Aha!" Moment

Write a Gherkin step. The linter underlines it — the Python implementation is missing. Press `⌘.` / `Ctrl+.`. Done: a valid Python stub with the correct decorator and extracted regex parameters appears in your `steps/` folder. No boilerplate. No copy-pasting from documentation.

<div align="center">

![Step Generation — press Cmd+. on an undefined step to get a Python stub instantly](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif)

</div>

<sub>📖 [Code Actions documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/code_actions.html)</sub>

---

### 🔭 Tag Blast Radius — Industry-First Feature

Hover over any `@tag`. PowerTools instantly calculates and displays **exactly how many Scenarios, Backgrounds, and Example rows** that tag affects across all your feature files. No more accidentally triggering a 500-test run when you meant to run 5.

<div align="center">

![Tag Blast Radius — hover over a tag, see exactly how many scenarios it covers workspace-wide](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-tags.gif)

</div>

> 💡 **This feature exists in no other VS Code extension for Gherkin.**

<sub>📖 [Hover documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/hover.html)</sub>

---

### 📊 Workspace BDD Analytics — No Allure Required

Stop context-switching to external dashboards just to understand the size and health of your test suite. PowerTools parses every `.feature` file in your workspace and renders a **live analytics dashboard** with:

- Total Features, Scenarios, Scenario Outlines, and **effective test cases** (expanded Example rows)
- Step breakdown by type: Given / When / Then / And / But
- Tag frequency distribution
- Most repeated steps and most complex scenarios ranked by step count

<div align="center">

![BDD Analytics Dashboard — workspace-wide metrics generated live from the Cucumber AST](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/dashboard.gif)

</div>

> 📌 **No external tools. No CI pipeline. No Allure server. It lives inside VS Code.**

<sub>📖 [Statistics documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/statistics.html)</sub>

---

### 🚀 Native Test Explorer — Run & Debug from the Sidebar

Open the Testing panel (`⌘⇧T` / `Ctrl+Shift+T`). A structured live tree of every Feature, Rule, Scenario, and Example row appears — updated **as you type**, no save needed.

**▶ Run** — streams live output to the Terminal; pass ✅ / fail ❌ badges update after completion:

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/run-demo.gif" alt="Run a Behave scenario from Test Explorer — live terminal output, pass/fail badges" width="700" />
</div>

<br/>

**🐞 Debug** — hit breakpoints, inspect Variables, navigate the Call Stack, use the Debug Console — all native VS Code:

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/debug-demo.gif" alt="Debug a Behave scenario from Test Explorer — breakpoint hit, variables, call stack" width="700" />
</div>

**What you can run from the sidebar:** entire Feature · individual Scenario · single Example row from a parameterized table · all tests in the workspace at once.

**✏️ Custom Args** — set Behave flags (`--tags=@wip`, `-D env=staging`) before running. Keep them volatile for the current session or persist them for the team.

<sub>📖 [Execution & Debugging documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/execution.html)</sub>

---

### 🛡️ Real-Time Linter — Catch Errors Before CI Does

A **dialect-aware AST linter** flags structural errors across **70+ Gherkin languages** as you type. No save required. Quick Fixes (`⌘.` / `Ctrl+.`) auto-correct the most common mistakes in one keystroke.

**What the linter catches:**

- Missing `:` on `Feature`, `Scenario`, `Scenario Outline`, `Rule`, `Background`, `Examples`
- Misspelled Gherkin keywords (Levenshtein-based smart suggestion)
- `Examples:` block inside a plain `Scenario` (wrong block structure)
- Malformed table rows (unclosed `|` pipes, inconsistent column count)
- Undefined steps with no matching Python decorator
- Ambiguous steps matching multiple regex patterns simultaneously

<div align="center">

![Linter — flags structural Gherkin errors in real-time, before you even save](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/linter.gif)

</div>

<div align="center">

![Quick Fix — auto-corrects missing colons, keyword typos, and malformed blocks](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/auto-corrections.gif)

</div>

<sub>📖 [Linter & Quick Fixes documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/linter.html)</sub>

---

### 🔍 IntelliSense & Navigation — Zero Config Required

As you type, PowerTools suggests matching steps from your Python backend — **context-aware by keyword** (Given suggestions only appear while writing a Given line). `⌘+Click` / `Ctrl+Click` any step to jump to its Python decorator. Hover to preview the implementation without leaving the editor.

**Step IntelliSense — context-aware, tab-through variables:**

<div align="center">

![IntelliSense — type-ahead step completions from your Python step library, context-aware by keyword](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/completion.gif)

</div>

**Go to Definition — `⌘+Click` any step:**

<div align="center">

![Go to Definition — Cmd-click a Gherkin step and land directly on the Python decorator](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/goto-definition.gif)

</div>

**Hover — preview the Python function signature and docstring:**

<div align="center">

![Hover on a step — shows the Python function signature, regex, and docstring inline](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/hover-step.gif)

</div>

**Scenario Outline parameter completion — type `<` to autocomplete column headers:**

<div align="center">

![Outline parameter completion — type < inside a step to get column headers from the Examples table](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/outline-completion.gif)

</div>

> 🔑 **No language server setup. No `settings.json` tweaking. IntelliSense works the moment you open your project.**

<sub>📖 [Go to Definition](https://carlos-camara.github.io/vscode-gherkin-powertools/features/definition.html) · [Hover](https://carlos-camara.github.io/vscode-gherkin-powertools/features/hover.html) · [IntelliSense](https://carlos-camara.github.io/vscode-gherkin-powertools/features/snippets.html)</sub>

---

### ✨ AST-Powered Formatter — Beautiful Gherkin, Every Time

Tables snap to the step text column. Tags wrap cleanly. Indentation is standardized across the whole file. **100% idempotent** — run it ten times, get the same result. Say goodbye to whitespace noise in pull requests.

<div align="center">

![Formatter — aligns tables, wraps tags, and enforces indentation in one keystroke](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/formatter.gif)

</div>

Enable **Format on Save** for your whole team in two lines:

```json
// .vscode/settings.json
"[feature]": {
  "editor.defaultFormatter": "carloscamara.vscode-gherkin-powertools",
  "editor.formatOnSave": true
}
```

<sub>📖 [Formatter documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/formatter.html)</sub>

---

### 🎨 Semantic Syntax Highlighting

A curated colour palette layers on top of **any VS Code theme** — keywords, tags, parameters, doc strings, and table cells each get a distinct, readable colour without overwhelming the eye.

<div align="center">

![Syntax Highlighting — semantic colour palette that works on top of any VS Code theme](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/highlighting.gif)

</div>

<sub>📖 [Highlighting documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/highlighting.html)</sub>

---

### 🗂️ Document Outline & Breadcrumb Navigation

The VS Code Outline panel shows a collapsible **Feature → Rule → Scenario → Example Row** tree. Use breadcrumbs to jump instantly to any block in large feature files.

<div align="center">

![Outline — Feature, Rule, Scenario, and Example Row tree in the VS Code sidebar](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/outline.gif)

</div>

<sub>📖 [Outline documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/outline.html)</sub>

---

### 🤖 Zero-Config Automated Onboarding

Open a Python/Behave project for the first time. PowerTools silently scans the workspace, detects your step files, and **offers to configure everything automatically** — with a single click. No JSON editing. No documentation diving.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/onboarding.gif" alt="Automated onboarding — PowerTools detects a Behave project and configures the workspace in one click" width="600" />
</div>

<sub>📖 [Automated Onboarding](https://carlos-camara.github.io/vscode-gherkin-powertools/features/onboarding.html) · [Diagnostics](https://carlos-camara.github.io/vscode-gherkin-powertools/features/diagnostics.html)</sub>

---

### 🎛️ Command Center — Everything in One Place

Forget memorizing keyboard shortcuts. Open the Command Center (`⌘⇧P` → `Command Center`) for instant, searchable access to Formatting, Execution, Statistics, Diagnostics, and Step Generation.

<div align="center">

![Command Center — all capabilities in one searchable quick-pick menu](https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/command-center.gif)

</div>

<sub>📖 [Command Center documentation](https://carlos-camara.github.io/vscode-gherkin-powertools/features/command_center.html)</sub>

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
|-----------|:-----------------:|:-----------------:|
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

> **Pro tip:** Install both. PowerTools handles formatting, linting, Python/Behave navigation, execution, and analytics. The official Cucumber extension provides generic LSP support for JavaScript and Java frameworks.

---

## Quick Start

**1.** Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-powertools).  
**2.** Open any `.feature` file — the extension activates instantly.  
**3.** Press <kbd>Shift+Alt+F</kbd> (<kbd>⇧⌥F</kbd> on macOS) to format your first file.

For Python/Behave projects, the onboarding engine handles everything else automatically.

### Key Shortcuts

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Format Document | <kbd>⇧⌥F</kbd> | <kbd>Shift+Alt+F</kbd> |
| Format Selection | <kbd>⌘K ⌘F</kbd> | <kbd>Ctrl+K Ctrl+F</kbd> |
| Quick Fix (generate step / fix error) | <kbd>⌘.</kbd> | <kbd>Ctrl+.</kbd> |
| Go to Definition | <kbd>⌘Click</kbd> | <kbd>Ctrl+Click</kbd> / <kbd>F12</kbd> |
| Trigger Completion | <kbd>⌃Space</kbd> | <kbd>Ctrl+Space</kbd> |
| Open Test Explorer | <kbd>⌘⇧T</kbd> | <kbd>Ctrl+Shift+T</kbd> |
| Command Center | <kbd>⌘⇧P</kbd> → `Command Center` | <kbd>Ctrl+Shift+P</kbd> → `Command Center` |
| Diagnose Workspace | Command Palette → `Gherkin: Diagnose Workspace` | Command Palette → `Gherkin: Diagnose Workspace` |

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
