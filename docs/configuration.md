# Configuration Reference

Gherkin PowerTools works out of the box with zero configuration. Every setting below is optional.

---

## Configuration Profiles

Profiles establish a baseline formatting configuration.

| Profile | Indentation | Tables | Tags | Empty Lines |
|---|---|---|---|---|
| `custom` *(default)* | 4 spaces | Aligned to keyword | Wrap, preserve order | 1 line |
| `strict` | 4 spaces | Aligned to keyword | Wrap, **alphabetical** | 1 line |
| `team` | 4 spaces | Aligned to keyword | Wrap, preserve order | 1 line |
| `minimal` | 2 spaces | Fixed column | Single line, preserve | 0 lines |
| `legacy` | 2 spaces | Fixed column | Wrap, preserve order | 1 line |

Set a profile in your workspace `.vscode/settings.json` or globally:

```json
"gherkinPowerTools.profile": "strict"
```

Individual settings (like `indentation.steps`) always override the profile defaults.

---

## General Settings

### `gherkinPowerTools.profile`
- **Purpose:** Base formatting profile.
- **Type:** `string` (`"custom"`, `"strict"`, `"team"`, `"minimal"`, `"legacy"`)
- **Default:** `"custom"`

---

## Formatting Settings

### `gherkinPowerTools.formatter.enabled`
- **Purpose:** Master toggle for the document formatter. Set to `false` to disable formatting entirely (useful if relying on external CI formatters).
- **Type:** `boolean`
- **Default:** `true`

### `gherkinPowerTools.indentation.steps`
- **Purpose:** Spaces used to indent step keywords.
- **Type:** `number` (0–8)
- **Default:** `4`

### `gherkinPowerTools.tables.alignToKeyword`
- **Purpose:** Align left border of Data Tables and Examples to the preceding step keyword.
- **Type:** `boolean`
- **Default:** `true`

### `gherkinPowerTools.emptyLines.betweenScenarios`
- **Purpose:** Enforced blank lines between Scenario/Rule blocks.
- **Type:** `number` (0–3)
- **Default:** `1`

### `gherkinPowerTools.tags.format`
- **Purpose:** How to handle long tag lists.
- **Type:** `string` (`"wrap"`, `"singleLine"`)
- **Default:** `"wrap"`

### `gherkinPowerTools.tags.sort`
- **Purpose:** Tag ordering applied on format.
- **Type:** `string` (`"preserve"`, `"alphabetical"`)
- **Default:** `"preserve"`

---

## Diagnostics (Linter) Settings

### `gherkinPowerTools.linter.enabled`
- **Purpose:** Master toggle for the real-time Gherkin linter.
- **Type:** `boolean`
- **Default:** `true`

### `gherkinPowerTools.diagnostics.metricsEnabled`
- **Purpose:** Enable or disable parser diagnostics and performance metrics. When `true`, the extension collects data on AST parsing, cache hits, and document complexity which can be viewed using the 'Show Developer Metrics' command.
- **Type:** `boolean`
- **Default:** `false`

### `gherkinPowerTools.impactAnalysis.enabled`
- **Purpose:** Enable or disable the real-time Impact Analysis engine (blast radius CodeLenses on Python step definitions).
- **Type:** `boolean`
- **Default:** `true`

### `gherkinPowerTools.linter.enabledRules`
- **Purpose:** Whitelist of linting rule IDs to enforce. An empty array enables ALL rules.
- **Type:** `array` of strings
- **Default:** `[]`
- **Allowed Values:** `"MISSING_COLON"`, `"INVALID_KEYWORD"`, `"SEMANTIC_ERROR"`, `"TABLE_INCONSISTENCY"`, `"UNDEFINED_STEP"`, `"AMBIGUOUS_STEP"`

---

## Behave Discovery & Execution Settings

### `gherkinPowerTools.behave.stepGlobs`
- **Purpose:** Glob patterns to discover Python step definitions for IntelliSense, Navigation, and Linting.
- **Type:** `array` of strings
- **Default:** `["**/steps/**/*.py", "**/features/steps/**/*.py"]`

### `gherkinPowerTools.behave.ignoreGlobs`
- **Purpose:** Patterns excluded from step discovery. Always exclude virtual environments to prevent false matches.
- **Type:** `array` of strings
- **Default:** `["**/node_modules/**", "**/.venv/**", "**/venv/**", "**/env/**"]`

### `gherkinPowerTools.behave.command`
- **Purpose:** Base command used to invoke Behave from the Test Explorer.
- **Type:** `string`
- **Default:** `"behave"`
- **Example:** `"poetry run behave"`

### `gherkinPowerTools.behave.additionalArguments`
- **Purpose:** Extra flags appended to every Behave invocation from the Test Explorer.
- **Type:** `array` of strings
- **Default:** `[]`
- **Example:** `["--no-capture"]`

---

## Analytics Settings

### `gherkinPowerTools.analytics.historicalTrends.enabled`
- **Purpose:** Enable or disable historical trend analysis for Gherkin Health. When enabled, dashboard metrics are persisted locally to visualize project evolution over time.
- **Type:** `boolean`
- **Default:** `true`

### `gherkinPowerTools.analytics.historicalTrends.retentionSnapshots`
- **Purpose:** Maximum number of historical snapshots to retain for trend analysis.
- **Type:** `number` (1–365)
- **Default:** `30`

---

## Shared Team Configuration (`.gherkin-powertoolsrc.json`)

You can optionally commit a `.gherkin-powertoolsrc.json` to your repository root to standardize formatting and discovery for the whole team, regardless of their individual VS Code settings.

Example:
```json
{
    "profile": "strict",
    "formatter": {
        "enabled": true
    },
    "linter": {
        "enabledRules": ["MISSING_COLON", "INVALID_KEYWORD"]
    },
    "behave": {
        "stepGlobs": [
            "**/features/steps/**/*.py"
        ],
        "command": "behave"
    }
}
```
*(Note: Properties inside this file do not use the `gherkinPowerTools.` prefix.)*
