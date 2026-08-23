# Configuration Profiles

Gherkin PowerTools supports **Configuration Profiles** via the `.gherkin-powertoolsrc.json` file. This allows teams to share a strict formatting baseline and anti-pattern enforcement across the repository, ensuring all contributors (and CI pipelines) adhere to the same standards.

## Purpose
- **Consistency**: Share formatting rules (e.g., indentation, table alignment) across all developers.
- **Portability**: Ensure the standalone CLI (`@carlos-camara/gherkin-pt`) uses the exact same rules as the VS Code extension.
- **Overrides**: Users can still override specific settings in their local `.vscode/settings.json`, but the repository provides the baseline.

## File Format and Storage Location

Create a `.gherkin-powertoolsrc.json` (or `.gherkin-powertoolsrc`) file in the root of your workspace.

```json
{
  "profile": "team",
  "antiPatterns": {
    "profile": "strict"
  },
  "indentation": {
    "steps": 4
  },
  "tables": {
    "alignToKeyword": true
  },
  "emptyLines": {
    "betweenScenarios": 1
  }
}
```

## Available Profiles

Gherkin PowerTools exposes profiles for both Formatting (`profile`) and the Anti-Pattern Engine (`antiPatterns.profile`).

### Formatting Profiles (`profile`)
You can specify a base `profile` to inherit a predefined set of formatting rules:

- `custom` (Default): Extension defaults — configure individual settings manually.
- `strict`: Strict consistency: 4-space indent, alphabetical tags, 1 blank line between scenarios.
- `team`: Standard team baseline: sensible defaults for large projects without being restrictive.
- `minimal`: Low-interference: 2-space indent, table alignment off, tags on one line, no blank line enforcement.
- `legacy`: Targets older Gherkin/SpecFlow codebases: 2-space indent, table alignment off.

### Anti-Pattern Profiles (`antiPatterns.profile`)
You can leverage Team Profiles to automatically set severity thresholds for subjective heuristics:
- `default`: A balanced profile providing warnings for common anti-patterns without failing builds.
- `strict`: Enforces best-practices vigorously (e.g., `oversized-scenario` defaults to `error`). Ideal for mature projects or strict CI gates.
- `relaxed`: Mutes most maintainability and style warnings. Ideal for prototyping or onboarding legacy test suites.

## Validation and Schema

Gherkin PowerTools automatically contributes a JSON schema for `.gherkin-powertoolsrc.json`. When editing this file in VS Code, you will receive autocomplete, hover descriptions, and validation for all supported settings.

## Precedence and Overrides

Configuration values are resolved in the following order (highest precedence first):

1. **Machine-Specific Overrides**: Settings scoped as `machine-overridable` (e.g., `behave.localExecutable`) set in User Settings.
2. **Configuration Profile**: `.gherkin-powertoolsrc.json` in the workspace root.
3. **Workspace Folder Settings**: `.vscode/settings.json` in the specific folder.
4. **Workspace Settings**: `.vscode/settings.json` at the workspace level.
5. **User Settings**: Global VS Code `settings.json`.
6. **Default Profile**: Inherited from `gherkinPowerTools.profile`.

This means a developer can enforce a strict standard via `.gherkin-powertoolsrc.json` for the repository, which will securely override any local workspace or user settings, ensuring all contributors and CI pipelines use the same baseline. Machine-specific overrides like local executables must be placed in global User Settings.
