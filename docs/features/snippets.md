# 📝 Snippets

Built-in autocompletion snippets for common Gherkin blocks.

## Available Snippets

| Prefix | Description | Generates |
|--------|-------------|-----------|
| `feature` | Feature block | Full Feature with Background and Scenario |
| `scenario` | Scenario block | Scenario with Given/When/Then |
| `outline` | Scenario Outline | Outline with Examples table |
| `rule` | Rule block | Rule with nested Scenario |

!!! tip "How to Use"
    1. Open a `.feature` file
    2. Type a snippet prefix (e.g., `scenario`)
    3. Press **Tab** to expand

## Example

Typing `scenario` + `Tab` generates:

```gherkin
Scenario: Scenario name
    Given precondition
    When action
    Then expected result
```

!!! tip "Custom Snippets"
    You can extend the built-in snippets by creating your own in `.vscode/gherkin.code-snippets`.
