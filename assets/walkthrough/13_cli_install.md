# 💻 Standalone CLI: Installation

The Gherkin PowerTools parsing and diagnostic engine is available as a standalone command-line interface (CLI). This allows you to run identical checks in your CI/CD pipelines without running VS Code.

## Requirements
- **Node.js** >= 18.0.0

> [!NOTE]
> The `@carlos-camara/gherkin-pt` package is currently in preview. If you receive a `404 Not Found` error, the package has not yet been published to the public npm registry for your version.

## Installation
You can install the CLI globally via `npm`:

```bash
npm install -g @carlos-camara/gherkin-pt
```

Or you can use it on the fly using `npx`:

```bash
npx @carlos-camara/gherkin-pt --version
```

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/cli.gif" alt="CLI Installation" width="600" />
</div>
