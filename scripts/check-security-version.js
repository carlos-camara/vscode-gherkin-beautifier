const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const securityMdPath = path.join(__dirname, '..', 'SECURITY.md');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const securityMd = fs.readFileSync(securityMdPath, 'utf8');

// Extract major.minor from package version, e.g. "1.8" from "1.8.4"
const versionParts = pkg.version.split('.');
const currentMajorMinor = `${versionParts[0]}.${versionParts[1]}`;
const expectedVersionFamily = `${currentMajorMinor}.x`;

console.log(`🔍 Verifying SECURITY.md matches current product release line (${expectedVersionFamily})...`);

// Allow any spacing, e.g., "| 1.8.x   |"
const expectedPattern = new RegExp(`\\|\\s*${expectedVersionFamily}\\s*\\|`);

if (!expectedPattern.test(securityMd)) {
    console.error(`❌ SECURITY.md is out of date!`);
    console.error(`   The current product version is ${pkg.version}, but the supported release line in SECURITY.md does not contain "| ${expectedVersionFamily} |".`);
    console.error(`   Please update SECURITY.md to reflect the active release line.`);
    process.exit(1);
}

console.log(`✅ SECURITY.md version check PASSED!`);
