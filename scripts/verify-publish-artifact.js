const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const workspaceRoot = path.join(__dirname, '..');
const provenancePath = path.join(workspaceRoot, 'provenance.json');

console.log(`🔍 Verifying Downloaded Publish Artifact...`);

if (!fs.existsSync(provenancePath)) {
    console.error(`❌ provenance.json not found! The artifact download step may have failed, or the unprivileged job did not generate it.`);
    process.exit(1);
}

const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
const vsixPath = path.join(workspaceRoot, provenance.vsixName);

if (!fs.existsSync(vsixPath)) {
    console.error(`❌ VSIX file (${provenance.vsixName}) not found!`);
    process.exit(1);
}

// 1. Verify Source Commit (Wrong Source Commit protection)
const currentSha = process.env.GITHUB_SHA;
if (currentSha && currentSha !== provenance.commit) {
    console.error(`❌ Source Commit Mismatch! The artifact was built from commit ${provenance.commit}, but the publish job is running on commit ${currentSha}.`);
    process.exit(1);
}
console.log(`✅ Commit SHA matches (${provenance.commit}).`);

// 2. Verify Local Artifact Hash (Artifact Hash Mismatch protection)
function hashFile(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

const actualSha256 = hashFile(vsixPath);
if (actualSha256 !== provenance.sha256) {
    console.error(`❌ Artifact Hash Mismatch!`);
    console.error(`   Expected: ${provenance.sha256}`);
    console.error(`   Actual:   ${actualSha256}`);
    console.error(`   The VSIX artifact has been tampered with or corrupted during transfer.`);
    process.exit(1);
}
console.log(`✅ Artifact Hash matches (${actualSha256}).`);

// 3. Verify Existing Asset (Prevent silent clobbering)
// In a dry-run or local test without GH_TOKEN, this may fail, so we wrap it.
if (process.env.GH_TOKEN) {
    try {
        const releaseInfoStr = execSync(`gh release view "${provenance.tag}" --json assets`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const releaseInfo = JSON.parse(releaseInfoStr);
        const assetExists = releaseInfo.assets.find(a => a.name === provenance.vsixName);
        
        if (assetExists) {
            console.log(`⚠️ Asset ${provenance.vsixName} already exists on release ${provenance.tag}.`);
            console.log(`   Downloading existing asset to verify cryptographic identity...`);
            
            const tempExistingPath = path.join(workspaceRoot, `remote_${provenance.vsixName}`);
            execSync(`gh release download "${provenance.tag}" -p "${provenance.vsixName}" -O "${tempExistingPath}"`);
            
            const remoteSha256 = hashFile(tempExistingPath);
            fs.unlinkSync(tempExistingPath); // cleanup
            
            if (remoteSha256 !== provenance.sha256) {
                console.error(`❌ Remote Asset Hash Mismatch!`);
                console.error(`   Local:  ${provenance.sha256}`);
                console.error(`   Remote: ${remoteSha256}`);
                console.error(`   Cannot silently replace a different asset. To fix this, a maintainer must manually delete the asset from GitHub.`);
                process.exit(1);
            } else {
                console.log(`✅ Remote asset is cryptographically identical. No upload needed.`);
                // We write a marker file so the CI knows to skip upload.
                fs.writeFileSync(path.join(workspaceRoot, 'skip_upload.marker'), 'true');
            }
        }
    } catch (err) {
        // gh release view fails if the release doesn't exist yet, which is normal for a new release.
        console.log(`✅ Release or asset does not exist yet. Safe to upload.`);
    }
} else {
    console.warn(`⚠️ No GH_TOKEN provided. Skipping remote asset provenance check.`);
}

console.log(`🚀 Artifact is trustworthy and ready for publication.`);
