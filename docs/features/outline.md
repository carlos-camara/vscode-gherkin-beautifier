# 🌳 Outline Provider

Navigate massive `.feature` files with ease using VS Code's native Outline panel.

!!! tip "How to Use"
    1. Open any `.feature` file
    2. Open the **Outline** panel (sidebar or `Cmd+Shift+O` / `Ctrl+Shift+O`)
    3. Click any item to jump directly to it

## Hierarchy

The Outline panel displays a hierarchical tree:

```
📁 Feature: User Authentication
  📁 Rule: Login Flow
    📄 Scenario: Valid credentials
    📄 Scenario: Invalid password
  📁 Rule: Registration
    📄 Scenario Outline: New user signup
```

## Benefits

- **Quick Navigation**: Jump between scenarios without scrolling
- **File Overview**: See the full structure at a glance
- **Breadcrumbs**: The hierarchy also appears in VS Code's breadcrumb bar at the top of the editor
