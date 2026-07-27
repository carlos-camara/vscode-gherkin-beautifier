# 🔍 Live Diagnostics & Quick Fixes

> Writing Gherkin should be error-free **before** you execute a single test. Gherkin PowerTools integrates a real-time semantic and syntactic linter directly into VS Code — catching mistakes the moment you type them, not when CI fails hours later.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/linter.gif" alt="Linter Demonstration" width="600" />
</div>

---

## ⚙️ How It Works

The built-in linter monitors your `.feature` files **in real-time** using the official `@cucumber/gherkin` AST Parser. The moment you mistype a keyword, use invalid syntax, or violate Gherkin semantics, the editor underlines the exact offending token and surfaces an explanation in the Problems panel — no save needed.

---

## 🛡️ What It Detects

| Diagnostic | Rule | Example |
|---|---|---|
| **Missing Colon** | Block keywords must end with `:` | `Scenario` → ❌ should be `Scenario:` |
| **Invalid Keyword** | Detects misspelled Gherkin keywords | `Givn I login` → ❌ should be `Given` |
| **Semantic Error** | Validates proper structural nesting | `Scenario` containing an `Examples:` block → ⚠️ |
| **Table Inconsistency** | Verifies data table cell integrity | Missing closing `\|` in a table row → ❌ |
| **Undefined Step** | Cross-references the Symbol Cache | `Given I do magic` (no Python match) → ⚠️ |
| **Ambiguous Step** | Detects overlapping Python decorators | Step matches multiple `@given` regexes → ⚠️ |

> 📝 **Lazy Semantic Checks:** Syntax diagnostics (Missing Colon, Invalid Keyword, Table Inconsistency) are available **from the first keystroke**. Undefined Step and Ambiguous Step require the Symbol Cache — ready ~2–5 seconds after opening VS Code. No false warnings are shown during the loading window.

---

## 🧱 Fault-Tolerant Hybrid Parsing

Gherkin parsers are notoriously strict — a single typo can crash the entire AST, flooding valid lines below with false errors. Gherkin PowerTools uses a **Multi-Pass Hybrid Parsing Strategy** to prevent this:

| Pass | What it does |
|---|---|
| **1 — Primary AST** | Official `@cucumber/gherkin` parser validates strict structural and semantic rules |
| **2 — Cascading Suppression** | When a structural error crashes the parser, cascading false errors on valid lines below are intelligently suppressed |
| **3 — Heuristic Fallback** | If the parser crashes entirely (e.g. `Whe` instead of `When`), a custom text-based engine enforces structural rules |
| **4 — Dynamic Line Mapping** | AST diagnostics are remapped to the exact physical line in VS Code, fixing off-by-one errors caused by blank lines in descriptions |

---

## 🌍 Global Dialect Support (i18n)

The linter is fully **dialect-aware** — it reads your `# language: [code]` header and adjusts all rules, fuzzy-matching, and diagnostic messages to match your local language.

| Feature | Detail |
|---|---|
| **Localized Quick-Fixes** | Corrections tailored to your dialect (e.g. `Did you mean 'Fonctionnalité:'?`) |
| **Context-Aware Fuzzy Matching** | Normal prose containing "when" or "given" is never flagged as a syntax error |
| **Semantic Fallbacks** | Works correctly in French, German, Spanish, Arabic, and 70+ other Gherkin dialects |

---

## 💡 Intelligent Code Actions (Quick Fixes)

The linter integrates deeply with VS Code's **Quick Fix** system (💡 lightbulb). Instead of just flagging errors, the extension fixes them for you with a single keypress.

**Trigger:** Click the lightbulb, or press `Cmd+.` (macOS) / `Ctrl+.` (Windows/Linux).

### ✍️ Keyword Fixes

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/auto-corrections.gif" alt="Quick Fix — correct keyword typos with one keypress" width="600" />
</div>

| Action | Description |
|---|---|
| **Insert missing `:`** | Block keyword missing a colon? One click appends it instantly |
| **Dynamic Keyword Auto-Complete** | Type `whe`, `give`, or `scen` and get `When`, `Given`, `Scenario` via prefix-matching |
| **Typo Correction (Levenshtein)** | Misspellings like `Givn`, `Wehn`, `Fature` are auto-corrected to the nearest valid keyword |
| **Hidden Typo Detection** | Scans free-text descriptions under scenarios and features to hunt misspelled keywords silently treated as prose |

### 🏗️ Structure Fixes

| Action | Description |
|---|---|
| **Convert to `Scenario Outline`** | `Scenario` + `Examples:` is invalid — this action converts the block instantly |
| **Intelligent Table Row Closure** | Finds the exact unclosed row in a misaligned table and appends the missing `\|` |

### 🐍 Step Generation

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif" alt="Create Empty Step Definition Demo" width="600" />
</div>

When an undefined step is detected (⚠️), **Create empty step definition** generates a safe Python stub and inserts it into your `steps/` folder:

- Escapes strings containing quotes or emojis
- Guarantees collision-free function names (e.g. `def step_impl_1(context)`)
- Resolves `And` / `But` by scanning upwards to inherit the correct decorator

---

## 🔗 Where Diagnostics Appear

Errors surface across the entire VS Code interface — impossible to miss:

| Location | What you see |
|---|---|
| **Editor Gutter** | 🔴 Red and ⚠️ yellow underlines on the offending tokens |
| **Problems Panel** | Full list with file, line, and message — open with `Ctrl+Shift+M` / `⌘⇧M` |
| **Minimap** | Color-coded highlights in the scrollbar for instant visual scanning |
