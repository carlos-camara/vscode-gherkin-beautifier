# 🔍 Behave Step Discovery

Gherkin PowerTools automatically indexes your Python step definitions and makes them available for **hover documentation**, **Go to Definition**, **IntelliSense completions**, and **undefined step detection**.

**How it works:**

The extension watches your workspace for `.py` files matching your configured globs and builds an in-memory symbol cache. To ensure VS Code starts instantly, indexing is **deferred by ~2 seconds** after activation — you won't see any startup slowdown. The cache updates **reactively** after that — add a new step function, and IntelliSense reflects it within seconds without reloading.

**Default step globs:**

```text
**/steps/**/*.py
**/features/steps/**/*.py
```

**Custom project layouts:**

If your steps live in a non-standard location (e.g. `src/automation/steps/`), the extension **automatically detects this** on startup and prompts you with a recommended glob configuration.

You can also configure it manually in your `.vscode/settings.json` or centrally for your team in a `.gherkin-powertoolsrc.json` file:

```json
"gherkinPowerTools.behave.stepGlobs": [
    "**/steps/**/*.py",
    "**/src/automation/**/*.py"
]
```

**Exclusions:**

Exclude noise (e.g. virtual environments) to keep the cache fast:

```json
"gherkinPowerTools.behave.ignoreGlobs": [
    "**/node_modules/**",
    "**/.venv/**",
    "**/venv/**"
]
```

> **Tip:** Open the **Command Center** and select **Diagnose Workspace** to see exactly which files are in the cache, which steps were parsed, and whether any globs are misconfigured.
