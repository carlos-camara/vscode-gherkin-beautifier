# 💡 Syntax Highlighting

Gherkin PowerTools replaces VS Code's generic token colors with a **curated, semantic palette** designed for maximum readability on both dark and light themes.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/highlighting.gif" alt="Syntax Highlighting" width="700" />
</div>

---

## 🎨 Color Palette

| Category | Keywords | Color | Hex |
|----------|----------|-------|-----|
| **Structure** | `Feature`, `Scenario`, `Scenario Outline`, `Rule`, `Background`, `Examples` | Elegant Purple | `#C586C0` |
| **Steps** | `Given`, `When`, `Then`, `And`, `But` | Crisp Blue | `#569CD6` |
| **Tags** | `@smoke`, `@api`, `@wip`, `@regression` | Soft Cyan | `#4EC9B0` |
| **Outline Parameters** | `<username>`, `<role>`, `<amount>` | Warm Orange | `#CE9178` |
| **Comments** | `# language: es`, `# Author: ...` | Muted Green | `#6A9955` |
| **Docstrings** | `"""..."""` multi-line blocks | Italic Gray | `#9CDCFE` |

---

## ⚙️ How It Works

The highlighter uses VS Code's `createTextEditorDecorationType` API to apply **semantic decorations on top of any theme** — Dark+, Monokai, One Dark Pro, or any custom theme you use.

This means the colors are always consistent and do not depend on what the theme defines for the `feature` language grammar. You get the same beautiful palette everywhere.

**Two layers of highlighting:**

1. **Grammar-based** — Keywords, tags, and comments are tokenized via the bundled `gherkin.tmLanguage` TextMate grammar. This provides correct scoped tokenization that integrates with VS Code's semantic token system.
2. **Dynamic decoration** — Outline parameters (`<param>`) inside step text are detected at runtime and highlighted with a distinct color, making it immediately obvious which values will be substituted from the `Examples:` table.

---

## 🔄 Real-Time Updates

Highlighting updates instantly as you type — no save required. The highlighter listens to `onDidChangeTextDocument` and `onDidChangeActiveTextEditor` events, so the decorations are always in sync with the document's current content.

---

## ✅ Zero Configuration

Syntax highlighting activates automatically when you open any `.feature` or `.gherkin` file. No settings, no configuration files, no reload needed.

> **Tip:** If you use a light theme, the colors are still readable — the palette was designed with sufficient contrast for both dark and light backgrounds.
