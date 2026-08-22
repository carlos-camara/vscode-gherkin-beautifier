const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const workspaceRoot = path.join(__dirname, '..');
const packageJsonPath = path.join(workspaceRoot, 'package.json');
const changelogPath = path.join(workspaceRoot, 'CHANGELOG.md');

// 1. Read package.json version
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = pkg.version;
const tag = `v${version}`;
const vsixFilename = `gherkin-powertools-${version}.vsix`;
const vsixPath = path.join(workspaceRoot, vsixFilename);

console.log(`🔍 Verifying Release Candidate for version ${version}...`);

// 2. Verify VSIX exists
if (!fs.existsSync(vsixPath)) {
    console.error(`❌ VSIX file not found at ${vsixPath}. Build step must have failed.`);
    process.exit(1);
}

// 3. Verify VSIX Manifest Version
try {
    // A VSIX is a zip archive. Extract extension/package.json to stdout.
    const vsixManifestStr = execSync(`unzip -p "${vsixPath}" extension/package.json`, { encoding: 'utf8' });
    const vsixManifest = JSON.parse(vsixManifestStr);
    if (vsixManifest.version !== version) {
        console.error(`❌ VSIX Manifest version mismatch! Expected ${version}, found ${vsixManifest.version}.`);
        process.exit(1);
    }
    console.log(`✅ VSIX Manifest version matches package.json (${version}).`);
} catch (err) {
    console.error(`❌ Failed to extract and verify VSIX manifest: ${err.message}`);
    process.exit(1);
}

// 4. Extract Changelog Entry
const changelog = fs.readFileSync(changelogPath, 'utf8');
const lines = changelog.split('\n');
let capturing = false;
let notes = [];
for (const line of lines) {
    if (line.startsWith(`## [${version}]`)) {
        capturing = true;
        continue;
    }
    if (capturing && line.startsWith('## [')) break;
    if (capturing) notes.push(line);
}

if (notes.length === 0) {
    console.error(`❌ Changelog mismatch: No entry found in CHANGELOG.md for version [${version}].`);
    process.exit(1);
}

fs.writeFileSync(path.join(workspaceRoot, 'release_notes.md'), notes.join('\n').trim());
console.log(`✅ Changelog entry extracted.`);

// 5. Get source commit
const commitSha = (process.env.GITHUB_SHA || execSync('git rev-parse HEAD', { encoding: 'utf8' })).trim();

// 6. Check Tag Provenance (Mismatched existing tag protection)
try {
    // Get the object SHA the tag points to. This handles both lightweight and annotated tags.
    // ^{} unwraps the annotated tag to get the underlying commit.
    const remoteTagOutput = execSync(`git ls-remote --tags origin "refs/tags/${tag}" "refs/tags/${tag}^{}"`, { encoding: 'utf8' }).trim();
    
    if (remoteTagOutput) {
        // Parse the output. If it's an annotated tag, we want the ^{} SHA. Otherwise the regular SHA.
        const lines = remoteTagOutput.split('\n');
        let tagSha = '';
        for (const line of lines) {
            if (line.endsWith('^{}')) {
                tagSha = line.split('\t')[0];
                break;
            }
        }
        if (!tagSha) {
            tagSha = lines[0].split('\t')[0];
        }

        if (tagSha !== commitSha) {
            console.error(`❌ Tag Provenance Mismatch!`);
            console.error(`   The tag ${tag} already exists on the remote and points to commit ${tagSha}.`);
            console.error(`   The current workflow is building from commit ${commitSha}.`);
            console.error(`   You cannot build a VSIX from a different commit and attach it to an existing tag.`);
            process.exit(1);
        } else {
            console.log(`✅ Tag ${tag} already exists and its SHA matches the current commit (${tagSha}). Safe to proceed.`);
        }
    } else {
        console.log(`✅ Tag ${tag} does not exist yet. Safe to create.`);
    }
} catch (err) {
    console.warn(`⚠️ Could not reach remote to check for existing tag provenance. Assuming it does not exist.`);
}

// 7. Generate SHA-256 Hash of VSIX
const fileBuffer = fs.readFileSync(vsixPath);
const hashSum = crypto.createHash('sha256');
hashSum.update(fileBuffer);
const sha256 = hashSum.digest('hex');
console.log(`✅ VSIX SHA-256: ${sha256}`);

// 8. Generate Checksums file
const checksumContent = `${sha256}  ${vsixFilename}\n`;
fs.writeFileSync(path.join(workspaceRoot, 'checksums.txt'), checksumContent);
console.log(`✅ checksums.txt written successfully.`);

// 9. Write Provenance Data
const provenance = {
    version: version,
    tag: tag,
    vsixName: vsixFilename,
    sha256: sha256,
    commit: commitSha
};

fs.writeFileSync(path.join(workspaceRoot, 'provenance.json'), JSON.stringify(provenance, null, 2));
console.log(`✅ provenance.json written successfully.`);
