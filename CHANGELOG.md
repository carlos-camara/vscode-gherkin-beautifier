# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
### 3. Editor Productivity Tools
* **Go to Definition (Python/Behave)**: You can now `Cmd + Click` (or `F12`) on any Gherkin step (e.g. `Given I login`) and VS Code will automatically search your `steps/` folder and jump directly to the Python `.py` file where that `@given` or `@step` decorator is defined.
* **Project Statistics Dashboard**: Added a new command (`Gherkin: Show Project Statistics`) that scans your workspace and displays a beautiful HTML dashboard with metrics on your Features, Rules, and Scenarios. This is also accessible by Right-Clicking inside the editor.
* **Beautiful Syntax Highlighting**: Overrides default VS Code themes to dynamically colorize Gherkin files. Features a stunning **Magenta** for structural keywords (`Feature`, `Scenario`, `Rule`) and **Blue** for action steps (`Given`, `When`, `Then`).
* **Real-time Diagnostic Linter**: Includes a built-in Linter that monitors your feature files as you type. If you mistype a keyword or use invalid syntax, the editor will immediately underline it in red and provide an explanation.
* **Outline Provider**: Contributes a hierarchical tree view to the native VS Code "Outline" panel. This allows developers to easily navigate massive `.feature` files by jumping between `Feature`, `Rule`, and `Scenario` blocks.
* **Built-in Snippets**: Includes standard autocompletion snippets. Type `feature`, `scenario`, `outline`, or `rule` inside a blank document and press `Tab` to instantly scaffold properly formatted templates.

### Changed
- Refactored internal formatting engine to use dynamic Regex mapping for multi-language support.
- Excluded development dependencies and test artifacts (`.vscode-test`, `node_modules`) from the VSIX package via `.vscodeignore`.

## [1.4.0] - 2026-06-24
### Added
- **Auto-Casing**: Formatter now automatically PascalCases Gherkin keywords (`Given`, `When`, `Then`, `Feature`, etc.) regardless of user input.
-* **Tag Sorting & Formatting**: Sorts tags alphabetically (e.g., `@smoke @api` -> `@api @smoke`) and formats them based on user configuration. By default, it wraps tags if they exceed 80 characters, but this can be configured to remain on a single line.
* **Whitespace Cleanup**: Automatically collapses consecutive empty lines into a standardized format and trims all trailing whitespace, preventing dirty git commits.
* **Inline Comment Alignment**: Dynamically aligns inline comments (`#`) to the same vertical column within the same code block, creating a beautiful and consistent reading experience.
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
