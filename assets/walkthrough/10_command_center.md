# 🛠️ Command Center

Everything Gherkin PowerTools can do, from a single searchable menu.

**How to open:**

- `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux) → `Gherkin PowerTools: Command Center`

---

## Available Actions

### 🎨 Formatting
| Action | What it does |
|--------|-------------|
| **Format Document** | Reformat the entire active `.feature` file using the AST engine |
| **Format Selection** | Reformat only the selected range |

### ▶️ Execution
| Action | What it does |
|--------|-------------|
| **Run Feature** | Execute the entire active `.feature` file with Behave via a VS Code Task |
| **Run Scenario** | Execute the scenario at the current cursor position |
| **Debug Feature** | Launch a `debugpy` debug session for the entire feature |
| **Debug Scenario** | Launch a `debugpy` debug session for the scenario at the cursor |
| **Run with Custom Args** | Prompt for extra Behave arguments before running |

### 🛠️ Step Definitions
| Action | What it does |
|--------|-------------|
| **Create Step Definition** | Generate a Python stub for the undefined step at the cursor |

### 📊 Analysis
| Action | What it does |
|--------|-------------|
| **Show Statistics** | Open the interactive BDD statistics dashboard |
| **Diagnose Workspace** | Run a full diagnostic report: step cache status, glob coverage, parsing errors |

---

> **Tip:** Every action in the Command Center is also available as an individual VS Code command — you can bind any of them to a custom keyboard shortcut via `Keyboard Shortcuts` (`Cmd+K Cmd+S`).
