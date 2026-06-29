# Contributing to Gherkin Beautifier

Thank you for your interest in contributing to **Gherkin Beautifier**! This document explains our architecture, how to set up the project locally, and how to submit your contributions.

---

## 🏗️ Architecture Overview

The extension is written in **TypeScript** and uses the native **VS Code Extension API**. It is built with performance and maintainability in mind.

Here is a breakdown of the core modules located in the `src/` directory:

- **`extension.ts`**: The entry point. Registers all commands, providers (Formatter, Definition, Outline), and initializes the diagnostics.
- **`formatter.ts`**: The core AST-based formatter. It handles indentation, table alignment, auto-casing, and tag wrapping.
- **`highlighter.ts`**: Implements custom semantic syntax highlighting via VS Code's `createTextEditorDecorationType` API.
- **`linter.ts`**: Uses Regex to perform real-time syntax checking. Generates `vscode.Diagnostic` warnings to underline mistakes in the editor.
- **`definition.ts`**: The Go-To-Definition provider. Reads `.feature` steps and recursively searches the `steps/` folder for Python (`.py`) files with matching `@given`, `@when`, `@then` decorators.
- **`outline.ts`**: Constructs the hierarchical tree of `Feature > Rule > Scenario` for the VS Code Outline panel.
- **`statistics.ts`**: Generates the interactive HTML Webview dashboard by parsing workspace files to count BDD metrics.

---

## 🛠️ Local Setup

1. **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) (v16+) and [npm](https://www.npmjs.com/) installed.
2. **Clone the repository**:
   ```bash
   git clone https://github.com/carloscamara/vscode-gherkin-beautifier.git
   cd vscode-gherkin-beautifier
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Compile the TypeScript code**:
   ```bash
   npm run compile
   ```
5. **Run the Extension**:
   - Press `F5` in VS Code to open a new "Extension Development Host" window.
   - Any changes you make to the code can be tested by reloading the Development Host (`Cmd + R` / `Ctrl + R`).

---

## 🧪 Testing

We use the official `@vscode/test-electron` framework coupled with Mocha to run integration tests against the formatter.

To run the test suite:
```bash
npm test
```

> [!IMPORTANT]
> Always ensure that all tests pass before submitting a Pull Request. If you are adding a new feature, please add a corresponding test case in the `test/` directory.

---

## 📦 Packaging

To create a local `.vsix` file for distribution or local testing:

```bash
npx vsce package
```

This will generate a `vscode-gherkin-beautifier-x.x.x.vsix` file in the root directory.

---

## 🤝 Submitting a Pull Request

1. Fork the repository.
2. Create a new branch for your feature or bug fix: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Open a Pull Request against the `main` branch.

We look forward to reviewing your code!
