# Statistics Dashboard

Get instant, visual metrics about your entire BDD project.

## How to Use

- **Right-click** inside any `.feature` file → **Gherkin: Show Project Statistics**
- Or open the **Command Palette** (`Cmd+Shift+P`) → **Gherkin: Show Project Statistics**

## What It Shows

The dashboard scans your entire workspace and displays:

| Metric | Description |
|--------|-------------|
| **Total Features** | Number of `Feature:` blocks across all `.feature` files |
| **Total Rules** | Number of `Rule:` blocks |
| **Total Scenarios** | Number of `Scenario:` and `Scenario Outline:` blocks |
| **Files Scanned** | Total `.feature` files analyzed |

## How It Works

The dashboard is rendered as an interactive **HTML Webview** inside VS Code. It parses all `.feature` files in the workspace (including unsaved buffers) and generates a beautiful, responsive report.

![Dashboard Demonstration](../../assets/dashboard.webp)
