# 🔍 Live Diagnostics (Linter)

Writing Gherkin should be error-free before you even run the tests.

## How It Works

The built-in linter monitors your `.feature` files **in real-time** as you type. If you mistype a keyword or use invalid syntax, the editor immediately underlines the error in red and provides an explanation in the Problems panel.

## What It Detects

| Rule | Description | Example |
|------|-------------|---------|
| Missing colon | Block keywords must end with `:` | `Scenario` → ❌ should be `Scenario:` |
| Invalid keywords | Detects misspelled Gherkin keywords | `Givn I login` → ❌ |
| Structural errors | Validates proper nesting | Steps outside a Scenario → ❌ |

!!! tip "Integration"
    Diagnostics appear in:
    - **Editor gutter** — Red underlines on the offending line
    - **Problems panel** — `Ctrl+Shift+M` / `Cmd+Shift+M`
    - **Minimap** — Red highlights for quick scanning

![Linter Demonstration](../assets/linter.webp)
