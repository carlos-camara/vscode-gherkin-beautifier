const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');

const WORKFLOW_PATHS = ['.github/workflows/**/*.yml', '.github/actions/**/*.yml'];

async function testWorkflowPolicy() {
  const files = await glob(WORKFLOW_PATHS, { cwd: path.resolve(__dirname, '..') });
  let hasViolations = false;

  for (const file of files) {
    const filePath = path.resolve(__dirname, '..', file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const usesMatch = line.match(/^\s*uses:\s*(.+)$/);
      if (usesMatch) {
        const actionRef = usesMatch[1].trim();
        // Ignore local actions (starting with ./)
        if (actionRef.startsWith('./')) {
          return;
        }

        // Must have an @ symbol
        if (!actionRef.includes('@')) {
          console.error(`❌ [${file}:${index + 1}] Missing version reference (no @ found): ${actionRef}`);
          hasViolations = true;
          return;
        }

        const [action, version] = actionRef.split('@');
        
        // Remove trailing comments from version if any, e.g., @SHA # v4
        const cleanVersion = version.split(' ')[0].trim();

        // Must be exactly 40 lowercase hex characters
        const isSha = /^[a-f0-9]{40}$/.test(cleanVersion);

        if (!isSha) {
          console.error(`❌ [${file}:${index + 1}] Invalid reference '@${cleanVersion}'. Actions MUST be pinned to a full 40-character commit SHA: ${actionRef}`);
          hasViolations = true;
        }
      }
    });
  }

  if (hasViolations) {
    console.error('\n🚨 Supply-chain policy violation detected. All GitHub Actions must be pinned to immutable commit SHAs.');
    process.exit(1);
  } else {
    console.log('✅ All GitHub Actions are correctly pinned to immutable SHAs.');
  }
}

testWorkflowPolicy().catch(err => {
  console.error(err);
  process.exit(1);
});
