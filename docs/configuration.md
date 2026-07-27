# ⚙️ Configuration

Gherkin PowerTools works out of the box with zero configuration. Every setting below is optional — change only what you need.

---

## Quick Reference

| Setting | Default | Group | What it controls |
|---|---|---|---|
| `gherkinPowerTools.profile` | `"custom"` | General | Baseline configuration profile |
| `gherkinPowerTools.formatter.enabled` | `true` | Formatter | Master toggle for the document formatter |
| `gherkinPowerTools.indentation.steps` | `4` | Formatter | Spaces before step keywords |
| `gherkinPowerTools.tables.alignToKeyword` | `true` | Formatter | Align table left edge to preceding step text |
| `gherkinPowerTools.emptyLines.betweenScenarios` | `1` | Formatter | Blank lines between Scenario/Rule blocks |
| `gherkinPowerTools.tags.format` | `"wrap"` | Formatter | `"wrap"` or `"singleLine"` tag layout |
| `gherkinPowerTools.tags.sort` | `"preserve"` | Formatter | `"preserve"` or `"alphabetical"` tag order |
| `gherkinPowerTools.linter.enabled` | `true` | Linter | Master toggle for the real-time linter |
| `gherkinPowerTools.linter.enabledRules` | `[]` (= all) | Linter | Whitelist of rule IDs to enforce |
| `gherkinPowerTools.behave.stepGlobs` | `["**/steps/**/*.py", …]` | Discovery | Python step file discovery patterns |
| `gherkinPowerTools.behave.ignoreGlobs` | `["**/node_modules/**", …]` | Discovery | Paths excluded from discovery |
| `gherkinPowerTools.behave.command` | `"behave"` | Execution | Base command for running Behave |
| `gherkinPowerTools.behave.additionalArguments` | `[]` | Execution | Extra flags passed to every Behave invocation |

> 📝 Changes to `behave.stepGlobs` or `behave.ignoreGlobs` take effect **immediately** — the extension reloads its step cache and file watchers without requiring a VS Code restart.

---

## Configuration Precedence

Settings are resolved in the following order (highest → lowest priority):

1. **`.gherkin-powertoolsrc.json`** — Project-level file committed to source control; applies to all contributors
2. **`.vscode/settings.json`** — Workspace-level settings; applies only to your local VS Code instance
3. **User `settings.json`** — Global settings; applies to all workspaces
4. **Profile defaults** — Applied first as the baseline when a `profile` is specified
5. **Extension defaults** — Absolute fallback when nothing else is configured

---

## Configuration Profiles

Profiles let you establish a formatting baseline and then selectively override individual settings.

| Profile | Indentation | Tables | Tags | Empty Lines |
|---|---|---|---|---|
| `custom` *(default)* | 4 spaces | Aligned to keyword | Wrap, preserve order | 1 line |
| `strict` | 4 spaces | Aligned to keyword | Wrap, **alphabetical** | 1 line |
| `team` | 4 spaces | Aligned to keyword | Wrap, preserve order | 1 line |
| `minimal` | 2 spaces | Fixed column | Single line, preserve | 0 lines |
| `legacy` | 2 spaces | Fixed column | Wrap, preserve order | 1 line |

Set a profile in `settings.json`:

```json
"gherkinPowerTools.profile": "strict"
```

Individual settings always override the profile defaults. Use a profile as a shortcut for the common case, then tweak what differs.

---

## Settings Detail

### 🎨 Formatter

#### `gherkinPowerTools.formatter.enabled`

Master toggle for the document formatter. When `false`, the extension will no longer format `.feature` files on demand or on save.

```json
"gherkinPowerTools.formatter.enabled": false
```

> Useful for teams that manage formatting exclusively through an external CI step (e.g., a pre-commit hook) and want to remove the formatter from the editor to avoid conflicts.

---

#### `gherkinPowerTools.indentation.steps`

Number of spaces used to indent step keywords (`Given`, `When`, `Then`, `And`, `But`). The Gherkin community standard is `4`. Some legacy codebases use `2`.

```json
"gherkinPowerTools.indentation.steps": 4
```

---

#### `gherkinPowerTools.tables.alignToKeyword`

When `true`, the left border of Data Tables and Examples tables is dynamically padded to align with the text start of the preceding step — not just a fixed column. This produces visually clean alignment that reads naturally alongside the step text.

```json
"gherkinPowerTools.tables.alignToKeyword": true
```

---

#### `gherkinPowerTools.emptyLines.betweenScenarios`

Enforces exactly this number of blank lines between `Scenario`, `Scenario Outline`, and `Rule` blocks. Range: `0`–`3`.

```json
"gherkinPowerTools.emptyLines.betweenScenarios": 1
```

---

#### `gherkinPowerTools.tags.format`

- `"wrap"` — Splits tag lines that exceed 80 characters across multiple lines (recommended for readability)
- `"singleLine"` — Keeps all tags on one line regardless of length (useful for CI pipelines that parse tag lines)

```json
"gherkinPowerTools.tags.format": "wrap"
```

---

#### `gherkinPowerTools.tags.sort`

- `"preserve"` — Keeps tags in their original source order (safe default — no risk of accidental changes)
- `"alphabetical"` — Sorts tags A–Z on every format (recommended for teams who want canonical ordering)

```json
"gherkinPowerTools.tags.sort": "preserve"
```

---

### 🔍 Linter

#### `gherkinPowerTools.linter.enabled`

Master toggle for the real-time Gherkin linter. When `false`, no diagnostics (red/yellow underlines) will appear in `.feature` files.

```json
"gherkinPowerTools.linter.enabled": false
```

> Useful when you rely exclusively on an external CI linter (e.g., `behave --dry-run`) and want to reduce editor noise.

---

#### `gherkinPowerTools.linter.enabledRules`

Whitelist of linting rule IDs to enforce. An **empty array (default) enables ALL rules**. Populate this array to restrict linting to only the specified rules.

```json
"gherkinPowerTools.linter.enabledRules": ["MISSING_COLON", "INVALID_KEYWORD"]
```

**Available rule IDs:**

| Rule ID | What it checks |
|---|---|
| `MISSING_COLON` | Block keywords must end with `:` (`Feature`, `Scenario`, `Background`, `Examples`…) |
| `INVALID_KEYWORD` | Detects misspelled Gherkin keywords using Levenshtein distance |
| `SEMANTIC_ERROR` | Validates structural nesting (e.g., `Examples:` inside a plain `Scenario`) |
| `TABLE_INCONSISTENCY` | Verifies data table cell counts and detects unclosed `\|` pipes |
| `UNDEFINED_STEP` | Flags steps with no matching Python decorator in the Symbol Cache |
| `AMBIGUOUS_STEP` | Flags steps matching multiple Python regex decorators simultaneously |

> 💡 **Enterprise pattern:** Set `enabledRules` to `["MISSING_COLON", "INVALID_KEYWORD", "SEMANTIC_ERROR", "TABLE_INCONSISTENCY"]` to enforce structural checks while suppressing `UNDEFINED_STEP` and `AMBIGUOUS_STEP` in projects where step discovery is managed externally.

---

### 🐍 Behave / Step Discovery

#### `gherkinPowerTools.behave.stepGlobs`

Glob patterns used to discover Python step definition files. These patterns drive **IntelliSense**, **Go to Definition**, **Hover**, and **undefined step detection**.

```json
"gherkinPowerTools.behave.stepGlobs": [
    "**/steps/**/*.py",
    "**/features/steps/**/*.py"
]
```

Add extra patterns for monorepos or non-standard project layouts:

```json
"gherkinPowerTools.behave.stepGlobs": [
    "**/steps/**/*.py",
    "**/features/steps/**/*.py",
    "**/shared_steps/**/*.py"
]
```

Changes take effect **immediately** — no restart required.

---

#### `gherkinPowerTools.behave.ignoreGlobs`

Patterns excluded from step discovery. Always exclude virtual environments and dependency folders to prevent false IntelliSense matches and performance degradation.

```json
"gherkinPowerTools.behave.ignoreGlobs": [
    "**/node_modules/**",
    "**/.venv/**",
    "**/venv/**",
    "**/env/**"
]
```

Changes take effect **immediately** — no restart required.

---

### ▶️ Behave / Execution

#### `gherkinPowerTools.behave.command`

The base command used to invoke Behave from the Test Explorer. Override this when using a virtual environment manager or a wrapper script.

| Environment | Command |
|---|---|
| Default | `"behave"` |
| Poetry | `"poetry run behave"` |
| Pipenv | `"pipenv run behave"` |
| Direct venv | `".venv/bin/behave"` |
| Module invocation | `"python -m behave"` |

```json
"gherkinPowerTools.behave.command": "poetry run behave"
```

---

#### `gherkinPowerTools.behave.additionalArguments`

Extra flags appended to **every** Behave invocation from the Test Explorer. Useful for persistent flags that should always be active.

```json
"gherkinPowerTools.behave.additionalArguments": ["--no-capture"]
```

**Common examples:**

| Flag | Effect |
|---|---|
| `["--no-capture"]` | Show `print()` output in the terminal |
| `["-D", "env=staging"]` | Pass a Behave userdata variable |
| `["--format", "progress"]` | Change the output format |
| `["--tags=@wip"]` | Restrict execution to `@wip` scenarios |

---

## Full Example Configuration

```json
{
    "gherkinPowerTools.profile": "strict",
    "gherkinPowerTools.formatter.enabled": true,
    "gherkinPowerTools.indentation.steps": 4,
    "gherkinPowerTools.tables.alignToKeyword": true,
    "gherkinPowerTools.emptyLines.betweenScenarios": 1,
    "gherkinPowerTools.tags.format": "wrap",
    "gherkinPowerTools.tags.sort": "alphabetical",
    "gherkinPowerTools.linter.enabled": true,
    "gherkinPowerTools.linter.enabledRules": [],
    "gherkinPowerTools.behave.stepGlobs": [
        "**/steps/**/*.py",
        "**/features/steps/**/*.py"
    ],
    "gherkinPowerTools.behave.ignoreGlobs": [
        "**/node_modules/**",
        "**/.venv/**"
    ],
    "gherkinPowerTools.behave.command": "poetry run behave",
    "gherkinPowerTools.behave.additionalArguments": [
        "--no-capture"
    ]
}
```

---

## Shared Project Configuration (`.gherkin-powertoolsrc.json`)

Commit a `.gherkin-powertoolsrc.json` to the repository root to standardize formatting and discovery for the whole team — regardless of individual VS Code settings.

The extension provides full **JSON Schema validation**, **autocompletion**, and **hover documentation** when editing this file in VS Code.

> 📝 Properties inside `.gherkin-powertoolsrc.json` do **not** use the `gherkinPowerTools.` prefix. They use a nested object structure. Use `Ctrl+Space` inside the file to trigger autocompletion.

```json
{
    "profile": "strict",
    "formatter": {
        "enabled": true
    },
    "indentation": {
        "steps": 4
    },
    "tables": {
        "alignToKeyword": true
    },
    "tags": {
        "format": "wrap",
        "sort": "alphabetical"
    },
    "emptyLines": {
        "betweenScenarios": 1
    },
    "linter": {
        "enabled": true,
        "enabledRules": []
    },
    "behave": {
        "stepGlobs": [
            "**/steps/**/*.py",
            "**/features/steps/**/*.py"
        ],
        "ignoreGlobs": [
            "**/node_modules/**",
            "**/.venv/**"
        ],
        "command": "behave",
        "additionalArguments": []
    }
}
```

> 💡 Commit this file alongside your `.vscode/settings.json` so both the team config and VS Code preferences are tracked in source control.

---

## Enterprise Configuration Patterns

### Disable linting, keep formatting

```json
{
    "linter": { "enabled": false },
    "formatter": { "enabled": true }
}
```

### Structural linting only (suppress step resolution checks)

```json
{
    "linter": {
        "enabled": true,
        "enabledRules": ["MISSING_COLON", "INVALID_KEYWORD", "SEMANTIC_ERROR", "TABLE_INCONSISTENCY"]
    }
}
```

Useful when your CI pipeline handles step validation externally (e.g., `behave --dry-run`) and you want to suppress `UNDEFINED_STEP` false positives during onboarding or migration.

### Monorepo with shared steps

```json
{
    "behave": {
        "stepGlobs": [
            "**/features/steps/**/*.py",
            "**/shared/steps/**/*.py",
            "**/packages/*/steps/**/*.py"
        ]
    }
}
```

---

## Automated First-Run Onboarding

When you open a workspace containing Python Behave files, Gherkin PowerTools silently inspects your structure. If step files exist in locations not covered by `stepGlobs`, a single non-blocking notification offers:

| Action | Effect |
|---|---|
| **⚙️ Settings** | Appends recommended glob patterns to `.vscode/settings.json` |
| **📄 Config** | Creates or merges recommended patterns into `.gherkin-powertoolsrc.json` |
| **🩺 Diagnostics** | Opens the `Gherkin: Diagnose Workspace` report |

See [Onboarding](features/onboarding.md) for full details.
