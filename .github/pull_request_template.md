# 🔍 Pull Request Overview

> **👋 Thanks for contributing to Gherkin PowerTools!**
> Please read [`CONTRIBUTING.md`](../CONTRIBUTING.md) before submitting. PRs that skip the checklist below will not be merged.

<!-- Provide a clear, concise description of what this PR does and why.
     Start with the user problem, then explain your solution. -->

---

## 🎯 Motivation & Context

<!-- Why is this change needed? What user pain does it solve?
     Link to any open issues:  Fixes #<issue-number>  -->

**Related issues:** <!-- e.g. Closes #123, Relates to #456 -->

---

## 🚀 Key Changes

<!-- List the most important changes. Be specific and technical. -->

- [ ] <!-- e.g. Added real-time Test Explorer tree update on document change (400 ms debounce) -->
- [ ] <!-- e.g. Fixed debug spinner not clearing after session ends -->
- [ ] <!-- e.g. Refactored execution.ts to use array-based ProcessExecution to prevent shell injection -->

---

## 🔬 Affected Feature Areas

> Check every area that is touched by this PR — even indirectly.

### Core Engine
- [ ] **Formatter** — AST-based indentation, table alignment, tag wrapping (`formatter.ts`)
- [ ] **Linter / Diagnostics** — real-time error detection, cascading error suppression, hybrid parse (`linter.ts`, `diagnostics.ts`)
- [ ] **Quick Fixes / Code Actions** — insert `:`, fix typos (Levenshtein), convert `Scenario → Outline`, close table row, generate step stub (`codeAction.ts`)
- [ ] **IntelliSense / Completion** — step suggestions, `<param>` autocompletion from Examples tables (`completion.ts`)
- [ ] **Hover Provider** — Python function signature + docstring, tag blast-radius counter (`hover.ts`)
- [ ] **Go to Definition** — jump from Gherkin step to Python `@given/@when/@then` decorator (`definition.ts`)
- [ ] **Semantic Highlighter** — outline-parameter coloring inside step text (`highlighter.ts`)
- [ ] **Symbol / Outline Provider** — Feature / Rule / Scenario tree in VS Code sidebar (`outline.ts`)

### Execution Engine
- [ ] **Test Explorer (Test Controller)** — native VS Code Testing sidebar integration, live tree updates, run/debug/edit modes (`testController.ts`)
- [ ] **Run Feature** — executes full `.feature` file via `behave` Task + ProcessExecution (`execution.ts`)
- [ ] **Run Scenario** — executes a single scenario by line number (`execution.ts`)
- [ ] **Debug Feature / Debug Scenario** — launches VS Code Debug session with `debugpy` adapter (`execution.ts`)
- [ ] **Run with Custom Args** — interactive dialog for volatile/persistent extra Behave args (`execution.ts`)

### Extension Infrastructure
- [ ] **Symbol Cache** — async indexing of Python step definitions from workspace globs (`cache.ts`)
- [ ] **Discovery Service** — reactive file watchers for `.feature` and `.py` files (`discovery.ts`)
- [ ] **Configuration Service** — typesafe access to `gherkinPowerTools.*` settings (`configuration.ts`)
- [ ] **Dialect Service** — i18n Gherkin keyword support via `# language:` header (`dialect.ts`)
- [ ] **Command Center** — unified QuickPick menu surfacing all capabilities (`commandCenter.ts`)
- [ ] **Statistics Dashboard** — Webview with workspace metrics from the Cucumber AST (`statistics.ts`)
- [ ] **Onboarding Engine** — first-run workspace analysis and step-glob recommendations (`onboarding.ts`)
- [ ] **Logger** — structured output channel logging (`logger.ts`)

### Documentation & Configuration
- [ ] `README.md` updated
- [ ] `docs/` page(s) updated
- [ ] `CHANGELOG.md` entry added
- [ ] `package.json` contributions updated (commands, settings, keybindings)
- [ ] `gherkin-powertools.schema.json` updated (if new settings added)

---

## 🧪 Testing Matrix

> All boxes **must** be checked before requesting review.

### Automated Tests
- [ ] Extension compiles without errors: `npm run compile`
- [ ] All unit tests pass: `npm test`
- [ ] All E2E tests pass (Mocha): `npm test` (includes `src/test/e2e/`)
- [ ] Coverage not regressed: `npm run coverage`
- [ ] Linting passes: `npm run lint`

### Manual Verification (check what applies)

#### Formatter
- [ ] Formatted a complex `.feature` with multi-step tables, tags, and `Scenario Outline` — output is pixel-perfect
- [ ] `Format Selection` (range format) works correctly on partial content
- [ ] Config `tables.alignToKeyword`, `indentation.steps`, `tags.wrapColumn` applied correctly after dynamic change

#### Linter & Quick Fixes
- [ ] Missing `:` on `Feature` / `Scenario` is detected and quick-fixed
- [ ] Misspelled keyword (`Givn`, `Featur`, `Wehn`) is caught and corrected
- [ ] `Scenario` + `Examples` block triggers "Convert to Scenario Outline" action
- [ ] Unclosed table row `|` is detected and pipe-closure fix is offered
- [ ] Undefined step triggers ⚠️ diagnostic + "Create step definition" quick fix
- [ ] Spanish / French / other dialect `.feature` files linted correctly (no false positives)
- [ ] Rapid typing → debounce fires correctly — no stale diagnostics

#### IntelliSense & Navigation
- [ ] `Given` + space shows step completions from Python cache
- [ ] `<` triggers `<param>` completions from Examples table columns
- [ ] Hovering a Gherkin step shows the Python function name + signature
- [ ] Hovering a `@tag` shows the blast-radius count
- [ ] Cmd-click / F12 on a step navigates to the Python `@given(...)` decorator

#### Test Explorer
- [ ] Testing sidebar shows the full Feature → Scenario → Example Row tree for all workspace `.feature` files
- [ ] Tree updates live as you type (within ~400 ms, no save required)
- [ ] ▶ Run button executes the correct item; pass ✅ / fail ❌ badges appear after completion
- [ ] 🐞 Debug button opens a debug session; Variables / Call Stack panels work; spinner clears correctly after session ends
- [ ] ✏️ Edit args dialog saves args to Workspace Settings when "Save" is chosen; keeps them volatile when dismissed
- [ ] Cancelling a run/debug mid-way clears the spinner correctly

#### Command Center
- [ ] `Gherkin PowerTools: Command Center` (<kbd>⌘⇧P</kbd>) opens the QuickPick menu
- [ ] All sub-commands in the menu are present and functional

#### Statistics & Onboarding
- [ ] `Show Statistics Dashboard` opens the Webview and renders correct feature/scenario/step counts
- [ ] First-run onboarding notification appears for a new Behave workspace (or can be re-triggered via command)

---

## 📸 Screenshots / Demos

<!-- Attach a GIF or screenshot for any UI change. Use the drag-and-drop GitHub UI. -->
<!-- For execution changes, show the terminal output and pass/fail badge. -->

| Feature | Before | After |
|---------|--------|-------|
|         |        |       |

---

## ⚠️ Breaking Changes

<!-- Fill in if this PR changes configuration keys, command IDs, or API contracts. -->

- [ ] None

If breaking:
- Configuration key changed: `oldKey` → `newKey`
- Migration path:

---

## 🔐 Security Considerations

<!-- Execution engine changes are especially sensitive. -->

- [ ] No new shell string interpolation introduced (all Behave args passed as `string[]` array, never concatenated)
- [ ] No new workspace trust bypass
- [ ] No secrets or tokens in code/comments

---

## 📖 Documentation

<!-- Link every doc page touched or added. -->

- [ ] `docs/features/execution.md`
- [ ] `docs/features/linter.md`
- [ ] `docs/features/formatter.md`
- [ ] `docs/features/command_center.md`
- [ ] `docs/features/diagnostics.md`
- [ ] `docs/features/hover.md`
- [ ] `docs/features/definition.md`
- [ ] `docs/features/snippets.md`
- [ ] `docs/features/highlighting.md`
- [ ] `docs/features/statistics.md`
- [ ] `docs/features/outline.md`
- [ ] `docs/demos.md`
- [ ] `docs/ARCHITECTURE.md`
- [ ] `docs/configuration.md`

---

## 👥 Reviewer Notes

<!-- Anything the reviewer should pay special attention to?
     e.g. "The debounce logic in testController.ts is delicate — see lines 140-165." -->

---

*🚥 Automated Hygiene Check enabled — lint, build, and test results will appear as PR checks.*
