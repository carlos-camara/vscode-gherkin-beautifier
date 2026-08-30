# Compatibility

Gherkin PowerTools is built to run everywhere VS Code runs.

---

## Framework Compatibility

### Generic Gherkin (Supported & Tested)
The core editing features (Formatting, Structural Linting, Quick Fixes, Outline, Analytics, Highlighting) are completely framework-independent. They will work flawlessly with standard `.feature` files used by:
- Cucumber (Java, Ruby, JS, etc.)
- SpecFlow (.NET)
- Karate
- Playwright BDD
- Any framework that adheres to the standard Gherkin syntax.

### Python Behave (Supported & Tested)
The advanced integrations (Go to Definition, Hover, Autocomplete, Step Generation, Test Explorer Execution, Debugging) are **exclusively designed for Python Behave**.
- The extension parses `@given`, `@when`, `@then`, and `@step` Python decorators.
- The extension runs tests by spawning the `behave` process.

*Note: The extension does not provide step definitions or execution integration for Cucumber.js, SpecFlow, or other frameworks. You can use Gherkin PowerTools alongside the official Cucumber extension for those frameworks.*

---

## Environment Compatibility

| Environment | Support Level | Notes |
|---|---|---|
| **VS Code Desktop (Windows/macOS/Linux)** | Supported & Tested | Requires VS Code 1.93.0 or later. |
| **Dev Containers** | Supported & Tested | Fully isolated execution within the container. |
| **WSL (Windows Subsystem for Linux)** | Supported & Tested | Native file system and process execution. |
| **SSH Workspaces** | Supported & Tested | |
| **GitHub Codespaces** | Supported & Tested | |

---

## Python & Behave Requirements

- **Python Versions:** Tested and Supported on Python 3.8 through 3.12.
- **Behave Versions:** Tested and Supported on:
  - Behave `1.2.6` (Official Stable)
  - Behave `1.2.7.dev` (Upstream pre-release)
  - Behave `1.3.3` (Community forks)
  
  *Note: The extension implements a **Graceful Degradation** fallback adapter. If internal Behave APIs change in newer versions or forks, core execution will continue flawlessly while gracefully degrading advanced UI telemetry (like Context Snapshots).*
- **Python Extension:** Required **only** for Debugging features in the Test Explorer (`ms-python.python`).
- **Behave Executable:** Required **only** for test execution from the Test Explorer (`pip install behave`). The extension can execute Behave via system PATH, Poetry, Pipenv, or explicit virtual environment paths.

## Standalone CLI Requirements

- **Node.js Engine:** The `@carlos-camara/gherkin-pt` CLI executable requires **Node.js >= 18.0.0**.
- **Supported OS:** Windows, macOS, and Linux. No native dependencies are required.

## Workspace Constraints

- **Multi-Root Workspaces:** Supported. Configuration settings in `.vscode/settings.json` apply to their specific workspace folders.
- **Paths with Spaces / Unicode Paths:** Supported. The extension uses native URI parsing to properly encode/decode file paths for regex matching and command execution.
- **Case-Insensitive File Systems:** Supported. The extension uses strict case-insensitive URI normalization (added in v1.8.2) to prevent duplicate index entries or cache misses natively on macOS and Windows.
- **Monorepos:** Supported. Configure `gherkinPowerTools.behave.stepGlobs` to point to all sub-directories where steps reside.
- **Large Workspaces:** Supported. The AST parser and file system watchers are deferred and operate in the background. Ensure `gherkinPowerTools.behave.ignoreGlobs` correctly ignores virtual environments to prevent parsing timeouts.
- **Massive Documents:** Supported but limited. While typical `.feature` files parse instantly (<20ms), auto-generated files exceeding `1MB` or `10,000 scenarios` will cause brief Extension Host UI blocking during parsing. Limit manual editing of generated files over 2MB.
## Gherkin Dialects

- **Language Support:** Supported & Tested. The semantic parser automatically adapts to 70+ languages (e.g. Spanish `Dado`, French `Soit`) via the `# language: <lang>` header.
