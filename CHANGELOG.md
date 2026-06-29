<!-- markdownlint-disable MD024 -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Project Analytics V6 (Omega Squeeze)**: Completely redesigned the `Gherkin: Show Project Statistics` dashboard with a premium glassmorphism interface, CSS masonry layouts, and animated dynamic numbers.
- **Scenario Intelligence**: Tracks vocabulary richness, average step conciseness, data density, and actively flags the "Most Complex Scenario" in your suite.
- **Step Execution Breakdown**: Real-time progress bars charting the distribution of Given, When, Then, And/But usages.
- **Behavioral Archetypes**: Scans step vocabulary to classify your project into UI, API, and DB operations.
- **Expandable Metrics**: Added interactive UI for Top Tags and Top Repeated Steps, allowing text expansion with a click.
- **Gherkin Quality Score (GQS)**: Added a proprietary algorithm to evaluate code quality based on BG Reuse, Tables, Comments, and Complexity penalties.
- **Automation ROI Tracking**: Added a new metric to calculate the estimated manual hours saved by your automated tests, using the exact number of executable permutations.

## [1.6.0] - 2026-06-29

### Added — Community & Open Source Infrastructure
- **Issue Templates**: Added `bug_report.yml` (with Gherkin-specific fields and VS Code version) and `feature_request.yml` via GitHub Issue Forms.
- **Pull Request Template**: Added `pull_request_template.md` with testing matrix tailored for VS Code extension development.
- **Dependabot**: Added `dependabot.yml` for automated weekly dependency updates (npm + GitHub Actions).
- **CODE_OF_CONDUCT.md**: Added Contributor Covenant Code of Conduct.
- **SECURITY.md**: Added security policy with coordinated disclosure process.
- **`.editorconfig`**: Added EditorConfig with rules for TypeScript (4 spaces), JSON/YAML (2 spaces), and `.feature` files (2 spaces).

### Added — CI/CD Pipelines
- **PR Labeler** (`labeler.yml`): Auto-labels PRs based on changed file paths (core, documentation, testing, dependencies, DevOps, configuration, assets).
- **PR Hygiene & Intelligence Gate** (`gate-check.yml`): Validates PR title/description and generates AI-powered summaries on every PR.
- **Release** (`release.yml`): Automatically compiles TypeScript, packages `.vsix` with `@vscode/vsce`, and creates a GitHub Release on `v*` tags.
- **Deploy Docs** (`pages.yml`): Deploys MkDocs Material documentation to GitHub Pages on pushes to `main`.

### Added — Documentation Site (MkDocs Material)
- **`mkdocs.yml`**: Full MkDocs Material configuration with deep purple theme, dark/light mode, search, code copy, and Mermaid diagrams.
- **14 documentation pages**: Home, Installation, Configuration, 7 feature pages (Formatter, Linter, Go To Definition, Outline, Statistics, Highlighting, Snippets), Architecture (with Mermaid diagrams), Contributing, Code of Conduct, Security, and Changelog.
- Documentation will be deployed to `https://carlos-camara.github.io/vscode-gherkin-beautifier/`.

### Changed
- **`src/formatter.ts`**: Prefixed unused parameters with underscore (`_options`, `_token`) to suppress TypeScript lint warnings.
- **`src/highlighter.ts`**: Replaced raw hex colors with professional VS Code native palette (`#C586C0`, `#569CD6`, `#4EC9B0`).
- **`src/definition.ts`**: Removed unused `path` import.
- **`src/linter.ts`**: Removed unused `inTable` variable.
- **`src/outline.ts`**: Prefixed unused `_token` param, narrowed return type to `DocumentSymbol[]`.
- **`src/statistics.ts`**: Prefixed unused `_context` parameter.
- **`README.md` & `CONTRIBUTING.md`**: Complete rewrite with modern layout, feature showcase with GIF/PNG demos, configuration table, roadmap section, and author footer. Upgraded to use native GitHub Alerts (`> [!NOTE]`).
- **Documentation (`docs/`)**: Upgraded all markdown pages to use MkDocs Admonitions (`!!! tip`) and visual emojis.
- **Packaging**: Highly optimized `.vscodeignore` to exclude heavy `docs/` and `assets/` folders, dropping the `.vsix` payload size from 18 MB to 408 KB while maintaining functional URLs in the Marketplace.
- **Testing**: Upgraded integration tests to run on Node 22 via `@vscode/test-electron@3.0.0`.

## [1.5.0] - 2026-06-25
### Added
- **Multi-language Support (i18n)**: Formatter now fully supports formatting, indenting, and Auto-Casing for English, Spanish, French, and German Gherkin keywords.
- **Diagnostic Provider (Linter)**: Hardened the linter rules to strictly enforce colons (`:`) on block keywords and spaces on step keywords, immediately flagging syntax errors.
- **Cascading Indentation**: The formatter now uses a beautiful cascading (stair-step) indentation style by default: 2 spaces for `Scenario`, 3 for `Given/When/Then`, and 4 for `And/But`.
- **Inline Comment Alignment**: Formatter now dynamically aligns inline comments (`#`) to the same vertical column for perfect visual readability.
- **Outline Provider**: Added an interactive tree view in the VS Code "Outline" panel for quick navigation between `Feature`, `Rule`, and `Scenario` blocks.
- **Context Menu Command**: Added a "Format Gherkin Document" action to the editor's right-click context menu.
- **Snippets**: Bundled comprehensive autocompletion snippets for common Gherkin blocks (`feature`, `scenario`, `outline`, `rule`).
- **Configuration `gherkinBeautifier.tags.format`**: Added option to format tags either as `wrap` (80 chars max line length) or `singleLine`.
- **Configuration `gherkinBeautifier.emptyLines.betweenScenarios`**: Added setting to customize the exact number of blank lines to enforce between major blocks.
- **Go to Definition (Python/Behave)**: You can now `Cmd + Click` (or `F12`) on any Gherkin step (e.g. `Given I login`) and VS Code will automatically search your `steps/` folder and jump directly to the Python `.py` file where that `@given` or `@step` decorator is defined.
- **Project Statistics Dashboard**: Added a new command (`Gherkin: Show Project Statistics`) that scans your workspace and displays a beautiful HTML dashboard with metrics on your Features, Rules, and Scenarios. This is also accessible by Right-Clicking inside the editor.
- **Beautiful Syntax Highlighting**: Overrides default VS Code themes to dynamically colorize Gherkin files. Features a stunning **Magenta** for structural keywords (`Feature`, `Scenario`, `Rule`) and **Blue** for action steps (`Given`, `When`, `Then`).
- **Real-time Diagnostic Linter**: Includes a built-in Linter that monitors your feature files as you type. If you mistype a keyword or use invalid syntax, the editor will immediately underline it in red and provide an explanation.
- **Built-in Snippets**: Includes standard autocompletion snippets. Type `feature`, `scenario`, `outline`, or `rule` inside a blank document and press `Tab` to instantly scaffold properly formatted templates.

### Changed
- Refactored internal formatting engine to use dynamic Regex mapping for multi-language support.
- Excluded development dependencies and test artifacts (`.vscode-test`, `node_modules`) from the VSIX package via `.vscodeignore`.

## [1.4.0] - 2026-06-24
### Added
- **Auto-Casing**: Formatter now automatically PascalCases Gherkin keywords (`Given`, `When`, `Then`, `Feature`, etc.) regardless of user input.
- **Tag Sorting & Formatting**: Sorts tags alphabetically (e.g., `@smoke @api` -> `@api @smoke`) and formats them based on user configuration. By default, it wraps tags if they exceed 80 characters, but this can be configured to remain on a single line.
- **Whitespace Cleanup**: Automatically collapses consecutive empty lines into a standardized format and trims all trailing whitespace, preventing dirty git commits.
- **Inline Comment Alignment**: Dynamically aligns inline comments (`#`) to the same vertical column within the same code block, creating a beautiful and consistent reading experience.
- **Variable Normalization**: Automatically trims useless spaces inside `Scenario Outline` variables (e.g. `< user name >` becomes `<user name>`) to prevent runner failures.

## [1.3.0] - 2026-06-24
### Added
- **Configuration Settings**: Added support for customizing the formatter via `settings.json`.
  - `gherkinBeautifier.indentation.steps`: Allows changing step indentation (e.g. from 4 to 2 spaces).
  - `gherkinBeautifier.tables.alignToKeyword`: Allows toggling the dynamic table alignment behavior.

## [1.2.0] - 2026-06-24
### Added
- **Format Selection Support**: Implemented `DocumentRangeFormattingEditProvider`. Now you can highlight a specific block of text (like a single table) and format only that section without touching the rest of the file using `Cmd+K Cmd+F` (`Ctrl+K Ctrl+F`).

## [1.1.0] - 2026-06-24
### Added
- **Smart Block Spacing**: Automatically ensures exactly one blank line before major blocks (Scenarios, Rules, Backgrounds, Tags).
- **Dynamic Table Alignment**: Tables now automatically inherit the exact indentation level of their preceding keyword.

## [1.0.0] - 2026-06-24
### Added
- Initial release.
- Core Gherkin indentation formatting engine.
- Intelligent data table alignment algorithm.
- Integration with VS Code `DocumentFormattingEditProvider`.
