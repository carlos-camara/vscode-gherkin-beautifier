# Diagnostics & Quick Fixes

Gherkin PowerTools features two sophisticated engines to ensure your Behavior-Driven Development suites are robust, maintainable, and syntactically correct: the **Real-Time AST Linter** and the **BDD Anti-Pattern Detection Engine**.

---

## 1. Real-Time AST Linter

The real-time AST linter parses your `.feature` files as you type. It immediately flags structural errors and resolves step definitions across your workspace.

### Instant Diagnostics
- **Syntax Errors (`syntax-error`)**: The document contains invalid Gherkin syntax that prevents parsing.
- **Undefined Steps (`undefined-step`)**: No matching Python step definition was found.
- **Ambiguous Steps (`ambiguous-step`)**: Multiple Python step definitions match the step.
- **Missing Colon (`missing-colon`)**: A required trailing colon is missing after a keyword (e.g. Feature, Scenario).
- **Invalid Keyword (`invalid-keyword`)**: The keyword used is not valid for the current Gherkin dialect.
- **Table Inconsistency (`table-inconsistency`)**: Rows in a Data Table or Examples block have an inconsistent number of cells.
- **Scenario with Examples (`scenario-with-examples`)**: A "Scenario" keyword is used instead of "Scenario Outline" when Examples are present.

### Quick Fixes (Code Actions)
When the linter detects issues, a lightbulb icon (💡) appears, offering instantaneous Quick Fixes (accessible via <kbd>Ctrl+.</kbd> or <kbd>Cmd+.</kbd>):
- **Add Missing Colon**: Fixes structural mistakes like missing colons on `Feature` or `Scenario`.
- **Change Keyword**: Corrects misspelled keywords to a valid one for your dialect. It safely detects structural misuses of `Examples` or `Scenarios` aliases and strictly converts them back to valid `Scenario` keywords to enforce BDD best practices.
- **Convert to Scenario Outline**: Automatically changes a `Scenario` to a `Scenario Outline` if a Data Table uses `<var>` template parameters.
- **Generate Python Step**: For `undefined-step` errors, instantly generates a valid Python stub with extracted parameters.
- **Fix Table Inconsistency**: Adds empty cells or removes overflowing cells to align the table width.

#### Batch Quick Fixes
Run the **Gherkin PowerTools: Fix All Safe Auto-Fixable Problems** command to automatically correct all non-overlapping, deterministic (semantics-preserving) Quick Fixes across the entire active document without breaking undo history. Alternatively, run **Gherkin PowerTools: Fix All Auto** to apply all safe formatting and fixes.

---

## 2. BDD Anti-Pattern Detection Engine

The Anti-Pattern Engine runs on a 500ms debounce to conserve system resources. It analyzes your entire test suite layout (features, scenarios, and Python implementations) to identify architectural and maintainability issues.

### Heuristic Rules

These rules evaluate the design of your test suite. Their severity and thresholds are fully configurable in `gherkinPowerTools.rules`.

- **Oversized Scenario (`oversized-scenario`)**: The Scenario has too many steps, suggesting it is testing too much.
- **Oversized Feature (`oversized-feature`)**: The Feature file has too many Scenarios, making it hard to maintain.
- **Ambiguous Step Definition (`ambiguous-step-definition`)**: A Python step definition pattern overlaps with other definitions, causing ambiguity during execution.
- **Duplicated Steps (`duplicated-steps`)**: The exact same steps are repeated multiple times.
- **Unused Steps (`unused-steps`)**: Python step definitions exist but are not used anywhere. The engine uses a robust `uri:line` deterministic identity within the WorkspaceGraph to guarantee 100% accuracy in blast-radius analysis, preventing false "Unused" positives for steps with identical regex patterns.
- **Excessive Tags (`excessive-tags`)**: Too many tags are applied to a single element.
- **Inconsistent Formatting (`inconsistent-formatting`)**: The Gherkin document contains inconsistent formatting.

---

## Configuring Rules

You can customize the severity of every rule (except `syntax-error`, which is always an error) across both the Linter and the Anti-Pattern Engine.

Configure `gherkinPowerTools.rules` in your workspace settings or your `.gherkin-powertoolsrc.json` team configuration.

```json
"gherkinPowerTools.rules": {
    "undefined-step": "error",
    "ambiguous-step": "warning",
    "oversized-scenario": {
        "severity": "warning",
        "maxSteps": 15
    },
    "unused-steps": "info"
}
```

**Allowed Severities:**
- `"error"`: Red squiggle (fails CLI checks).
- `"warning"`: Yellow squiggle.
- `"info"`: Blue squiggle.
- `"hint"`: Three faded dots under the text.
- `"off"`: Completely disables the rule.

---

## Suppressing Findings

If a heuristic anti-pattern finding is deliberate or unavoidable (e.g., a massive legacy scenario you cannot break apart right now), you can suppress it.

1. Place your cursor on the rule violation in your editor.
2. Open the Quick Fix menu (<kbd>Cmd+.</kbd> or <kbd>Ctrl+.</kbd>) and select **Suppress finding**.
3. You will be prompted to provide a mandatory **reason** (e.g. "Approved legacy component").
4. The suppression is recorded in a structural ledger at the root of your workspace (`.gherkin-pt-suppressions.json`).

The diagnostic is immediately removed from the editor. Note that core parsing errors like `syntax-error` cannot be suppressed.
