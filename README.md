# Gherkin Beautifier for VS Code

<p align="center">
  <img src="./assets/logo.png" width="128" alt="Gherkin Beautifier Logo">
</p>

A comprehensive, highly professional formatting extension for Visual Studio Code designed to format, align, and organize Gherkin (`.feature`) files. It ensures that your Behavioral Driven Development (BDD) documentation remains clean, readable, and standardized across your entire team.

---

## Comprehensive Feature Set

### 1. Advanced Formatting Engine
* **Native VS Code Integration**: Integrates directly with the VS Code formatting API. You can format via the standard `Shift+Alt+F` shortcut, the Command Palette, or the right-click context menu ("Format Gherkin Document").
* **Multi-language Support (i18n)**: Fully supports formatting, indenting, and auto-casing keywords in **English**, **Spanish** (`Dado`, `Cuando`, `Escenario`), **French** (`Soit`, `Quand`, `Scénario`), and **German** (`Angenommen`, `Wenn`, `Szenario`).
* **Auto-Casing**: Normalizes the capitalization of all keywords automatically (e.g., `feature` becomes `Feature`, `cuando` becomes `Cuando`). This ensures that regardless of how a user types the keyword, the repository maintains a strict standard.
* **Tag Sorting & Formatting**: Sorts tags alphabetically (e.g., `@smoke @api` -> `@api @smoke`) and formats them based on user configuration. By default, it wraps tags if they exceed 80 characters, but this can be configured to remain on a single line.
* **Whitespace Cleanup**: Automatically collapses consecutive empty lines into a standardized format and trims all trailing whitespace, preventing dirty git commits.

### 2. Intelligent Table Alignment
* **Max Column Width Calculation**: Calculates the maximum column width for Step Data Tables and `Examples:` tables, applying precise padding to align `|` characters vertically.
* **Relative Table Indentation**: Data tables dynamically adapt to the length of their preceding keyword (`Given`, `When`, `Then`) to align their left border precisely with the start of the step description.

### 3. Editor Productivity Tools
* **Outline Provider**: Contributes a hierarchical tree view to the native VS Code "Outline" panel. This allows developers to easily navigate massive `.feature` files by jumping between `Feature`, `Rule`, and `Scenario` blocks.
* **Built-in Snippets**: Includes standard autocompletion snippets. Type `feature`, `scenario`, `outline`, or `rule` inside a blank document and press `Tab` to instantly scaffold properly formatted templates.

---

## Detailed Formatting Example

### Before Formatting (Unstructured)

```gherkin
Feature: User Authentication
@regression @login
Scenario: Login with multiple user roles
Dado the system is running
  Cuando I navigate to the login page
Y I enter my credentials
|role|username|password|
|admin|admin_user|super_secret_123|
|guest|guest_user|1234|
 Entonces I should see the appropriate dashboard
```

### After Formatting (`Shift+Alt+F`)

```gherkin
Feature: User Authentication

  @login @regression
  Scenario: Login with multiple user roles
    Dado the system is running
    Cuando I navigate to the login page
    Y I enter my credentials
      | role  | username   | password         |
      | admin | admin_user | super_secret_123 |
      | guest | guest_user | 1234             |
    Entonces I should see the appropriate dashboard
```

*(Note how the table's left pipe `|` perfectly aligns with the "I" in the preceding "Y" step, and how the Spanish keywords were respected and auto-cased).*

---

## Extension Configuration

You can customize the formatter behavior by modifying your VS Code `settings.json`. The following configuration options are available:

### `gherkinBeautifier.indentation.steps`
* **Type:** `number`
* **Default:** `4`
* **Description:** Defines the number of spaces to indent steps (`Given`, `When`, `Then`, `Examples`, etc). Change to `2` if you prefer tighter code spacing.

### `gherkinBeautifier.tables.alignToKeyword`
* **Type:** `boolean`
* **Default:** `true`
* **Description:** If `true`, data tables dynamically align with the text of the preceding step. If `false`, tables fall back to fixed indentation.

### `gherkinBeautifier.tags.format`
* **Type:** `string` (`"wrap"` | `"singleLine"`)
* **Default:** `"wrap"`
* **Description:** Controls how lists of tags are formatted. Use `wrap` to split long tag lists across multiple lines (max 80 chars) or `singleLine` to keep all tags on a single line regardless of length.

### `gherkinBeautifier.emptyLines.betweenScenarios`
* **Type:** `number`
* **Default:** `1`
* **Description:** Specifies the exact number of blank lines to enforce between major code blocks (`Scenario`, `Rule`, `Background`).

---

## Installation & Setup

### From Marketplace
1. Open Visual Studio Code.
2. Go to the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Search for **"Gherkin Beautifier"**.
4. Click **Install**.

### Recommended Settings
To maximize productivity, we recommend enabling "Format On Save" for feature files by adding the following to your `settings.json`:
```json
"[feature]": {
    "editor.formatOnSave": true
}
```

---

## Contributing
We welcome contributions from the community. Please review [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed instructions on how to set up the repository locally, run the comprehensive test suite, build the `.vsix` package from source, and submit Pull Requests.

## License
This project is open-source and licensed under the MIT License. See the [LICENSE](./LICENSE) file for full details.
