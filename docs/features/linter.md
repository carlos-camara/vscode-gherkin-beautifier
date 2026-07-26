# 🔍 Live Diagnostics & Quick Fixes

Writing Gherkin should be error-free before you even execute your test suite. The **Gherkin PowerTools** integrates a real-time semantic and syntactic linter directly into VS Code to catch mistakes the moment you type them.

## ⚙️ How It Works

The built-in linter monitors your `.feature` files **in real-time** using the official `@cucumber/gherkin` AST Parser. If you mistype a keyword, use invalid syntax, or violate Gherkin semantics, the editor immediately underlines the exact offending token and provides an explanation in the Problems panel.



## 🛡️ What It Detects

| Diagnostic | Rule Description | Example |
|------------|------------------|---------|
| **Missing Colon** | Block keywords must end with `:` | `Scenario` → ❌ should be `Scenario:` |
| **Invalid Keyword** | Detects misspelled Gherkin keywords | `Givn I login` → ❌ should be `Given` |
| **Semantic Error** | Validates proper structural nesting | A `Scenario` containing an `Examples:` block → ⚠️ |
| **Table Inconsistency** | Verifies data table integrity | Forgetting a closing `&#124;` in a table row → ❌ |
| **Undefined Step** | Cross-references the Symbol Cache | `Given I do magic` (no Python match) → ⚠️ |
| **Ambiguous Step** | Detects overlapping Python decorators | Step matches multiple `@given` regexes → ⚠️ |

> **📝 Note:** **Lazy Semantic Checks:** Syntax and structural diagnostics (Missing Colon, Invalid Keyword, Semantic Error, Table Inconsistency) are available **immediately** from the first keystroke. Undefined Step and Ambiguous Step diagnostics require the Symbol Cache to be ready, which typically takes 2–5 seconds after opening VS Code. During this brief window, no false "undefined step" warnings are shown.

## 🛡️ Fault-Tolerant Hybrid Parsing

Gherkin parsers are notoriously strict and often crash completely (failing to return an Abstract Syntax Tree) if they encounter severe typos or structural malformations.

To guarantee that you always receive accurate diagnostics regardless of how "broken" the file is, our Linter employs a **Multi-Pass Hybrid Parsing Strategy**:
1. **Primary AST Pass**: Uses the official `@cucumber/gherkin` parser to validate strict structural and semantic rules.
2. **Cascading Error Suppression**: When the official parser crashes due to a structural error (e.g., missing a `:`
   after `Scenario`), it traditionally breaks the internal state machine, causing a massive "wall of red squiggles"
   on perfectly valid steps below the error. The linter now intelligently suppresses these cascading syntax errors
   on locally valid lines, pinpointing exactly where the true structural error occurred without overwhelming the user.
3. **Custom Heuristic Fallback**: If the official parser crashes entirely (e.g., typing `Whe` instead of `When`), our custom engine kicks in. It scans the document via text-based heuristics to ensure structural rules (like forbidding an `Examples` table under a standard `Scenario`) are still enforced.
4. **Dynamic Line Mapping**: Parsers often silently strip blank lines from descriptions, causing error diagnostics to point to the wrong physical lines in your editor. Our engine dynamically maps AST logic back to the exact physical lines in VS Code, ensuring pixel-perfect accuracy for every red underline.

## 🌍 Global Dialect Support (i18n)

The linter is fully **dialect-aware**. It automatically reads your `# language: [code]` header and dynamically adjusts all semantic rules, fuzzy-matching logic, and diagnostic messages to match your local language.

- **Localized Quick-Fixes**: Misspellings trigger Quick-Fixes tailored to your dialect (e.g., `Did you mean 'Fonctionnalité:'?` instead of `Feature:`).
- **Context-Aware Fuzzy Matching**: The text-based heuristic scanner evaluates structural context before offering corrections, ensuring normal prose (like writing "when" or "given" in a sentence) is never aggressively flagged as a syntax error.
- **Semantic Fallbacks**: Dialect awareness applies even during severe syntax errors. The extension correctly identifies errors like using localized `Examples` under a localized `Scenario` (instead of `Scenario Outline`) seamlessly across French, German, Spanish, Arabic, and over 70 other Gherkin dialects.

## 💡 Intelligent Code Actions (Quick Fixes)

The Linter integrates deeply with VS Code's **Quick Fix** system (the yellow lightbulb 💡). Instead of just pointing out errors, the extension actively offers to fix them for you.

When a diagnostic appears, click the lightbulb or press `Cmd+.` (macOS) / `Ctrl+.` (Windows/Linux) to trigger an auto-correction:

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/linter.gif" alt="Linter Demonstration" width="600" />
</div>

- **Insert missing ':'**: When a block keyword (`Feature`, `Scenario`, etc.) is missing a colon, this action instantly appends it.
- **Dynamic Keyword Auto-Complete**: Start typing a keyword (e.g., `whe`, `give`, `scen`) and the extension uses prefix-matching to suggest the full keyword (`When`, `Given`, `Scenario`) instantly.
- **Advanced Typo Correction (Levenshtein Distance)**: If you misspell a keyword with mixed letters (e.g., `Givn`, `Wehn`, `Fature`), our built-in Levenshtein distance algorithm automatically calculates the closest valid Gherkin keyword and offers a one-click fix to replace it.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/auto-corrections.gif" alt="Quick Fix — correct keyword typos with one keypress" width="600" />
</div>
- **Hidden Typo Detection**: Gherkin parsers often ignore misspelled keywords by silently treating them as string descriptions. Our linter actively scans all free-text descriptions under scenarios and features to hunt down hidden typos and flag them for correction.
- **Convert to 'Scenario Outline'**: A standard `Scenario` cannot contain an `Examples:` block. If you accidentally add one, this action instantly converts the block to a `Scenario Outline`.
- **Intelligent Table Row Closure**: Gherkin parsers often assign cell inconsistency errors to the wrong row if a header is missing a closing pipe `|`. The extension actively scans the entire table upwards and downwards to pinpoint the exact unclosed row, and appends the pipe `|` for you.
- **Create empty step definition**: When an undefined step is detected (⚠️), this action automatically generates
  a safe, syntax-compliant Python stub (`@given(...)`) and inserts it into your `steps/` folder.
  It intelligently escapes strings containing quotes or emojis, guarantees collision-free function names
  (e.g. `def step_impl_1(context)`), and resolves `And` and `But` keywords by scanning upwards
  to inherit the correct preceding decorator.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/create-step.gif" alt="Create Empty Step Definition Demo" width="600" />
</div>

<div style="border-radius: 8px; overflow: hidden; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid #d1d5db;">
  <div style="background: #1f2937; padding: 10px 16px; display: flex; align-items: center; gap: 8px;">
    <span style="font-size: 16px;">💡</span>
    <span style="color: #f9fafb; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase;">Integration Ecosystem</span>
  </div>
  <div style="background-color: #ffffff; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;">
    <p style="color: #374151; font-size: 13px; margin: 0 0 6px 0;">Diagnostics appear natively in:</p>
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="color: #6b7280; font-size: 16px; flex-shrink: 0; line-height: 1;">◆</span>
      <span style="color: #374151; font-size: 13px;"><strong style="color: #111827;">Editor Gutter</strong> — Red and yellow underlines on the offending lines.</span>
    </div>
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="color: #6b7280; font-size: 16px; flex-shrink: 0; line-height: 1;">◆</span>
      <span style="color: #374151; font-size: 13px;">
        <strong style="color: #111827;">Problems Panel</strong> — Accessible via
        <kbd style="background:#f3f4f6; border: 1px solid #d1d5db; border-radius: 3px; padding: 1px 5px; font-size: 11px; color: #1f2937;">Ctrl+Shift+M</kbd> /
        <kbd style="background:#f3f4f6; border: 1px solid #d1d5db; border-radius: 3px; padding: 1px 5px; font-size: 11px; color: #1f2937;">⌘⇧M</kbd>.
      </span>
    </div>
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="color: #6b7280; font-size: 16px; flex-shrink: 0; line-height: 1;">◆</span>
      <span style="color: #374151; font-size: 13px;"><strong style="color: #111827;">Minimap</strong> — Color-coded highlights in the scroll bar for rapid scanning.</span>
    </div>
  </div>
</div>
