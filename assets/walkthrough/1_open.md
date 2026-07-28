# 🥒 Welcome to Gherkin PowerTools

**The professional-grade Gherkin IDE for VS Code.** Everything you need to write, navigate, and execute your Behave BDD test suite — without leaving your editor.

Open any `.feature` file to activate the extension. All features work immediately — no configuration required for standard Behave project layouts.

```gherkin
Feature: User Authentication
  @smoke @regression
  Scenario: Successful login with valid credentials
    Given the user is on the login page
    When the user enters valid credentials
    Then the user is redirected to the dashboard
    And the session token is stored in the cookie
```

> **Tip:** Gherkin PowerTools automatically detects the language of your `.feature` file via the `# language:` header, supporting **70+ Gherkin dialects** including Spanish, French, German, Arabic, and more.
