# Security and Privacy Policy

Gherkin PowerTools is committed to maintaining a highly secure, private, and trustworthy environment for all users, whether individual developers or enterprise engineering teams.

This document serves as the official security and privacy contract for the Gherkin PowerTools VS Code extension and its associated Command Line Interface (`@carlos-camara/gherkin-pt`).

## 1. Supported Versions

Currently, the following versions of the extension receive security updates. This repository includes automated tests to ensure this support matrix accurately tracks the active `package.json` version.

| Version | Supported          |
| ------- | ------------------ |
| 1.8.x   | :white_check_mark: |
| < 1.8.0 | :x:                |

## 2. Privacy Scope (No Telemetry, No Analytics)

We respect your privacy and your proprietary codebase.

- **No Telemetry**: Gherkin PowerTools contains **zero** telemetry.
- **No Analytics**: We do not use Google Analytics, Application Insights, or any other tracking software.
- **No Crash Reporting**: We do not use Sentry, Crashlytics, or any automatic crash-reporting tools.
- **No External Network Requests**: The extension makes **zero** automatic external network requests (`fetch`, `axios`, or `http`). The only network traffic involved is initiated by VS Code itself during extension installation/updates, or by the user's own tests.

## 3. Security Scope & Threat Boundaries

### Supply-Chain Immutability and Provenance
To protect our users from supply-chain attacks, we have redesigned our release engineering to enforce strict artifact provenance.
- **Immutable SHAs**: All third-party GitHub Actions used in our CI/CD pipelines are strictly pinned to full 40-character commit SHAs.
- **Decoupled Publishing**: VSIX package creation is isolated from the publishing step. The build environment does not have access to deployment credentials.
- **VSIX Cryptographic Verification**: Before any release is published, the pipeline cryptographically verifies the SHA-256 hash of the generated `.vsix` artifact against the source commit. We also extract and validate the internal `extension/package.json` to guarantee the packaged version matches the exact source code version, preventing tampering or clobbering.

### Execution Security (No Shell Injection)
When executing Python Behave tests from the Test Explorer, Gherkin PowerTools mitigates command injection vulnerabilities by strictly using `vscode.ProcessExecution` and `child_process.spawn({ shell: false })`. Arguments are passed as discrete elements in an array, meaning no shell interpretation occurs.

### Workspace Trust Integration
The extension strictly honors VS Code's **Workspace Trust** API. Automated Behave execution is entirely disabled in restricted (untrusted) workspaces to protect against malicious repositories that may attempt to execute arbitrary code via test configurations.

### Configuration Isolation (Machine-Specific Settings)
If you require an absolute path to a Python interpreter or Behave executable, do **not** configure this in the shared `.vscode/settings.json` via `gherkinPowerTools.behave.execution.executable`.
Instead, use the `gherkinPowerTools.behave.localExecution` property within your VS Code User Settings. This ensures local paths are not committed to source control and protects the team from executing arbitrary paths defined by a malicious commit.

### Remote Development (SSH, Dev Containers, WSL)
Gherkin PowerTools is fully compatible with Remote Development extensions. All execution, file system access, and formatting happen locally inside the remote container/server, keeping source code and execution strictly bounded to the remote machine without proxying data back to the local host.

## 4. Local Storage Inventory

Gherkin PowerTools uses local storage provided by VS Code to persist certain contextual and historical data. This data never leaves your machine.

| Storage Location | Purpose | Contents Stored | How to Reset |
| :--- | :--- | :--- | :--- |
| **`workspaceState`** | Gherkin Health Dashboard Historical Trends | Aggergated numeric counts (e.g., number of steps), branch names. **Does not store source code or file paths.** | Run the `Gherkin PowerTools: Clear History` command. |
| **`globalState`** | Contextual Feature Discovery | Simple boolean flags to remember if you dismissed a specific UI hint (e.g., `discovery.formatter.dismissed`). | Run the `Gherkin PowerTools: Reset Contextual Recommendations` command. |
| **Clipboard** | Diagnostic Reports | Only written when you explicitly click "Copy Sanitized Report". Paths are sanitized to hide local usernames. | N/A (Standard OS clipboard action) |

## 5. Reporting a Vulnerability

> **Caution:** If you believe you have found a security vulnerability, please do **not** open a public issue. Instead, follow our coordinated disclosure process:

1. **Contact**: Report the vulnerability via GitHub's [Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) feature on this repository.
2. **Information Required**:
   - Detailed description of the vulnerability.
   - Full reproduction steps (POC).
   - Assessment of potential impact.
3. **Acknowledgement**: Reports will be acknowledged.
4. **Fixing**: Critical issues will be prioritized and resolved rapidly without public disclosure until a patch is available.
