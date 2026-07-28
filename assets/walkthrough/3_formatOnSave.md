# 💾 Format on Save

Never think about formatting again. Enable **Format on Save** so every file is always clean the moment you save.

Add this to your VS Code `settings.json` (workspace-scoped is recommended so the team shares the same config):

```json
"[feature]": {
    "editor.formatOnSave": true
}
```

Or open **Settings** (`Cmd+,` / `Ctrl+,`), search for `editor.formatOnSave`, and enable it for the `feature` language override.

**Why workspace-scoped?**

Committing a `.vscode/settings.json` file ensures the entire team formats consistently — eliminating noisy diffs. For even greater control, you can now use a `.gherkin-powertoolsrc.json` file in your repository root to enforce strict formatting profiles, linter rules, and step discovery paths across your entire team.

> **Tip:** Combine Format on Save with a Git pre-commit hook (e.g. via `husky`) to guarantee that malformatted Gherkin never reaches `main`.
