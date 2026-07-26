# 🛠️ Command Center

Stop hunting through menus and memorizing keyboard shortcuts. The **Command Center** is a unified interactive QuickPick menu that surfaces every Gherkin PowerTools capability from a single, searchable interface.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/command-center.gif" alt="Command Center" width="600" />
</div>

---

## ⚡ How to Open

1. Open the VS Code Command Palette:
   - **macOS:** <kbd>Cmd+Shift+P</kbd> (<kbd>⌘⇧P</kbd>)
   - **Windows / Linux:** <kbd>Ctrl+Shift+P</kbd>
2. Type **`Gherkin PowerTools: Command Center`** and press **Enter**.

---

## 📋 Available Actions

The Command Center groups all capabilities into the following categories:

### 🎨 Formatting
| Action | Description |
|--------|-------------|
| **Format Document** | Formats the entire active `.feature` file using the AST-powered engine. |
| **Format Selection** | Formats only the highlighted selection, respecting AST node boundaries. |

### ▶️ Execution
| Action | Description |
|--------|-------------|
| **Run Feature** | Executes the entire active `.feature` file with Behave via a VS Code Task. |
| **Run Scenario** | Executes the scenario at the current cursor position via its line number. |
| **Debug Feature** | Launches the active `.feature` file in the VS Code Python debugger. |
| **Debug Scenario** | Attaches the Python debugger to the scenario at the current cursor position. |
| **Edit & Run** | Opens an interactive argument editor before executing, letting you customize flags for the current session or save them permanently. |

### 🛠️ Step Definitions
| Action | Description |
|--------|-------------|
| **Go to Definition** | Navigates to the Python `@given`/`@when`/`@then` decorator matching the step at the cursor. |

### 📊 Analysis
| Action | Description |
|--------|-------------|
| **Show Project Statistics** | Opens the interactive BDD Analytics Dashboard Webview. |
| **Diagnose Workspace** | Runs a full environment and configuration diagnostic report in the Output Channel. |

### ⚙️ Configuration
| Action | Description |
|--------|-------------|
| **Open Extension Settings** | Opens VS Code Settings pre-filtered to the `gherkinPowerTools` namespace. |

---

## 💡 Why Use It?

- **Discoverability**: No need to remember specific command names or keyboard shortcuts. Every capability is one search away.
- **Keyboard-First**: Navigate the QuickPick with arrow keys and confirm with `Enter` — no mouse required.
- **Context-Aware**: Execution commands target the currently active `.feature` file and cursor position automatically.
