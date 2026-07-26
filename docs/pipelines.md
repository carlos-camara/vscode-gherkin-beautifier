# ⚙️ CI/CD Pipelines

This repository uses **GitHub Actions** for Continuous Integration and Deployment. All workflows ensure code quality, prevent regressions, maintain documentation integrity, and automate releases.

---

## Pipeline Overview

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| 🧪 Unit Tests & Coverage | `test.yml` | Pull Requests | Build, test, and measure coverage across 3 OSes |
| 🎭 E2E Tests | `e2e.yml` | Pull Requests | Full VS Code instance tests (real UI automation) |
| 🛡️ Code Quality Lint | `lint.yml` | Push to `main`, Pull Requests | Lint Markdown, YAML, and GitHub Actions files |
| 📚 Docs Audit | `docs.yml` | Push to `main`, Pull Requests touching `*.md` or `docs/` | MkDocs strict build to catch broken links/references |
| 🏷️ PR Labeler | `labeler.yml` | Pull Requests | Auto-label by semantic type and PR size |
| 🌐 Pages Deployment | `pages.yml` | Release published, Manual dispatch | Build and deploy MkDocs site to GitHub Pages |
| 📦 Release & Packaging | `release.yml` | Push to `main` | Package `.vsix`, create GitHub Release |

---

## 1. 🧪 Unit Tests & Coverage (`test.yml`)

**Triggers:** Pull Requests (excluding `.md`, `docs/`, `mkdocs.yml` changes)

- **Matrix strategy:** Runs concurrently on `ubuntu-latest`, `macos-latest`, and `windows-latest`
- **Build:** Compiles the TypeScript codebase via the `setup-build` composite action
- **Tests:** Runs the Mocha unit and integration test suite (`npm test`)
- **Coverage:** On Linux, runs `npm run coverage` which produces an LCOV report
- **Reporting:** Coverage is posted as a PR comment; JUnit XML results are published as native GitHub Check Runs (no noisy PR comments)

---

## 2. 🎭 E2E Tests (`e2e.yml`)

**Triggers:** Pull Requests (excluding `.md`, `docs/`, `mkdocs.yml` changes)

- **Matrix strategy:** `ubuntu-latest`, `macos-latest`, `windows-latest`
- **VS Code bootstrapping:** Uses `@vscode/test-electron` to download and run a real VS Code instance inside a virtual framebuffer (`xvfb-run -a` on Linux)
- **Caching:** The VS Code test binary is cached per OS + architecture + `package-lock.json` hash to avoid redundant downloads
- **What is tested (simulated real user workflows):**
  - Opening documents and assigning them the `feature` language ID
  - Injecting malformed Gherkin and invoking `editor.action.formatDocument`
  - Querying `vscode.executeDocumentSymbolProvider` and asserting the Outline tree is correct
  - Asserting the Linter creates real-time `Diagnostic` objects in response to text changes
  - Invoking `gherkinPowerTools.runFeature`, `runScenario`, `debugFeature`, and `debugScenario` commands
  - Testing the Onboarding Engine's workspace analysis
- **Reporting:** JUnit XML results published as GitHub Check Runs per OS

---

## 3. 🛡️ Code Quality Lint (`lint.yml`)

**Triggers:** Push to `main`, Pull Requests

- Runs `carlos-camara/qa-hub-actions/lint-codebase`
- Lints: Markdown files, YAML configurations, GitHub Actions workflow files
- Enforces consistent formatting and structure across the repository's meta-files

---

## 4. 📚 Docs Audit (`docs.yml`)

**Triggers:** Push to `main` or Pull Requests that touch `**/*.md`, `docs/**`, or `mkdocs.yml`

- Installs MkDocs and `mkdocs-material` (pinned to Python 3.12)
- Runs `mkdocs build --strict` — any broken internal links, missing assets, or invalid references fail the build
- This ensures every documentation change is validated before it can be merged

---

## 5. 🏷️ PR Labeler (`labeler.yml`)

**Triggers:** `pull_request`

- **Semantic labeling:** Analyzes the PR title and assigns labels such as `bug`, `enhancement`, `documentation`, or `chore`
- **Size labeling:** Calculates total lines changed and assigns `size/XS`, `size/S`, `size/M`, `size/L`, or `size/XL` — helps reviewers prioritize code reviews

---

## 6. 🌐 Pages Deployment (`pages.yml`)

**Triggers:** Release published or Manual Dispatch (`workflow_dispatch`)

- Builds the static documentation site with `mkdocs-material`
- Deploys the output to GitHub Pages at `https://carlos-camara.github.io/vscode-gherkin-powertools/`
- MkDocs version is pinned to prevent upstream breaking changes from affecting the live site

---

## 7. 📦 Release & Packaging (`release.yml`)

**Triggers:** Push to `main`

- **Validation:** Verifies all tests pass before packaging
- **Packaging:** Builds the `.vsix` extension bundle deterministically and validates asset content
- **Idempotent recovery:** Uses the GitHub CLI (`gh release`) to check tag and release existence step by step — if a network timeout occurs mid-upload, re-running the workflow safely resumes without duplicating tags or corrupting release state
