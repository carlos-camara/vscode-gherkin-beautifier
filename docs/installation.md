<!-- markdownlint-disable MD046 -->
# 🚀 Installation

> Get up and running in under 60 seconds. Gherkin PowerTools requires **no configuration** to start formatting and linting your Gherkin files.

---

## Option 1 — VS Code Marketplace (Recommended)

The fastest way to install:

| Step | Action |
|---|---|
| **1** | Open Visual Studio Code |
| **2** | Open the Extensions panel: `Ctrl+Shift+X` (Windows/Linux) · `Cmd+Shift+X` (macOS) |
| **3** | Search for **"Gherkin PowerTools"** |
| **4** | Click **Install** |

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/install.gif" alt="Installation from the VS Code Marketplace" width="600" />
</div>

Or install directly from the terminal:

```bash
code --install-extension carloscamara.vscode-gherkin-powertools
```

---

## Option 2 — VSIX File (Offline / Beta)

If you have a pre-built `.vsix` package (e.g., downloaded from a [GitHub Release](https://github.com/carlos-camara/vscode-gherkin-powertools/releases)):

```bash
code --install-extension vscode-gherkin-powertools-<version>.vsix
```

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/install-vsix.gif" alt=".vsix installation from a local file" width="600" />
</div>

---

## ⚙️ Post-Installation: Recommended Setup

Enable **Format on Save** so your team always commits clean, consistently formatted features. Add this to your workspace settings:

```json
// .vscode/settings.json
"[feature]": {
    "editor.defaultFormatter": "carloscamara.vscode-gherkin-powertools",
    "editor.formatOnSave": true
}
```

> 💡 Committing `.vscode/settings.json` to your repository ensures every contributor gets Format on Save automatically — no individual editor configuration needed.

---

## 📋 Requirements

| Requirement | Version | Notes |
|---|---|---|
| **VS Code** | 1.93.0 or later | Required |
| **Python extension** | Any | [`ms-python.python`](https://marketplace.visualstudio.com/items?itemName=ms-python.python) — required **only** for 🐞 Debug in the Test Explorer |
| **Behave** | Any | Required **only** for test execution — `pip install behave` |

> 📝 All other features — formatting, linting, IntelliSense, Hover, Go to Definition, Statistics — work **without** Python or Behave installed.

---

## 🐳 Remote Development & DevContainers

Gherkin PowerTools is **100% compatible** with VS Code Remote Development — DevContainers, WSL, SSH, and GitHub Codespaces.

The extension uses native VS Code APIs for all file access and process execution, bridging the host machine and containerized environment transparently:

| Capability | Detail |
|---|---|
| **Intelligent Pathing** | Path resolution, diagnostics, and step file discovery understand remote workspace folders natively |
| **Persistent Settings** | Execution arguments scoped to `.vscode/settings.json` via Workspace Folder targeting — survives container restarts |
| **Isolated Execution** | Run / Debug spawns **inside** your active DevContainer, using your Linux Python environment and dependencies |

Add the extension to your `devcontainer.json` to auto-install for all team members:

```json
// .devcontainer/devcontainer.json
{
    "extensions": [
        "carloscamara.vscode-gherkin-powertools",
        "ms-python.python"
    ]
}
```
