# Syntax Highlighting

Replaces glaring, standard colors with a curated palette that looks stunning on dark themes.

## Color Palette

| Category | Keywords | Color | Hex |
|----------|----------|-------|-----|
| **Structure** | `Feature`, `Scenario`, `Rule`, `Background` | Elegant Purple | `#C586C0` |
| **Actions** | `Given`, `When`, `Then`, `And`, `But` | Crisp Blue | `#569CD6` |
| **Tags** | `@smoke`, `@api`, `@wip` | Soft Cyan | `#4EC9B0` |

## How It Works

The highlighter uses VS Code's `createTextEditorDecorationType` API to apply custom decorations. This means it works **on top of any theme** — including Dark+, Monokai, and One Dark Pro.

## Automatic Activation

Syntax highlighting activates automatically when you open any `.feature` or `.gherkin` file. No configuration needed.

![Syntax Highlighting](https://raw.githubusercontent.com/carloscamara/vscode-gherkin-beautifier/main/assets/highlighting.png)
