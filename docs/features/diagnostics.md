# 🩺 Workspace Diagnostics

When something is not working as expected — step navigation broken, undefined steps not detected, debug not launching — the **Diagnose Workspace** command gives you a complete, structured health report in seconds.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/diagnostics.gif" alt="Workspace Diagnostics Demo" width="700" />
</div>

---

## ⚡ How to Trigger

| Method | Steps |
|--------|-------|
| **Command Palette** | <kbd>Cmd+Shift+P</kbd> / <kbd>Ctrl+Shift+P</kbd> → `Gherkin: Diagnose Workspace` |
| **Command Center** | Open the Command Center → **Diagnose Workspace** |
| **Onboarding Prompt** | Click **Diagnostics** on the first-run notification |

---

## 📊 What the Report Covers

The report is written to a dedicated **`Gherkin Diagnostics`** Output Channel and covers every layer of the extension:

| Section | What is checked |
|---------|----------------|
| **Extension Environment** | Extension version, VS Code version, OS platform and architecture, number of workspace folders |
| **Feature File Discovery** | Total `.feature` files found across all workspace folders |
| **Step Definition Indexing** | Number of `.py` files discovered, total step definitions indexed in the in-memory Symbol Cache, active `stepGlobs` and `ignoreGlobs` |
| **Python & Behave Setup** | Presence and version of the `ms-python.python` extension, selected Python interpreter path, configured `behave.command`, working directory |
| **Configuration Files** | Presence and JSON validity of `.gherkin-powertoolsrc.json`, active configuration source (workspace settings vs. JSON file) |
| **Automated Warnings** | Actionable alerts for any of the common issues below |

---

## 🔒 Privacy & Path Redaction

When you click **Copy Sanitized Report** to share the report with the team or post it in a GitHub Issue:

- **Username redaction** — Personal account names in file paths (e.g. `/Users/johndoe/...` or `C:\Users\johndoe\...`) are automatically replaced with `/Users/<redacted>/...`
- **Zero script execution** — The diagnostic runs 100% in memory; it never executes workspace scripts or makes network requests

---

## 💡 Troubleshooting Common Warnings

### ⚠️ "No Python step definition files (.py) were discovered"

Your step files are in a directory not covered by the current `stepGlobs`. Update your configuration:

```json
// .gherkin-powertoolsrc.json
{
  "behave": {
    "stepGlobs": [
      "**/custom_steps/**/*.py",
      "**/features/steps/**/*.py"
    ]
  }
}
```

Or add the same to `.vscode/settings.json` under `gherkinPowerTools.behave.stepGlobs`.

---

### ⚠️ "The official Python extension (ms-python.python) is not installed"

Install the [Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python) from the VS Code Marketplace to enable interactive 1-click debugging via the **Test Explorer** (🐞 Debug profile).

---

### ⚠️ "Your .gherkin-powertoolsrc.json contains syntax errors"

Open the file and fix JSON syntax issues (trailing commas, unquoted keys, missing brackets). The file is validated against the published JSON schema — enable schema validation in VS Code for real-time feedback:

```json
// .vscode/settings.json
{
  "json.schemas": [
    {
      "fileMatch": [".gherkin-powertoolsrc.json"],
      "url": "./gherkin-powertools.schema.json"
    }
  ]
}
```

---

### ⚠️ "0 step definitions indexed"

This typically means either:
1. The `stepGlobs` patterns do not match any files — check paths and glob syntax
2. The step files exist but contain no `@given`/`@when`/`@then`/`@step` decorators
3. The Python files are excluded by `ignoreGlobs` (e.g. accidentally matching `.venv`)

Run the diagnostic again after adjusting globs — the cache rebuilds automatically on configuration change.
