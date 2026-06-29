<!-- markdownlint-disable MD046 -->
# 🚀 Installation

## From the VS Code Marketplace

1. Open Visual Studio Code.
2. Navigate to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Search for **"Gherkin Beautifier"**.
4. Click **Install**.

## From a `.vsix` File

If you have a pre-built `.vsix` package (e.g., from a GitHub Release):

```bash
code --install-extension vscode-gherkin-beautifier-1.6.0.vsix
```

!!! tip "Pro-Tip: Auto-Formatting"
    To unleash the full power of the extension, enable **Format on Save** specifically for Gherkin files:

    ```json
    "[feature]": {
        "editor.defaultFormatter": "carloscamara.vscode-gherkin-beautifier",
        "editor.formatOnSave": true
    }
    ```

    Add this to your `.vscode/settings.json` or your global User Settings.
