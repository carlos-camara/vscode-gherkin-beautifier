# 🚀 CLI: CI Pipeline Setup

Once installed, you can integrate the CLI into any CI provider (GitHub Actions, GitLab CI, Jenkins) to block pull requests that contain malformed Gherkin or violated styling guidelines.

## Usage

Check your entire project:
```bash
gherkin-pt check .
```

The CLI automatically reads your `.gherkin-powertoolsrc.json` (or `.vscode/settings.json`) to apply the exact same formatting rules and allowed linters you use locally.

## Example GitHub Action

```yaml
name: Gherkin Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Gherkin PowerTools Check
        run: npx @carlos-camara/gherkin-pt check features/
```
