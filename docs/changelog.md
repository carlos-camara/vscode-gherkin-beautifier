# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Community & Open Source Infrastructure
- **Issue Templates**: `bug_report.yml` (Gherkin-specific fields, VS Code version) and `feature_request.yml`
- **Pull Request Template**: Testing matrix for VS Code extension development
- **Dependabot**: Weekly dependency updates (npm + GitHub Actions)
- **CODE_OF_CONDUCT.md**: Contributor Covenant
- **SECURITY.md**: Coordinated disclosure process
- **`.editorconfig`**: TypeScript (4 spaces), JSON/YAML (2 spaces), `.feature` (2 spaces)

### Added — CI/CD Pipelines
- **PR Labeler** (`labeler.yml`): Auto-labels PRs by file paths
- **PR Gate** (`gate-check.yml`): Validates PR hygiene + AI summaries
- **Release** (`release.yml`): Compiles TS → packages `.vsix` → GitHub Release on `v*` tags
- **Deploy Docs** (`pages.yml`): MkDocs Material → GitHub Pages

### Added — Documentation Site (MkDocs Material)
- Full MkDocs Material site with 14 pages, deep purple theme, Mermaid diagrams
- Deployed to `https://carlos-camara.github.io/vscode-gherkin-beautifier/`

### Changed
- Fixed TypeScript lint warnings across `formatter.ts`, `highlighter.ts`, `definition.ts`, `linter.ts`, `outline.ts`, `statistics.ts`
- Rewrote `README.md` and `CONTRIBUTING.md` with modern layout

## [1.5.0] - 2026-06-25

### Added
- **Multi-language Support (i18n)**: Formatter now fully supports English, Spanish, French, and German Gherkin keywords
- **Diagnostic Provider (Linter)**: Strict enforcement of colons on block keywords and spaces on step keywords
- **Cascading Indentation**: Beautiful stair-step indentation style
- **Inline Comment Alignment**: Dynamic alignment of inline comments to the same vertical column
- **Outline Provider**: Interactive tree view in VS Code's Outline panel
- **Context Menu Command**: "Format Gherkin Document" in the right-click menu
- **Snippets**: Autocompletion for `feature`, `scenario`, `outline`, `rule`
- **Go to Definition**: `Cmd+Click` to jump from `.feature` to Python step definitions
- **Statistics Dashboard**: HTML Webview with BDD project metrics
- **Syntax Highlighting**: Curated color palette (Purple, Blue, Cyan)
- **Configuration `gherkinBeautifier.tags.format`**: Wrap or single-line tag formatting
- **Configuration `gherkinBeautifier.emptyLines.betweenScenarios`**: Customizable blank lines between blocks

### Changed
- Refactored formatting engine to use dynamic regex mapping for i18n support

## [1.4.0] - 2026-06-24

### Added
- **Auto-Casing**: Automatic PascalCase for Gherkin keywords
- **Tag Sorting & Formatting**: Alphabetical sorting with configurable wrapping
- **Whitespace Cleanup**: Collapse consecutive empty lines, trim trailing whitespace
- **Inline Comment Alignment**: Align inline comments within code blocks
- **Variable Normalization**: Trim spaces inside Scenario Outline variables

## [1.3.0] - 2026-06-24

### Added
- **Configuration Settings**: `gherkinBeautifier.indentation.steps` and `gherkinBeautifier.tables.alignToKeyword`

## [1.2.0] - 2026-06-24

### Added
- **Format Selection Support**: `DocumentRangeFormattingEditProvider` for partial formatting

## [1.1.0] - 2026-06-24

### Added
- **Smart Block Spacing**: Automatic blank lines before major blocks
- **Dynamic Table Alignment**: Tables inherit indentation from preceding keyword

## [1.0.0] - 2026-06-24

### Added
- Initial release
- Core Gherkin indentation formatting engine
- Intelligent data table alignment algorithm
- Integration with VS Code `DocumentFormattingEditProvider`
