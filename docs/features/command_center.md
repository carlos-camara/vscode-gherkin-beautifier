# 🛠️ Command Center

Stop hunting through menus and memorizing keyboard shortcuts. The **Command Center** is a unified, searchable QuickPick interface that surfaces every Gherkin PowerTools capability from one place.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/command-center.gif" alt="Command Center" width="700" />
</div>

---

## ⚡ How to Open

| Platform | Shortcut |
|----------|----------|
| **macOS** | <kbd>Cmd+Shift+P</kbd> → type `Gherkin PowerTools: Command Center` |
| **Windows / Linux** | <kbd>Ctrl+Shift+P</kbd> → type `Gherkin PowerTools: Command Center` |

---

## 📋 Available Actions

### 🎨 Formatting

| Action | Description |
|--------|-------------|
| **Format Document** | Reformat the entire active `.feature` file using the full Cucumber AST engine — indentation, tables, tags, and blank lines normalized in one pass. |
| **Format Selection** | Reformat only the highlighted range, respecting AST node boundaries. |

### ▶️ Execution

| Action | Description |
|--------|-------------|
| **Run Feature** | Execute the entire active `.feature` file via a VS Code Task using `behave <path>`. Live output streams to the Terminal panel. |
| **Run Scenario** | Execute only the scenario at the current cursor position by passing its line number to Behave: `behave <path>:<line>`. |
| **Debug Feature** | Launch the entire feature in a `debugpy` debug session. Breakpoints in Python step files are respected — Variables, Call Stack, and Debug Console all available. |
| **Debug Scenario** | Launch only the scenario at the cursor in a `debugpy` debug session. |
| **Edit & Run** | Open the **custom arguments dialog** before running. Enter extra Behave flags (e.g. `--tags=@wip`, `-D env=staging`) and choose to save them to Workspace Settings or keep them for the current session only. |

### 🛠️ Step Definitions

| Action | Description |
|--------|-------------|
| **Go to Definition** | Navigate from any Gherkin step to its Python `@given`, `@when`, or `@then` decorator. Resolves `And`/`But` chains by context. |
| **Create Step Definition** | Generate a Python stub for the undefined step at the cursor, placed in your `steps/` folder. |

### 📊 Analysis

| Action | Description |
|--------|-------------|
| **Show Project Statistics** | Open the interactive BDD Analytics Dashboard — scenario counts, tag distribution, step coverage, and more. |
| **Diagnose Workspace** | Run a full diagnostic: step cache status, glob coverage, Python interpreter, extension health, and configuration errors. Output appears in the `Gherkin Diagnostics` Output Channel. |

### ⚙️ Configuration

| Action | Description |
|--------|-------------|
| **Open Extension Settings** | Open VS Code Settings pre-filtered to the `gherkinPowerTools` namespace — all options in one place. |

---

## 💡 Why Use It?

- **Discoverability** — No need to remember command names or keyboard shortcuts. Every capability is one search away.
- **Keyboard-first** — Navigate the QuickPick with arrow keys and confirm with <kbd>Enter</kbd>. No mouse required.
- **Context-aware** — Execution commands automatically target the currently active `.feature` file and the cursor's current position.
- **Single entry point** — Ideal for new team members who need to learn what the extension can do without reading documentation.

> **Tip:** Every action in the Command Center is also available as a standalone VS Code command. You can bind any of them to a custom keyboard shortcut via **Keyboard Shortcuts** (<kbd>Cmd+K Cmd+S</kbd> / <kbd>Ctrl+K Ctrl+S</kbd>).
