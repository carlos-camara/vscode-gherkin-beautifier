# ✨ AST-Based Formatter

Messy Gherkin is hard to read and review. Gherkin PowerTools uses a **full Cucumber AST parse** to reformat your `.feature` files with surgical precision — never corrupting your content.

**How to format:**

- **Format Document:** `Shift+Alt+F` (Windows/Linux) or `Shift+Option+F` (macOS)
- **Format Selection:** Select a range and press the same shortcut — only that block is reformatted
- **Via Command Palette:** `Gherkin PowerTools: Format Document`

**What gets formatted automatically:**

- **Indentation** — Keywords, steps, and table cells aligned to configurable indent levels
- **Data Tables & Examples** — Columns aligned to the widest value in each column
- **Tags** — Wrapped to a configurable column width (default: 80 chars) and alphabetically consistent
- **Blank Lines** — Normalized between blocks for readability

**Example — before and after:**

```gherkin
# Before
Feature:  Login
@smoke
Scenario:  Successful login
Given the user enters username "admin"
And password "secret"
|  username  |  password  |
|  admin     |  secret    |
```

```gherkin
# After
Feature: Login

  @smoke
  Scenario: Successful login
    Given the user enters username "admin"
    And password "secret"
      | username | password |
      | admin    | secret   |
```

> **Configuration:** Choose a base formatting profile (`strict`, `team`, `minimal`) or customize indent sizes, tag wrap columns, and table alignment in `Settings → Extensions → Gherkin PowerTools → Formatting`.
