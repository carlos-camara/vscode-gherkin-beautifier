# Contributing to Gherkin PowerTools

Contributions to **Gherkin PowerTools** are welcome. This document explains the architecture, local project setup, and submission process.

---

## 🏗️ Architecture Overview

The extension is written in **TypeScript** and uses the native **VS Code Extension API**. It is built with performance and maintainability in mind.

Here is a breakdown of the core modules located in the `src/` directory:

- **`extension.ts`**: The entry point and minimal composition root. Bundled via Esbuild for fast activation. Delegates capability registration to specialized submodules in `src/activation/`.
- **`src/activation/`**: Contains modular activation logic for `commands.ts`, `migration.ts`, `contextService.ts`, and `walkthrough.ts`.
- **`eventBus.ts`**: The centralized publish/subscribe Workspace Event Bus. It handles file watchers and decouples feature modules from VS Code workspace events.
- **`formatter.ts`**: The core AST-based formatter. It handles indentation, table alignment, auto-casing, and tag wrapping based on `@cucumber/gherkin` parses.
- **`highlighter.ts`**: Implements custom semantic syntax highlighting via VS Code's `createTextEditorDecorationType` API.
- **`linter.ts`**: Uses the official `@cucumber/gherkin` AST parser to perform real-time syntax checking. Generates `vscode.Diagnostic` warnings to underline mistakes in the editor.
- **`definition.ts`**: The Go-To-Definition provider. Accesses `cache.ts` for instant lookups.
- **`outline.ts`**: Constructs the hierarchical tree of `Feature > Rule > Scenario` for the VS Code Outline panel.
- **`statistics.ts`**: Generates the interactive HTML Webview dashboard by parsing workspace files to count BDD metrics.
- **`codeAction.ts`**: Generates quick fixes (💡) for undefined steps or syntax typos.
- **`completion.ts`**: Smart IntelliSense autocompletion parsing regex into Snippets.
- **`cache.ts`**: Asynchronous caching engine that non-blockingly indexes the workspace via `vscode.workspace.findFiles`.
- **`logger.ts`**: Native VS Code Output Channel for tracing.
- **`hover.ts`**: Provides hover information such as function signatures, docstrings, and tag blast radius.
- **`parser.ts`**: Handles AST parsing and caching of Gherkin documents.
- **`dialect.ts`**: Provides i18n support by matching localized Gherkin keywords.
- **`discovery.ts`**: Centralized service for Behave step-file discovery, configuration normalization, and reactive file watchers.
- **`diagnostics.ts`**: Diagnostic engine (`Gherkin: Diagnose Workspace`) collecting system metrics, discovery stats, and redacting paths for safe troubleshooting.

### Architecture Rules

To maintain compatibility and prevent side effects in users' workspaces, developers must adhere to the following strict boundaries:
- **No Global Configuration Overrides**: The extension must *never* specify overrides for native VS Code settings (e.g., `testing.*`, `editor.*`) inside the `configurationDefaults` block in `package.json`. Doing so silently breaks other extensions installed by the user. If an integration problem exists, it must be solved inside our own controllers, not by altering the global user workspace.
- **Test Controller Coexistence**: The extension must safely coexist with other extensions that provide their own Test Controllers and Profiles (like Python `pytest` or `Coverage`). Our Test Controller should not assume it is the only one in the workspace. Any E2E UI test must instantiate Mock controllers with unique IDs to avoid ID collisions with the real extension background processes.
- **Transactional Graph State**: The `WorkspaceGraph` coordinates the semantic index. Any mutation of the graph state *must* occur inside the `graph.executeTransaction()` wrapper to guarantee atomic commits and failure isolation.
  Services requiring graph reads must query the immutable `graph.currentGeneration` object. Tests needing to inject state outside of the transaction queue should exclusively use the test-only helper `graph.setNodeForTest()`.

### Contributors Deep-Dive: Implementing a new LanguageService Provider

When adding a new Language Service provider (e.g. `HoverProvider`, `CodeLensProvider`, or `CompletionItemProvider`), you must adhere to the following strict architectural constraints to ensure it performs efficiently and without cross-platform bugs:

1. **Never perform synchronous disk I/O**: Language providers are called hundreds of times per second. Query the `WorkspaceGraph` or `SymbolCache` synchronously, as they represent the in-memory state.
2. **Always route through `ResourceIdentity.getCanonicalUriString()`**: VS Code URI representations vary by platform (`file:///Users/C...` vs `file:///users/C...`). When you extract a URI from a `vscode.TextDocument` or `vscode.Uri` provided by the extension host to look up a node in the graph,
   you **MUST** convert it using the `ResourceIdentity` canonifier before executing `.get(...)` or `.has(...)` on internal Maps. Failing to do so will result in providers breaking silently on macOS and Windows (case-insensitive filesystems).

---

## 🛠️ Local Setup

1. **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) (v22+) and [npm](https://www.npmjs.com/) installed.
2. **Clone the repository**:
   ```bash
   git clone https://github.com/carlos-camara/vscode-gherkin-powertools.git
   cd vscode-gherkin-powertools
   ```
3. **Install dependencies**:
   ```bash
   npm ci
   ```
4. **Compile the TypeScript code**:
   ```bash
   npm run compile
   ```
5. **Build the CLI executable**:
   ```bash
   npm run esbuild
   ```
6. **Run the Extension**:
   - Press `F5` in VS Code to open a new "Extension Development Host" window.
   - Any changes you make to the code can be tested by reloading the Development Host (`Cmd + R` / `Ctrl + R`).

To test the CLI locally after building:
```bash
node dist/cli.js --help
```

---

## 🧪 Testing

The official `@vscode/test-electron` framework coupled with Mocha is used to run tests. Tests are split into two categories to maximize efficiency and reliability:

### Configuration Drift Check
To verify that all configuration settings in `package.json`, `gherkin-powertools.schema.json`, `src/configuration.ts`, `README.md`, and documentation are 100% synchronized:
```bash
npm run check:config
```

### CLI Tests
To run the integration tests specifically for the Command Line Interface:
```bash
npm run test:cli
```

### Unit and Architecture Tests
To run ultra-fast unit tests that validate the AST processor and algorithms, as well as the **Architecture Validation Test Suite** (which ensures all commands are registered, watchers are disposed, and bootstrap completes successfully):
```bash
npm run test
```

To run the unit and architecture tests and generate an LCOV coverage report:
```bash
npm run coverage
```

### End-to-End (E2E) UI Tests
To run native UI integration tests that launch a real VS Code instance and test features like formatting, outline generation, and linting directly via the VS Code Extension APIs:
```bash
npm run test:e2e
```

> **Important:** Always ensure that all tests pass before submitting a Pull Request. If you are adding a new feature, please add a corresponding test case in the `src/test/` directory.

---

## 🤖 CI/CD Pipeline

The CI/CD pipeline ensures that all code meets our quality and security standards.

### Supply-Chain Immutability

To prevent supply-chain attacks, **all third-party GitHub Actions must be pinned to a full 40-character commit SHA**, not a mutable tag or branch (e.g., `@v2` or `@main`).
This guarantees that the exact execution logic cannot be silently altered by an upstream provider.
- You must leave a readable comment next to the SHA indicating the intended version/tag (e.g., `# v2.1.0`).
- If you add or modify a GitHub workflow, you must run `npm run check:config` locally. This executes our static workflow policy checker (`scripts/test-workflow-policy.js`) which will fail the build if any unpinned, mutable action references are found.

Coverage reporting and other QA gates are handled by these rigorously pinned actions.

---

## 📦 Packaging

To verify that the built VSIX package contains only expected files, doesn't leak secrets, and doesn't exceed maximum size limitations:

```bash
npm run verify:vsix
```

To create a local `.vsix` file for distribution or local testing:

```bash
npx vsce package
```

This will generate a `vscode-gherkin-powertools-x.x.x.vsix` file in the root directory.

---

## 🤝 Submitting a Pull Request

<br>

**ℹ️ NOTE:** *If you are planning a large feature or significant architectural change, please open an Issue or Discussion first to align with the project maintainers before writing code. Please use our structured Issue Forms to report bugs, performance problems, or feature requests before starting.*

<br>

1. Fork the repository.
2. Create a new branch for your feature or bug fix: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Open a Pull Request against the `main` branch.

Code reviews will be conducted on all submissions.

## 🚀 Release Preparation Process

To ensure high-quality, secure releases, we use an explicit two-step release architecture that decouples unprivileged compilation from privileged publication.

1. **Prepare the Release locally**:
   - Update the version in `package.json` (e.g. from `1.8.4` to `1.8.5`).
   - Run `npm install` to update `package-lock.json`.
   - Add a new section in `CHANGELOG.md` with the exact header `## [1.8.5]`.
   - Commit and push these changes to `main`. *(Note: pushing to main no longer triggers an automatic release).*

2. **Trigger the Release Workflow**:
   - Go to the **Actions** tab in the GitHub repository.
   - Select the **📦 Create Release** workflow on the left.
   - Click **Run workflow**.
   - By default, **Dry Run** is checked. You can run this first to safely validate the build, tests, and signatures without publishing.
   - To officially publish, **uncheck "Dry Run"** and run the workflow.

3. **What happens automatically**:
   - The unprivileged `build-and-validate` job compiles the extension, runs tests, creates the `.vsix`, extracts your changelog notes, and generates cryptographic provenance.
   - The privileged `publish` job verifies the provenance and creates the Git Tag, GitHub Release, and uploads the verified asset.

4. **Enhance Release Notes (Optional)**:
   - Go to the [GitHub Releases page](https://github.com/carlos-camara/vscode-gherkin-powertools/releases) and edit the generated release to add any visual demos, screenshots, or additional narrative using `.github/RELEASE_TEMPLATE.md`.
