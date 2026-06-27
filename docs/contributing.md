# Contributing

Thank you for your interest in contributing to **Gherkin Beautifier**! This document explains our architecture, how to set up the project locally, and how to submit your contributions.

---

## Architecture Overview

The extension is written in **TypeScript** and uses the native **VS Code Extension API**. See the full [Architecture](architecture.md) documentation for details.

## Local Setup

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
5. **Run the Extension**: Press `F5` in VS Code to open a new "Extension Development Host" window.

## Testing

We use `@vscode/test-electron` with Mocha for integration tests:

```bash
npm test
```

!!! note
    Always ensure all tests pass before submitting a Pull Request. If adding a new feature, please add a corresponding test case.

## Packaging

To create a local `.vsix` file:

```bash
npx @vscode/vsce package
```

## Submitting a Pull Request

1. Fork the repository
2. Create a new branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -m 'feat: add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Open a Pull Request against the `main` branch

We look forward to reviewing your code!
