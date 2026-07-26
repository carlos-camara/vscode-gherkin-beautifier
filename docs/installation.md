<!-- markdownlint-disable MD046 -->
# 🚀 Installation

## From the VS Code Marketplace

The easiest and recommended way to install Gherkin PowerTools:

1. Open Visual Studio Code
2. Open the Extensions panel: <kbd>Ctrl+Shift+X</kbd> (Windows/Linux) or <kbd>Cmd+Shift+X</kbd> (macOS)
3. Search for **"Gherkin PowerTools"**
4. Click **Install**

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/install.gif" alt="Installation from the VS Code Marketplace" width="800" />
</div>

Or install directly from the terminal:

```bash
code --install-extension carloscamara.vscode-gherkin-powertools
```

---

## From a `.vsix` File

If you have a pre-built `.vsix` package (e.g., downloaded from a [GitHub Release](https://github.com/carlos-camara/vscode-gherkin-powertools/releases)):

```bash
code --install-extension vscode-gherkin-powertools-<version>.vsix
```

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/install-vsix.gif" alt=".vsix installation from a local file" width="800" />
</div>

---

## Post-Installation: Recommended Setup

Enable **Format on Save** for Gherkin files so your team always commits clean, consistently formatted features:

```json
// .vscode/settings.json
"[feature]": {
    "editor.defaultFormatter": "carloscamara.vscode-gherkin-powertools",
    "editor.formatOnSave": true
}
```

Committing this to `.vscode/settings.json` ensures every contributor automatically gets Format on Save without configuring their own editor.

---

## Requirements

| Requirement | Details |
|-------------|---------|
| **VS Code** | Version 1.85.0 or later |
| **Python extension** | [`ms-python.python`](https://marketplace.visualstudio.com/items?itemName=ms-python.python) — required only for the 🐞 **Debug** feature in the Test Explorer |
| **Behave** | Required only for test execution. Install via `pip install behave` |

All other features (formatting, linting, IntelliSense, hover, Go to Definition, statistics) work without Python or Behave installed.

---

## Remote Development & DevContainers

Gherkin PowerTools is built to be 100% compatible with VS Code Remote Development — DevContainers, WSL, SSH, and GitHub Codespaces.

Because the extension uses native VS Code APIs for all file access and process execution (`ProcessExecution` and `vscode.workspace.fs`), it bridges the host machine and the containerized environment transparently.

- **Intelligent pathing:** All background tasks, path redaction in diagnostics, and step file discovery natively understand remote workspace folders
- **Persistent settings:** Execution arguments are scoped to the container's `.vscode/settings.json` via Workspace Folder targeting — settings survive container restarts
- **Isolated execution:** When you run or debug from the Test Explorer, the underlying process spawns **inside** your active DevContainer using your configured Linux Python environment and dependencies

> **Tip:** Add `"carloscamara.vscode-gherkin-powertools"` to the `extensions` array in your `devcontainer.json` to automatically install the extension inside the container for all team members.

```json
// .devcontainer/devcontainer.json
{
    "extensions": [
        "carloscamara.vscode-gherkin-powertools",
        "ms-python.python"
    ]
}
```
