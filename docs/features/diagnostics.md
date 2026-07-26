# 🩺 Workspace Diagnostics

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/diagnostics.gif" alt="Workspace Diagnostics Demo" width="600" />
</div>

Troubleshoot setup, discovery, step navigation, test execution, and debugging issues instantly using the **`Gherkin: Diagnose Workspace`** command.

---

## ⚡ How to Trigger

1. Open the VS Code Command Palette:
   - **macOS:** <kbd>Cmd+Shift+P</kbd> (<kbd>⌘⇧P</kbd>)
   - **Windows / Linux:** <kbd>Ctrl+Shift+P</kbd>
2. Type **`Gherkin: Diagnose Workspace`** and press **Enter**.

---

## 📊 Diagnostic Report Output

The command generates a formatted diagnostic report inside a dedicated Output Channel named **`Gherkin Diagnostics`**.

### Included Information

| Section | Diagnostic Items |
|---------|------------------|
| **Environment** | Extension version, VS Code version, OS platform & architecture, workspace folder count. |
| **Discovery & Indexing** | Total `.feature` files found, Python step files discovered, total indexed step definitions in `SymbolCache`, active `stepGlobs` and `ignoreGlobs`. |
| **Python & Behave** | Official Python extension (`ms-python.python`) status, selected Python interpreter path, configured Behave command (`behave.command`), and `.gherkin-powertoolsrc.json` status & JSON validity. |
| **Warnings & Actions** | Automated alerts for missing feature files, unindexed custom step directories, missing Python extension for debugging, or JSON schema syntax errors. |

---

## 🔒 Privacy & Path Redaction

Your privacy is protected. When you click **`📋 Copy Sanitized Report`**, the extension automatically sanitizes personal path information before placing the text onto your clipboard.

- **Username Redaction:** Personal account names in paths (e.g. `/Users/johndoe/...` or `C:\Users\johndoe\...`) are automatically replaced with `/Users/<redacted>/...`.
- **Zero Script Execution:** Operates 100% in memory; never executes arbitrary workspace scripts or network requests.

---

## 💡 Troubleshooting Common Warnings

### ⚠️ "No Python step definition files (.py) were discovered using current stepGlobs"
**Solution:** If your Python step files live in custom directories (e.g. `custom_steps/**/*.py`), update `gherkinPowerTools.behave.stepGlobs` in your VS Code settings or `.gherkin-powertoolsrc.json`:

```json
{
  "behave": {
    "stepGlobs": [
      "**/custom_steps/**/*.py",
      "**/features/steps/**/*.py"
    ]
  }
}
```

---

### ⚠️ "The official Python extension (ms-python.python) is not installed"
**Solution:** Install `ms-python.python` from the VS Code Marketplace to enable interactive 1-click scenario debugging via the **Test Explorer** (`🐞 Debug` profile).

---

### ⚠️ "Your project .gherkin-powertoolsrc.json file contains syntax errors"
**Solution:** Open `.gherkin-powertoolsrc.json` and fix JSON syntax errors (such as trailing commas or unquoted keys).
