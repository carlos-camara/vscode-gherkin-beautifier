# 🚀 Automated First-Run Onboarding

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/onboarding.gif" alt="Automated First-Run Onboarding Demo" width="700" />
</div>

Getting started with a new Behave project should be instant. Gherkin PowerTools **automatically detects your project structure** on first open, analyzes step coverage, and configures your workspace with a single click.

---

## ⚡ How It Works

When you open a workspace for the first time (or after a configuration reset), the extension silently runs in the background:

1. **Workspace inspection** — Scans all folders in your workspace for `.feature` files and Python files containing Behave decorators (`@given`, `@when`, `@then`, `@step`) or `environment.py`
2. **Gap analysis** — Compares discovered step files against the currently configured `gherkinPowerTools.behave.stepGlobs` patterns
3. **Smart recommendation** — If step files exist in locations not covered by the current globs, a **single, non-blocking notification** appears with actionable options

The notification only appears **once per workspace** — it does not repeat on every open unless you explicitly reset the onboarding state.

---

## 🛠️ 1-Click Resolution Actions

When the onboarding notification appears, you have three options:

| Action | What it does |
|--------|-------------|
| **⚙️ Settings** | Appends the detected step glob patterns directly to your `.vscode/settings.json` — workspace-scoped, so the team inherits the correct configuration automatically |
| **📄 Config File** | Generates or merges the recommended globs into a team-shared `.gherkin-powertoolsrc.json` at the workspace root. When creating a new file, automatically enables the `strict` formatting profile |
| **🩺 Diagnose** | Launches **Gherkin: Diagnose Workspace** to generate a full environment and configuration health report — useful when you want to understand the current state before making changes |

---

## 🔁 Re-Triggering Onboarding

If you dismissed the notification but want to run it again:

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run **`Gherkin: Diagnose Workspace`** — this surfaces the same configuration recommendations

---

## 🛡️ Zero-Config for Non-Behave Projects

Gherkin PowerTools works out of the box for **any Gherkin-based framework** — Cucumber.js, SpecFlow, Playwright BDD, pytest-bdd, or pure Gherkin files:

- The onboarding scanner detects the absence of Python step files and **suppresses all prompts automatically**
- All core features work with zero configuration: formatting, linting, syntax highlighting, tag hover, outline navigation, and IntelliSense
- No "noisy" setup dialogs for projects that don't need Behave-specific features

> **Tip:** For monorepos or multi-root workspaces, the onboarding engine analyzes each workspace folder independently — so mixed projects (some Python/Behave, some not) are handled correctly without false positives.
