# Go To Definition

Instantly jump from a `.feature` file to the exact Python step definition.

## How to Use

- **Cmd + Click** (macOS) or **Ctrl + Click** (Windows/Linux) on any step
- Or press **F12** with the cursor on a step

## How It Works

When you click on a step like `Given I login`, the extension:

1. Extracts the step text (e.g., `I login`)
2. Recursively searches your `steps/` folder
3. Finds the matching Python decorator (`@given('I login')`)
4. Opens the `.py` file at the exact line

## Supported Decorators

The provider recognizes all standard Behave/Cucumber Python decorators:

```python
@given('I login')
@when('I click the button')
@then('I should see the dashboard')
@step('I perform an action')
```

## Requirements

- Python step files must be in a `steps/` directory (any depth)
- Decorators must use `@given`, `@when`, `@then`, or `@step`

![Go To Definition](../assets/definition.webp)
