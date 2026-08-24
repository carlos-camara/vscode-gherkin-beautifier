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

### `gherkinPowerTools.docStrings.alignToKeyword`
- **Purpose:** When `true`, DocStrings are dynamically padded to align with the text start of the preceding step keyword. Set to `false` for a simpler fixed-column alignment.
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
- **Purpose:** Master toggle for the real-time Gherkin linter. When `false`, the linter enters a completely dormant state—suppressing AST parsing, debounce timers, and notifications to conserve system resources.
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


---

## Anti-pattern Detection Engine Settings

### `gherkinPowerTools.antiPatterns.enabled`
- **Purpose:** Enable or disable the BDD Anti-pattern Detection Engine. When enabled, it runs in the background and populates the editor with diagnostics and the Dashboard with Anti-pattern insights.
- **Type:** `boolean`
- **Default:** `true`



---

## Unified Diagnostics Rules

### `gherkinPowerTools.rules`
- **Purpose:** The central, authoritative configuration for diagnostic severities and heuristic parameters across the Linter and Anti-Pattern Engine. Maps `kebab-case` rule IDs to either a severity string or a configuration object.
- **Type:** `object` (Key-value pairs of rule ID to severity level or configuration object)
- **Allowed Severity Values:** `"error"`, `"warning"`, `"info"`, `"hint"`, `"off"`
- **Example:**
  ```json
  {
      "syntax-error": "error",
      "ambiguous-step": "error",
      "oversized-scenario": {
          "severity": "warning",
          "maxSteps": 20
      },
      "oversized-feature": {
          "severity": "info",
          "maxSteps": 100
      }
  }
  ```

---

## Suppressing Findings

You can suppress heuristic rules directly from the editor using the **Suppress finding** Quick Fix. This creates an entry in an external structural ledger (`.gherkin-pt-suppressions.json`) at the root of your workspace. Any manual edits made to this file are detected instantly and will update your editor diagnostics in real-time.

Example `.gherkin-pt-suppressions.json`:
```json
{
    "$schema": "https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/schemas/suppressions.schema.json",
    "suppressions": [
        {
            "ruleId": "oversized-scenario",
            "uri": "features/legacy_checkout.feature",
            "scopeType": "scenario",
            "scopeValue": "Legacy fallback checkout flow",
            "reason": "Approved exception for legacy component",
            "timestamp": "2026-08-24T12:00:00.000Z",
            "by": "carlos"
        }
    ]
}
```

The extension and the standalone CLI will both automatically detect and respect this file.
Core syntax errors cannot be suppressed.

---

## Behave Discovery & Execution Settings

### `gherkinPowerTools.behave.stepGlobs`
- **Purpose:** Glob patterns to discover Python step definitions for IntelliSense, Navigation, Linting, and to intelligently resolve destinations when generating new step definitions.
- **Type:** `array` of strings
- **Default:** `["**/steps/**/*.py", "**/features/steps/**/*.py"]`

### `gherkinPowerTools.behave.ignoreGlobs`
- **Purpose:** Patterns excluded from step discovery. The extension implements **Zero-Config Virtual Environment Discovery**, which automatically excludes standard virtual environments. Use this setting to exclude additional custom directories to prevent false matches.
- **Type:** `array` of strings
- **Default:** `["**/node_modules/**", "**/.venv/**", "**/venv/**", "**/env/**"]`

### `gherkinPowerTools.behave.execution`
- **Purpose:** Portable, shareable framework execution strategy for Behave. This setting specifies the base runner and arguments.
- **Type:** `object` (with `executable` string and `arguments` array)
- **Default:** `{"executable": "behave", "arguments": []}`
- **Example:** `{"executable": "poetry", "arguments": ["run", "behave"]}`

### `gherkinPowerTools.behave.localExecutable`
- **Purpose:** Absolute path to a local Behave executable or Python interpreter. Overrides the `executable` specified in `behave.execution`. **Machine-specific override**, do not put in `.gherkin-powertoolsrc.json`.
- **Type:** `string`
- **Default:** *None*
- **Example:** `"/home/user/.venv/bin/behave"`


### `gherkinPowerTools.behave.additionalArguments`
- **Purpose:** Extra flags appended to every Behave invocation from the Test Explorer (e.g., `["--no-capture"]`).
- **Type:** `array` of strings
- **Default:** `[]`

---

## Analytics

### `gherkinPowerTools.analytics.historicalTrends.enabled`
- **Purpose:** Enable or disable historical trend analysis for Gherkin Health. When enabled, dashboard metrics are persisted locally to visualize project evolution over time.
- **Type:** `boolean`
- **Default:** `true`

### `gherkinPowerTools.analytics.historicalTrends.retentionSnapshots`
- **Purpose:** Maximum number of historical snapshots to retain for trend analysis per branch.
- **Type:** `number`
- **Default:** `30`

### `gherkinPowerTools.analytics.historicalTrends.maxStorageBytes`
- **Purpose:** Maximum size (in bytes) allowed for the historical trend storage in this workspace. If exceeded, oldest snapshots are pruned regardless of branch.
- **Type:** `number` (10000–5000000)
- **Default:** `500000`

---

## Shared Team Configuration (`.gherkin-powertoolsrc.json`)

You can optionally commit a `.gherkin-powertoolsrc.json` to your repository root to standardize formatting and discovery for the whole team, regardless of their individual VS Code settings. The Standalone CLI (`@carlos-camara/gherkin-pt`) also automatically detects and respects this file.

### Precedence Hierarchy
Configuration settings are resolved in the following order of precedence (highest to lowest):
1. **Machine-Specific Overrides**: User Settings (`behave.localExecutable`).
2. **Project-level `.gherkin-powertoolsrc.json`**: Used to override settings for the entire team and CI/CD.
3. **VS Code Workspace Settings**: Settings configured in `.vscode/settings.json`.
4. **VS Code User Settings**: Global settings.
5. **Profile Defaults**: The base profile specified (e.g. `team` or `strict`).
6. **Extension Defaults**: Standard baseline if nothing is configured.

Example:
```json
{
    "profile": "strict",
    "formatter": {
        "enabled": true
    },
    "rules": {
        "missing-colon": "error",
        "invalid-keyword": "warning"
    },
    "behave": {
        "stepGlobs": [
            "**/features/steps/**/*.py"
        ],
        "execution": {
            "executable": "behave",
            "arguments": []
        }
    }
}
```
*(Note: Properties inside this file do not use the `gherkinPowerTools.` prefix.)*
