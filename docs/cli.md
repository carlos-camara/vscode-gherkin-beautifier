# Command Line Interface (CLI)

Gherkin PowerTools includes a powerful, standalone CLI (`gherkin-pt`) that brings the **Workspace Intelligence Engine** to your terminal and CI/CD pipelines. It allows you to run the exact same formatter, diagnostics, and metrics that run in VS Code, directly from the command line.

<p align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/cli.gif" alt="Command Line Interface execution" width="600" height="340" />
</p>

## Installation

When you install Gherkin PowerTools locally in your project, the CLI is automatically added to your environment:

```bash
npm install --save-dev vscode-gherkin-powertools
```

You can then run the CLI using `npx`:

```bash
npx gherkin-pt --help
```

## Available Commands

### 1. `analyze` (or `health`)
Scans your entire workspace (both `.feature` files and Python Behave steps) to detect:
- Missing step definitions.
- Unused step definitions.
- Duplicated step definitions.
- Ambiguous step definitions.
- Gherkin structural and syntax errors.

**Usage:**
```bash
npx gherkin-pt analyze
```

**CI/CD Integration:**
If the command detects any problems, it will return an exit code of `1`, allowing you to block a Pull Request that introduces invalid Gherkin or missing Python steps.

**JSON Output:**
You can export the results for custom scripts by using the `--json` flag:
```bash
npx gherkin-pt analyze --json
```

### 2. `format`
Formats all `.feature` files in your workspace according to your `.gherkin-powertoolsrc.json` configuration profile.

**Usage:**
```bash
# Formats all files in place
npx gherkin-pt format

# Format specific files or directories
npx gherkin-pt format tests/features/**/*.feature
```

**Check Mode for CI:**
In a CI/CD pipeline, you don't want to modify files, you want to enforce that developers formatted them correctly before committing. Use the `--check` flag:
```bash
npx gherkin-pt format --check
```
If any file does not match the configured formatting standard, the CLI exits with code `1`.

### 3. `stats` (or `report`)
Generates high-level project metrics, including the total number of features, scenarios, steps, and an overall maintainability score.

**Usage:**
```bash
npx gherkin-pt stats
```

**JSON Output:**
Use the `--json` flag to export metrics and feed them into internal reporting dashboards:
```bash
npx gherkin-pt stats --json > bdd_metrics.json
```

## CI/CD Example: GitHub Actions

You can integrate Gherkin PowerTools into your GitHub Actions workflow to block PRs that contain unformatted Gherkin or missing Python step definitions.

Create a file at `.github/workflows/gherkin-pt.yml`:

```yaml
name: Gherkin PowerTools

on:
  pull_request:
    branches: [ main ]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install -D vscode-gherkin-powertools

      - name: Enforce Formatting
        run: npx gherkin-pt format --check

      - name: Validate BDD Health
        run: npx gherkin-pt analyze
```

## Configuration

The CLI reads the exact same configuration as the VS Code extension.
To share formatting rules and glob patterns across your team and CI/CD pipelines, place a `.gherkin-powertoolsrc.json` file in the root of your workspace:

```json
{
  "profile": "team",
  "behave": {
    "stepGlobs": [
      "**/steps/**/*.py"
    ]
  }
}
```
