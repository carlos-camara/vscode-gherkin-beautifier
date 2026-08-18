# 💥 Real-Time Impact Analysis

When changing a Python step definition, you need to know exactly how many scenarios will be affected. Gherkin PowerTools provides this information in real-time.

## CodeLens Indicators
Above every Python `@step` decorator, a clickable **CodeLens** displays the usage count across your workspace:
- `0 usages`: Safe to delete.
- `1 usage`: Safe to modify for that specific scenario.
- `N usages`: High impact. Modifying this step will affect multiple scenarios.

## Impact Report
Click the CodeLens to open an interactive **Impact Report**. This allows you to review exactly which `.feature` files and scenarios depend on the step before making a breaking change.

<div align="center">
  <img src="https://raw.githubusercontent.com/carlos-camara/vscode-gherkin-powertools/main/assets/impact-analysis.gif" alt="Impact Analysis" width="600" />
</div>
