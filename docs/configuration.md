# ⚙️ Configuration

Gherkin PowerTools works out of the box with zero configuration. Every setting below is optional — change only what you need.

---

## Quick Reference

| Setting | Default | What it controls |
|---------|---------|-----------------|
| `gherkinPowerTools.profile` | `"custom"` | Baseline configuration profile |
| `gherkinPowerTools.indentation.steps` | `4` | Spaces before step keywords |
| `gherkinPowerTools.tables.alignToKeyword` | `true` | Align table left edge to preceding step text |
| `gherkinPowerTools.emptyLines.betweenScenarios` | `1` | Blank lines between Scenario/Rule blocks |
| `gherkinPowerTools.tags.format` | `"wrap"` | `"wrap"` or `"singleLine"` tag layout |
| `gherkinPowerTools.tags.sort` | `"preserve"` | `"preserve"` or `"alphabetical"` tag order |
| `gherkinPowerTools.behave.stepGlobs` | `["**/steps/**/*.py", "**/features/steps/**/*.py"]` | Python step file discovery patterns |
| `gherkinPowerTools.behave.ignoreGlobs` | `["**/node_modules/**", "**/.venv/**", "**/venv/**", "**/env/**"]` | Paths excluded from discovery |
| `gherkinPowerTools.behave.command` | `"behave"` | Base command for running Behave |
| `gherkinPowerTools.behave.additionalArguments` | `[]` | Extra flags passed to every Behave invocation |

> **Note:** Changes to `behave.stepGlobs` or `behave.ignoreGlobs` take effect **immediately** — the extension reloads its step cache and file watchers without requiring a VS Code restart.

---

## Configuration Profiles

Profiles let you establish a formatting baseline and then selectively override individual settings.

| Profile | Description |
|---------|-------------|
| `custom` *(default)* | Uses the extension's own defaults — a sensible starting point for any project |
| `strict` | Strict consistency: 4-space indentation, alphabetically sorted tags, 1 blank line between scenarios |
| `team` | Standard baseline for large teams — enforces consistency without being overly restrictive |
| `minimal` | Low interference: 2-space indentation, table alignment disabled, tags on a single line, no blank line enforcement |
| `legacy` | Targets older Gherkin codebases or SpecFlow defaults: 2-space indentation, table alignment disabled |

Set a profile in `settings.json`:

```json
"gherkinPowerTools.profile": "strict"
```

Individual settings always override the profile defaults.

---

## Settings Detail

### Formatting

#### `gherkinPowerTools.indentation.steps`
Number of spaces used to indent step keywords (`Given`, `When`, `Then`, `And`, `But`).

```json
"gherkinPowerTools.indentation.steps": 4
```

#### `gherkinPowerTools.tables.alignToKeyword`
When `true`, the left border of Data Tables and Examples tables is dynamically padded to align with the text start of the preceding step — not just to a fixed column.

```json
"gherkinPowerTools.tables.alignToKeyword": true
```

#### `gherkinPowerTools.emptyLines.betweenScenarios`
Enforces exactly this number of blank lines between `Scenario`, `Scenario Outline`, and `Rule` blocks.

```json
"gherkinPowerTools.emptyLines.betweenScenarios": 1
```

#### `gherkinPowerTools.tags.format`
- `"wrap"` — Splits tag lines that exceed the wrap column across multiple lines
- `"singleLine"` — Keeps all tags on one line regardless of length

```json
"gherkinPowerTools.tags.format": "wrap"
```

#### `gherkinPowerTools.tags.sort`
- `"preserve"` — Keeps tags in their original source order
- `"alphabetical"` — Sorts tags A–Z on every format

```json
"gherkinPowerTools.tags.sort": "preserve"
```

---

### Behave / Execution

#### `gherkinPowerTools.behave.stepGlobs`
An array of glob patterns pointing to Python files containing Behave step definitions. Used for IntelliSense, Hover, Go to Definition, and undefined step detection.

```json
"gherkinPowerTools.behave.stepGlobs": [
    "**/steps/**/*.py",
    "**/features/steps/**/*.py"
]
```

#### `gherkinPowerTools.behave.ignoreGlobs`
Patterns excluded from step discovery. Always exclude virtual environments and dependency folders.

```json
"gherkinPowerTools.behave.ignoreGlobs": [
    "**/node_modules/**",
    "**/.venv/**",
    "**/venv/**",
    "**/env/**"
]
```

#### `gherkinPowerTools.behave.command`
The base command used to invoke Behave. Customize this when using `pipenv`, `poetry`, or a virtual environment.

```json
"gherkinPowerTools.behave.command": "poetry run behave"
```

#### `gherkinPowerTools.behave.additionalArguments`
Extra flags appended to every Behave execution from the Test Explorer. Useful for persistent flags like `--no-capture` or `-D env=staging`.

```json
"gherkinPowerTools.behave.additionalArguments": ["--no-capture"]
```

---

## Full Example Configuration

```json
{
    "gherkinPowerTools.profile": "strict",
    "gherkinPowerTools.indentation.steps": 4,
    "gherkinPowerTools.tables.alignToKeyword": true,
    "gherkinPowerTools.emptyLines.betweenScenarios": 1,
    "gherkinPowerTools.tags.format": "wrap",
    "gherkinPowerTools.tags.sort": "alphabetical",
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

## Configuration Precedence

Settings are resolved in the following order (highest to lowest priority):

1. **`.gherkin-powertoolsrc.json`** — Project-level file committed to source control; applies to all contributors
2. **`.vscode/settings.json`** — Workspace-level settings; applies only to your local VS Code instance
3. **User `settings.json`** — Global settings; applies to all workspaces

---

## Shared Project Configuration (`.gherkin-powertoolsrc.json`)

Commit a `.gherkin-powertoolsrc.json` to the repository root to standardize formatting and discovery for the whole team — regardless of individual VS Code settings.

The extension provides full **JSON Schema validation**, **autocompletion**, and **hover documentation** when editing this file in VS Code.

> **Important:** Properties inside `.gherkin-powertoolsrc.json` do **not** use the `gherkinPowerTools.` prefix. They use a nested object structure. Use <kbd>Ctrl+Space</kbd> inside the file to trigger autocompletion.

```json
{
    "profile": "strict",
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

> **Tip:** Commit this file alongside your `.vscode/settings.json` so both the team config and VS Code preferences are tracked in source control.

---

## Automated First-Run Onboarding

When you open a workspace containing Python Behave files, Gherkin PowerTools silently inspects your structure. If step files exist in locations not covered by `stepGlobs`, a single non-blocking notification offers:

| Action | Effect |
|--------|--------|
| **⚙️ Settings** | Appends recommended glob patterns to `.vscode/settings.json` |
| **📄 Config** | Creates or merges recommended patterns into `.gherkin-powertoolsrc.json` |
| **🩺 Diagnostics** | Opens the `Gherkin: Diagnose Workspace` report |

See [Onboarding](features/onboarding.md) for full details.
