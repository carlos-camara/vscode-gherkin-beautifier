<div align="center">
  <img src="assets/logo.png" alt="Gherkin Beautifier Logo" width="96" />
  <h1>Gherkin Beautifier</h1>
  <p><strong>The ultimate formatting & productivity suite for Gherkin and BDD inside VS Code.</strong></p>

  [![Lint](https://github.com/carlos-camara/vscode-gherkin-beautifier/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/carlos-camara/vscode-gherkin-beautifier/actions/workflows/lint.yml)
  [![Release](https://img.shields.io/badge/Release-v1.5.0-brightgreen)](https://github.com/carlos-camara/vscode-gherkin-beautifier/releases)
  [![Docs](https://img.shields.io/badge/Docs-GitHub%20Pages-blue)](https://carlos-camara.github.io/vscode-gherkin-beautifier/)
  [![VS Code Marketplace](https://img.shields.io/badge/VS%20Marketplace-v1.5.0-0078d7)](https://marketplace.visualstudio.com/items?itemName=carloscamara.vscode-gherkin-beautifier)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
</div>

---

## What is Gherkin Beautifier?

**Gherkin Beautifier** is a meticulously crafted VS Code extension for teams using Behavior-Driven Development (BDD). It transforms messy `.feature` files into perfectly aligned, readable, and deeply integrated specifications — with zero configuration required.

Works seamlessly with **Cucumber**, **Behave**, **SpecFlow**, and any other Gherkin-based BDD framework.

---

## ✨ Features at a Glance

| | Feature | Description |
|---|---------|-------------|
| 🎨 | **Intelligent Formatter** | Auto-indentation, table alignment, auto-casing, tag wrapping |
| 🔍 | **Live Diagnostics** | Real-time syntax validation as you type |
| 🧭 | **Go To Definition** | `Cmd+Click` to jump from `.feature` to Python step definitions |
| 📊 | **Statistics Dashboard** | Visual metrics across your entire BDD workspace |
| 🌐 | **i18n Support** | English, Spanish, French & German keywords |
| 🎨 | **Syntax Highlighting** | Curated color palette for dark themes |
| 📝 | **Snippets** | Autocompletion for `feature`, `scenario`, `outline`, `rule` |

---

## 🎨 Intelligent Formatter

Say goodbye to manual spacing. The formatter parses your Gherkin syntax and aligns it automatically.

- **Smart Table Alignment** — Tables dynamically align to the text of the preceding step keyword
- **Auto-Casing** — Capitalizes keywords (`given` → `Given`) across 10+ languages
- **Tag Wrapping** — Wraps long `@tag` lists beyond 80 characters
- **Strict Flat Indentation** — Consistent alignment for all step types

![Formatter Demonstration](assets/formatter.webp)

---

## 🔍 Live Diagnostics (Linter)

The built-in linter monitors your `.feature` files in real-time. Errors are underlined immediately — no need to run your tests to catch syntax mistakes.

- Detects missing colons (e.g., `Scenario` → `Scenario:`)
- Flags misspelled or invalid Gherkin keywords
- Integrates with VS Code's **Problems panel** and **gutter indicators**

![Linter Demonstration](assets/linter.webp)

---

## 🧭 Go To Definition

`Cmd+Click` (or `F12`) on any step like `Given I login` to instantly jump to the matching Python decorator in your `steps/` folder.

```gherkin
# .feature file
Given I login as "admin"
```

```python
# steps/auth_steps.py  ← jumps here automatically
@given('I login as "{user}"')
def step_login(context, user):
    ...
```

![Go To Definition](assets/definition.webp)

---

## 📊 BDD Project Dashboard

Right-click inside any `.feature` file → **Gherkin: Show Project Statistics** to open an interactive HTML metrics dashboard across your entire workspace.

![Dashboard Demonstration](assets/dashboard.webp)

---

## 🎨 Syntax Highlighting

Replaces VS Code's default colors with a curated palette that looks stunning on dark themes:

| Category | Keywords | Color |
|----------|----------|-------|
| Structure | `Feature`, `Scenario`, `Rule` | Purple `#C586C0` |
| Actions | `Given`, `When`, `Then` | Blue `#569CD6` |
| Tags | `@smoke`, `@api` | Cyan `#4EC9B0` |

![Syntax Highlighting](assets/highlighting.webp)

---

## ⚙️ Configuration

Works perfectly out-of-the-box. Fine-tune it via `settings.json`:

| Setting | Default | Description |
|---------|:-------:|-------------|
| `gherkinBeautifier.indentation.steps` | `4` | Spaces to indent steps |
| `gherkinBeautifier.tables.alignToKeyword` | `true` | Align tables to preceding step text |
| `gherkinBeautifier.emptyLines.betweenScenarios` | `1` | Blank lines between Scenario blocks |
| `gherkinBeautifier.tags.format` | `"wrap"` | `"wrap"` or `"singleLine"` for long tag lists |

### Enable Format on Save

```json
"[feature]": {
    "editor.defaultFormatter": "carloscamara.vscode-gherkin-beautifier",
    "editor.formatOnSave": true
}
```

---

## 🚀 Installation

1. Open VS Code and navigate to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for **"Gherkin Beautifier"**
3. Click **Install**

Or install from a `.vsix` file:
```bash
code --install-extension gherkin-beautifier-1.5.0.vsix
```

---

## 🗺️ Roadmap

| Status | Feature |
|--------|---------|
| 🔜 | **Test Explorer** — Run scenarios with a Play button directly from the editor |
| 🔜 | **IntelliSense Autocomplete** — Step suggestions as you type |
| 🔜 | **Quick Fixes** — Auto-generate missing Python step definitions with `Cmd+.` |

---

## 🤝 Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, coding guidelines, and how to submit Pull Requests.

## 📄 License

MIT © [Carlos Camara](https://github.com/carlos-camara)

---

<div align="center">
  <sub>Crafted by <a href="https://github.com/carlos-camara"><strong>Carlos Camara</strong></a></sub>
</div>
