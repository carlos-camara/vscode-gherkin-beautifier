# 💡 Real-Time Linter & Intelligent Quick Fixes

Gherkin PowerTools monitors your `.feature` files **as you type** using the official `@cucumber/gherkin` AST parser — and catches mistakes before Behave ever runs.

---

## What the Linter Detects

| Diagnostic | Severity | Example |
|------------|----------|---------|
| **Missing colon** | Error | `Feature My App` → should be `Feature: My App` |
| **Misspelled keyword** | Error | `Givn I login` → did you mean `Given`? |
| **Semantic structure error** | Error | `Examples:` inside a plain `Scenario` (not `Scenario Outline`) |
| **Malformed data table** | Error | Row missing closing `\|` pipe |
| **Undefined step** | Warning | Step has no matching Python `@given`/`@when`/`@then` decorator |
| **Ambiguous step** | Warning | Step matches more than one Python regex — Behave would fail at runtime |

Errors appear as **red underlines** in the editor, **red markers** in the scrollbar minimap, and **entries in the Problems panel** (`Cmd+Shift+M` / `Ctrl+Shift+M`).

---

## Intelligent Fault Tolerance

The linter uses a **multi-pass hybrid parsing strategy** so you always get pinpoint diagnostics even in severely malformed files:

1. **Primary AST pass** — strict, official Cucumber parser
2. **Cascading error suppression** — when the parser crashes, only the root cause is flagged (no "wall of red squiggles" on valid lines below the error)
3. **Heuristic fallback** — if the AST parse fails completely, a text scanner enforces structural rules (e.g. `Examples` under `Scenario`)
4. **Dynamic line mapping** — AST node positions are remapped to physical editor lines, so every underline lands on the exact offending character

---

## Quick Fixes — `Cmd + .` / `Ctrl + .`

When a diagnostic appears, click the lightbulb or press `Cmd+.` to see available fixes:

- **Insert missing `:`** — appends `:` to `Feature`, `Scenario`, `Scenario Outline`, etc.
- **Replace with `Given` / `When` / `Then`** — Levenshtein-distance typo correction for misspelled keywords
- **Convert to `Scenario Outline`** — converts a `Scenario` that accidentally contains an `Examples:` block
- **Close table row** — appends the missing `|` to the exact unclosed row (scanned across the entire table)
- **Create step definition** — generates a Python stub (`@given(...)`) in your `steps/` folder; handles emoji, quotes, and `And`/`But` keyword inheritance automatically; guarantees collision-free function names

---

## i18n / Dialect Support

All diagnostics and quick fixes are fully **dialect-aware**. Add `# language: es` (or any of 70+ supported languages) and the linter adapts — fuzzy-matching, error messages, and corrections use your local Gherkin keywords.

> **Example:** Typing `Caract` in a Spanish `.feature` file suggests `Característica:` — not `Feature:`.
