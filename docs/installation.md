<!-- markdownlint-disable MD046 -->
# 🚀 Installation

## From the VS Code Marketplace

1. Open Visual Studio Code.
2. Navigate to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Search for **"Gherkin PowerTools"**.
4. Click **Install**.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/install.gif" alt="Installation Demonstration" width="800" />
</div>

## From a `.vsix` File

If you have a pre-built `.vsix` package (e.g., from a GitHub Release):

```bash
code --install-extension vscode-gherkin-powertools-<version>.vsix
```

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/install-vsix.gif" alt=".vsix Installation Demonstration" width="800" />
</div>

<br>

**💡 PRO-TIP: Auto-Formatting** *To unleash the full power of the extension, enable **Format on Save** specifically for Gherkin files:*

```json
"[feature]": {
    "editor.defaultFormatter": "carloscamara.vscode-gherkin-powertools",
    "editor.formatOnSave": true
}
```

*Add this to your `.vscode/settings.json` or your global User Settings.*

## 🐳 Remote Development & DevContainers

Gherkin PowerTools is built ground-up to be 100% compatible with VS Code Remote Development (DevContainers, WSL, SSH, GitHub Codespaces).

Because the extension uses native VS Code APIs for all file access and process execution (`ProcessExecution` and `vscode.workspace.fs`), it seamlessly bridges your host machine and the containerized environment.

- **Intelligent Pathing**: All background tasks, path redacting in diagnostics, and step file discovery natively understand your remote workspace folders.
- **Persistent Settings**: Execution arguments are correctly scoped to your container's `.vscode/settings.json` via Workspace Folder targeting, guaranteeing that parameters aren't lost when your DevContainer restarts.
- **Isolated Execution**: When you run or debug from the **Test Explorer**, the underlying process strictly spawns **inside** your active DevContainer using your configured Linux environment and Python dependencies.
