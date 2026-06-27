# Gherkin Beautifier for VS Code


A comprehensive, highly professional formatting extension for Visual Studio Code designed to format, align, and organize Gherkin (`.feature`) files. It ensures that your Behavioral Driven Development (BDD) documentation remains clean, readable, and standardized across your entire team.

---

## Comprehensive Feature Set

### 1. Advanced Formatting Engine
* **Native VS Code Integration**: Integrates directly with the VS Code formatting API. You can format via the standard `Shift+Alt+F` shortcut, the Command Palette, or the right-click context menu ("Format Gherkin Document").
* **Multi-language Support (i18n)**: Fully supports formatting, indenting, and auto-casing keywords in **English**, **Spanish** (`Dado`, `Cuando`, `Escenario`), **French** (`Soit`, `Quand`, `Scénario`), and **German** (`Angenommen`, `Wenn`, `Szenario`).
<div align="center">
  <img src="https://raw.githubusercontent.com/carloscamara/vscode-gherkin-beautifier/main/assets/logo.png" alt="Gherkin Beautifier Logo" width="128" />
  <h1>Gherkin Beautifier</h1>
  <p><em>The ultimate, professional formatting and productivity suite for Gherkin and BDD inside VS Code.</em></p>
</div>

---

## 🌟 Overview

**Gherkin Beautifier** is a meticulously crafted extension designed for teams using Behavior-Driven Development (BDD). It transforms chaotic `.feature` files into perfectly aligned, highly readable, and deeply integrated specifications.

Whether you're using **Cucumber**, **Behave**, or any other BDD framework, Gherkin Beautifier supercharges your workflow with a native formatter, an interactive statistics dashboard, a real-time syntax linter, and seamless Python integration.

---

## 🔥 Core Features

### 1. Intelligent Formatter
Say goodbye to manual spacing. The robust AST-based formatter parses your Gherkin syntax and aligns it automatically.
- **Strict Flat Indentation**: Enforces consistent alignment where all steps (`Given`, `When`, `Then`, `And`) share the exact same starting column.
- **Smart Table Alignment**: Data tables (Pipes `|`) dynamically pad themselves to align perfectly with the keyword of the preceding step.
- **Auto-Casing**: Automatically capitalizes Gherkin keywords (`given` → `Given`) while supporting over 10 languages (English, Spanish, French, German, etc.).
- **Tag Wrapping**: Keeps your files clean by intelligently wrapping long `@tags` lists that exceed 80 characters.

![Formatter Demonstration](https://raw.githubusercontent.com/carloscamara/vscode-gherkin-beautifier/main/assets/formatter.gif)

### 2. Live Diagnostics (Linter)
Writing Gherkin should be error-free before you even run the tests.
- Real-time syntax validation.
- Detects missing colons (e.g., `Scenario` instead of `Scenario:`).
- Highlights structural errors in red, ensuring your keywords are perfectly formed.

![Linter Demonstration](https://raw.githubusercontent.com/carloscamara/vscode-gherkin-beautifier/main/assets/linter.gif)

### 3. Editor Productivity & Navigation
- **Go To Definition (Behave / Python)**: Instantly jump from a `.feature` file to the exact Python definition. `Cmd + Click` (or `F12`) on a step like `Given I login`, and VS Code will search your `steps/` folder to find the matching `@given('I login')` decorator.
- **Native Outline View**: Navigating massive `.feature` files is now a breeze. The extension contributes a hierarchical tree view to VS Code's Outline panel, breaking down your document into `Feature` > `Rule` > `Scenario`.

![Go To Definition](https://raw.githubusercontent.com/carloscamara/vscode-gherkin-beautifier/main/assets/definition.gif)

### 4. BDD Project Dashboard
- **Statistics Webview**: Right-click anywhere in a `.feature` file (or use the Command Palette) to open the **Gherkin: Show Project Statistics** dashboard. 
- Get instant, beautiful HTML metrics detailing how many Features, Rules, and Scenarios you have across your entire workspace, including unsaved buffers!

![Dashboard Demonstration](https://raw.githubusercontent.com/carloscamara/vscode-gherkin-beautifier/main/assets/dashboard.gif)

### 5. Professional Syntax Highlighting
Replaces glaring, standard colors with a curated palette that looks absolutely stunning on dark themes (like Dark+):
- **Structure** (`Feature`, `Scenario`): Elegant Purple (`#C586C0`).
- **Actions** (`Given`, `When`): Crisp Blue (`#569CD6`).
- **Tags** (`@smoke`): Soft Cyan (`#4EC9B0`).

![Syntax Highlighting](https://raw.githubusercontent.com/carloscamara/vscode-gherkin-beautifier/main/assets/highlighting.png)

---

## ⚙️ Configuration

Gherkin Beautifier works perfectly out-of-the-box, but you can tailor it to your team's style guide via your `settings.json`:

| Setting | Default | Description |
|---------|---------|-------------|
| `gherkinBeautifier.indentation.steps` | `4` | Number of spaces to indent all steps (`Given`, `When`, `Then`, `And`, `But`). |
| `gherkinBeautifier.tables.alignToKeyword` | `true` | If enabled, tables dynamically pad their left border to match the text length of the preceding step. |
| `gherkinBeautifier.emptyLines.betweenScenarios` | `1` | Enforces the exact number of blank lines between `Scenario` and `Rule` blocks. |
| `gherkinBeautifier.tags.format` | `"wrap"` | Choose `"wrap"` to split long tags across lines, or `"singleLine"` to keep them contiguous. |

---

## 🚀 Installation & Usage

1. Open Visual Studio Code.
2. Navigate to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Search for **"Gherkin Beautifier"**.
4. Click **Install**.

### Pro-Tip for Auto-Formatting
To unleash the full power of the extension, we highly recommend enabling "Format on Save" in your VS Code settings specifically for Gherkin files:

```json
"[feature]": {
    "editor.defaultFormatter": "carloscamara.vscode-gherkin-beautifier",
    "editor.formatOnSave": true
}
```

---

## 💡 Future Roadmap

We are constantly innovating. Here's a sneak peek of what's coming:
- **Test Explorer Integration**: Run specific scenarios with a "Play" button directly from the editor.
- **IntelliSense Autocomplete**: Dropdown suggestions for all available Python steps as you type.
- **Quick Fixes**: Automatically generate missing Python step snippets with `Cmd + .`.

---

<div align="center">
  Crafted with ❤️ by <strong>Carlos Camara</strong>
</div>

## Contributing
We welcome contributions from the community. Please review [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed instructions on how to set up the repository locally, run the comprehensive test suite, build the `.vsix` package from source, and submit Pull Requests.

## License
This project is open-source and licensed under the MIT License. See the [LICENSE](./LICENSE) file for full details.
