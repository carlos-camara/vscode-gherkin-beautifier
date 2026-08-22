const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const workspaceRoot = path.join(__dirname, '..');
const pkgPath = path.join(workspaceRoot, 'package.json');
const originalPkg = fs.readFileSync(pkgPath, 'utf8');

console.log("🧪 Starting Provenance Hardening Test Suite...\n");

function restorePkg() {
    fs.writeFileSync(pkgPath, originalPkg);
}

function runCandidateTest(description, shouldPass) {
    console.log(`▶️  TEST: ${description}`);
    try {
        execSync(`node scripts/verify-release-candidate.js`, { encoding: 'utf8', stdio: 'pipe' });
        if (!shouldPass) {
            console.error(`   ❌ FAILED: Expected to fail, but it passed.`);
            process.exit(1);
        } else {
            console.log(`   ✅ PASSED (as expected)`);
        }
    } catch (err) {
        if (shouldPass) {
            console.error(`   ❌ FAILED: Expected to pass, but it failed.`);
            console.error(err.stdout || err.stderr);
            process.exit(1);
        } else {
            console.log(`   ✅ PASSED (failed as expected)`);
        }
    }
}

// 1. Wrong package version mismatch (simulate by breaking VSIX vs package.json version)
// Note: We won't actually repackage the VSIX, so if we change package.json to 9.9.9, the unzip command inside will find 1.8.4 and fail.
console.log("\n--- Testing Mismatches ---");
const fakePkg = JSON.parse(originalPkg);
fakePkg.version = '9.9.9';
fs.writeFileSync(pkgPath, JSON.stringify(fakePkg, null, 2));

// This should fail because the vsix (which we mock-created earlier or doesn't exist) either won't exist or won't have 9.9.9.
// Let's create a dummy vsix for 9.9.9 so the file check passes, but the unzip fails.
fs.writeFileSync(path.join(workspaceRoot, 'gherkin-powertools-9.9.9.vsix'), 'dummy');
runCandidateTest('Wrong package version (VSIX Manifest Mismatch)', false);
fs.unlinkSync(path.join(workspaceRoot, 'gherkin-powertools-9.9.9.vsix'));
restorePkg();

// 2. We already know how to test changelog mismatch (if we set version to 9.9.8 but no VSIX check, it fails on changelog).
// Let's test that manually.
const fakePkg2 = JSON.parse(originalPkg);
fakePkg2.version = '9.9.8';
fs.writeFileSync(pkgPath, JSON.stringify(fakePkg2, null, 2));
// create a fake zip with the correct package.json inside it to pass the zip check, so it fails on changelog.
execSync(`mkdir -p extension && echo '{"version":"9.9.8"}' > extension/package.json && zip -q gherkin-powertools-9.9.8.vsix extension/package.json && rm -rf extension`);
runCandidateTest('Wrong changelog version (Missing Changelog Entry)', false);
fs.unlinkSync(path.join(workspaceRoot, 'gherkin-powertools-9.9.8.vsix'));
restorePkg();

console.log("\n🎉 All provenance tests executed successfully.");
