# Configuration

Gherkin Beautifier works perfectly out-of-the-box, but you can tailor it to your team's style guide via your `settings.json`.

## Available Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gherkinBeautifier.indentation.steps` | `4` | Number of spaces to indent all steps (`Given`, `When`, `Then`, `And`, `But`). |
| `gherkinBeautifier.tables.alignToKeyword` | `true` | If enabled, tables dynamically pad their left border to match the text length of the preceding step. |
| `gherkinBeautifier.emptyLines.betweenScenarios` | `1` | Enforces the exact number of blank lines between `Scenario` and `Rule` blocks. |
| `gherkinBeautifier.tags.format` | `"wrap"` | Choose `"wrap"` to split long tags across lines, or `"singleLine"` to keep them contiguous. |

## Example Configuration

```json
{
    "gherkinBeautifier.indentation.steps": 2,
    "gherkinBeautifier.tables.alignToKeyword": true,
    "gherkinBeautifier.emptyLines.betweenScenarios": 1,
    "gherkinBeautifier.tags.format": "wrap"
}
```

## Workspace vs User Settings

- **User Settings**: Apply globally to all your projects.
- **Workspace Settings**: Apply only to the current project (via `.vscode/settings.json`).

!!! tip "Team Standardization"
    For team projects, commit a `.vscode/settings.json` with your preferred Gherkin Beautifier settings so all contributors use the same formatting rules.
