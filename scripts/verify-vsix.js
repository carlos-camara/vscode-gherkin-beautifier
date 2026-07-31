const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CONFIG = {
    maxCompressedSizeBytes: 5 * 1024 * 1024,   // 5 MB
    maxUncompressedSizeBytes: 15 * 1024 * 1024, // 15 MB
    requiredFiles: [
        'extension/package.json',
        'extension/dist/extension.js',
        'extension/readme.md',
        'extension/assets/logo-transparent.png',
        'extension/assets/vscode_behave_formatter.py',
        'extension/gherkin-powertools.schema.json',
        'extension/assets/walkthrough/1_open.md',
        'extension/assets/walkthrough/2_format.md',
        'extension/assets/walkthrough/3_formatOnSave.md',
        'extension/assets/walkthrough/4_discovery.md',
        'extension/assets/walkthrough/5_navigation.md',
        'extension/assets/walkthrough/6_statistics.md',
        'extension/assets/walkthrough/7_support.md',
        'extension/assets/walkthrough/8_execution.md',
        'extension/assets/walkthrough/9_codeactions.md',
        'extension/assets/walkthrough/10_command_center.md'
    ],
    forbiddenPatterns: [
        { pattern: /\.ts$/, description: 'TypeScript source files' },
        { pattern: /\.map$/, description: 'Source map files' },
        { pattern: /^extension\/src\//, description: 'Source directory (src/)' },
        { pattern: /^extension\/out\/test\//, description: 'Compiled test files (out/test/)' },
        { pattern: /^extension\/docs\//, description: 'Documentation source folder (docs/)' },
        { pattern: /^extension\/coverage\//, description: 'Test coverage output (coverage/)' },
        { pattern: /^extension\/test-results\//, description: 'Test results folder (test-results/)' },
        { pattern: /^extension\/\.[^/]+\//, description: 'Hidden workspace directory' },
        { pattern: /^extension\/(tmp|temp|venv|skills)\//i, description: 'Internal or temporary directory' },
        { pattern: /\.(gif|mp4|webm|webp)$/i, description: 'Heavy media asset' },
        { pattern: /^extension\/(?!node_modules\/)(?!(readme|changelog|security|license|assets\/walkthrough\/)).*\.md$/i, description: 'Unapproved markdown document' },
        { pattern: /tsconfig\.json$/i, description: 'TypeScript configuration file' },
        { pattern: /esbuild\.js$/i, description: 'Build script file' },
        { pattern: /package-lock\.json$/i, description: 'NPM package lock file' }
    ]
};

function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function extractZip(zipPath, targetDir) {
    if (process.platform === 'win32') {
        try {
            execSync(`powershell -NoProfile -NonInteractive -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force"`, { stdio: 'pipe' });
        } catch (e) {
            execSync(`tar -xf "${zipPath}" -C "${targetDir}"`, { stdio: 'pipe' });
        }
    } else {
        try {
            execSync(`unzip -o -q "${zipPath}" -d "${targetDir}"`, { stdio: 'pipe' });
        } catch (e) {
            execSync(`tar -xf "${zipPath}" -C "${targetDir}"`, { stdio: 'pipe' });
        }
    }
}

function verifyVsix(vsixPath, reportOutputPath = null) {
    if (!fs.existsSync(vsixPath)) {
        throw new Error(`VSIX file not found at: ${vsixPath}`);
    }

    const compressedSizeBytes = fs.statSync(vsixPath).size;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsix-verify-'));

    const validation = {
        vsixPath,
        compressedSizeBytes,
        uncompressedSizeBytes: 0,
        totalFileCount: 0,
        checksPassed: true,
        summary: [],
        violations: [],
        requiredAssetsCheck: [],
        fileList: []
    };

    try {
        // Unpack VSIX file cross-platform
        extractZip(vsixPath, tempDir);

        const allExtractedFiles = getAllFiles(tempDir);
        validation.totalFileCount = allExtractedFiles.length;

        let totalUncompressed = 0;
        allExtractedFiles.forEach((filePath) => {
            const relPath = path.relative(tempDir, filePath).replace(/\\/g, '/');
            const size = fs.statSync(filePath).size;
            totalUncompressed += size;
            validation.fileList.push({ path: relPath, size });

            // Check forbidden patterns
            CONFIG.forbiddenPatterns.forEach(({ pattern, description }) => {
                if (pattern.test(relPath)) {
                    validation.violations.push({
                        type: 'Forbidden File Detected',
                        file: relPath,
                        description: `${description} matching pattern ${pattern}`
                    });
                    validation.checksPassed = false;
                }
            });
        });
        validation.uncompressedSizeBytes = totalUncompressed;

        // Check required files
        CONFIG.requiredFiles.forEach((reqFile) => {
            const fullPath = path.join(tempDir, reqFile);
            const exists = fs.existsSync(fullPath);
            validation.requiredAssetsCheck.push({ file: reqFile, exists });
            if (!exists) {
                validation.violations.push({
                    type: 'Missing Required Asset',
                    file: reqFile,
                    description: 'Required file is missing from VSIX package'
                });
                validation.checksPassed = false;
            }
        });

        // Check license file (LICENSE or LICENSE.txt)
        const hasLicense = fs.existsSync(path.join(tempDir, 'extension', 'LICENSE')) ||
                           fs.existsSync(path.join(tempDir, 'extension', 'LICENSE.txt')) ||
                           fs.existsSync(path.join(tempDir, 'extension', 'LICENSE.md'));
        validation.requiredAssetsCheck.push({ file: 'extension/LICENSE[.txt]', exists: hasLicense });
        if (!hasLicense) {
            validation.violations.push({
                type: 'Missing Required Asset',
                file: 'extension/LICENSE',
                description: 'Required license file is missing from VSIX package'
            });
            validation.checksPassed = false;
        }

        // Check size thresholds
        if (compressedSizeBytes > CONFIG.maxCompressedSizeBytes) {
            validation.violations.push({
                type: 'Package Size Threshold Exceeded',
                file: vsixPath,
                description: `Compressed size ${formatBytes(compressedSizeBytes)} exceeds limit of ${formatBytes(CONFIG.maxCompressedSizeBytes)}`
            });
            validation.checksPassed = false;
        }

        if (totalUncompressed > CONFIG.maxUncompressedSizeBytes) {
            validation.violations.push({
                type: 'Package Uncompressed Size Exceeded',
                file: vsixPath,
                description: `Uncompressed size ${formatBytes(totalUncompressed)} exceeds limit of ${formatBytes(CONFIG.maxUncompressedSizeBytes)}`
            });
            validation.checksPassed = false;
        }

        // Validate package.json inside VSIX
        const packageJsonPath = path.join(tempDir, 'extension', 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                if (!pkg.name || !pkg.version || !pkg.publisher) {
                    validation.violations.push({
                        type: 'Invalid Extension Manifest',
                        file: 'extension/package.json',
                        description: 'Manifest missing name, version, or publisher fields'
                    });
                    validation.checksPassed = false;
                }
                const mainFile = path.join(tempDir, 'extension', pkg.main || '');
                if (!fs.existsSync(mainFile)) {
                    validation.violations.push({
                        type: 'Missing Main Entry Point',
                        file: pkg.main || 'undefined',
                        description: `Main entry point declared in package.json does not exist in VSIX`
                    });
                    validation.checksPassed = false;
                }
            } catch (err) {
                validation.violations.push({
                    type: 'Corrupt Extension Manifest',
                    file: 'extension/package.json',
                    description: `Failed to parse package.json: ${err.message}`
                });
                validation.checksPassed = false;
            }
        }

    } finally {
        // Clean up extracted files
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Build Report Content
    const reportLines = [
        `# VSIX Package Validation Report`,
        ``,
        `**Target Package**: \`${path.basename(vsixPath)}\``,
        `**Validation Status**: ${validation.checksPassed ? '✅ PASSED' : '❌ FAILED'}`,
        `**Compressed Size**: ${formatBytes(validation.compressedSizeBytes)} (Limit: ${formatBytes(CONFIG.maxCompressedSizeBytes)})`,
        `**Uncompressed Size**: ${formatBytes(validation.uncompressedSizeBytes)} (Limit: ${formatBytes(CONFIG.maxUncompressedSizeBytes)})`,
        `**Total Extracted Files**: ${validation.totalFileCount}`,
        ``,
        `## Required Assets Audit`,
        ``,
        `| Required File | Status |`,
        `| :--- | :--- |`
    ];

    validation.requiredAssetsCheck.forEach(({ file, exists }) => {
        reportLines.push(`| \`${file}\` | ${exists ? '✅ PASS' : '❌ MISSING'} |`);
    });

    reportLines.push(``);
    reportLines.push(`## Violations & Anomalies`);
    reportLines.push(``);

    if (validation.violations.length === 0) {
        reportLines.push(`*No violations detected. VSIX package is clean and ready for release.*`);
    } else {
        reportLines.push(`| Violation Type | File / Target | Description |`);
        reportLines.push(`| :--- | :--- | :--- |`);
        validation.violations.forEach((v) => {
            reportLines.push(`| **${v.type}** | \`${v.file}\` | ${v.description} |`);
        });
    }

    const reportMarkdown = reportLines.join('\n');

    if (reportOutputPath) {
        fs.writeFileSync(reportOutputPath, reportMarkdown, 'utf8');
    }

    return {
        ...validation,
        reportMarkdown
    };
}

// CLI Execution Support
if (require.main === module) {
    try {
        let vsixFile = process.argv[2];
        let createdTempPackage = false;

        if (!vsixFile) {
            // Find existing .vsix files in cwd
            const vsixFiles = fs.readdirSync(process.cwd()).filter(f => f.endsWith('.vsix'));
            if (vsixFiles.length > 0) {
                vsixFile = path.resolve(process.cwd(), vsixFiles[0]);
            } else {
                console.log('📦 No VSIX file provided. Packaging a temporary VSIX for verification...');
                vsixFile = path.resolve(process.cwd(), 'temp-verification-package.vsix');
                execSync(`npx vsce package --out "${vsixFile}"`, { stdio: 'inherit' });
                createdTempPackage = true;
            }
        } else {
            vsixFile = path.resolve(process.cwd(), vsixFile);
        }

        console.log(`\n🔍 Verifying VSIX Package: ${vsixFile}\n`);
        const reportPath = path.resolve(process.cwd(), 'vsix-validation-report.md');
        const result = verifyVsix(vsixFile, reportPath);

        console.log(`=======================================================`);
        console.log(`VSIX VALIDATION RESULT: ${result.checksPassed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Compressed Size:   ${formatBytes(result.compressedSizeBytes)}`);
        console.log(`Uncompressed Size: ${formatBytes(result.uncompressedSizeBytes)}`);
        console.log(`Total Files:       ${result.totalFileCount}`);
        console.log(`=======================================================\n`);

        if (result.violations.length > 0) {
            console.error(`🚨 DETECTED VIOLATIONS (${result.violations.length}):`);
            result.violations.forEach((v, index) => {
                console.error(`  ${index + 1}. [${v.type}] ${v.file}: ${v.description}`);
            });
            console.error(`\n❌ Publication blocked! Validation report written to ${reportPath}\n`);
        } else {
            console.log(`✨ All verification checks passed! Report written to ${reportPath}\n`);
        }

        if (createdTempPackage && fs.existsSync(vsixFile)) {
            fs.unlinkSync(vsixFile);
        }

        if (!result.checksPassed) {
            process.exit(1);
        }
    } catch (err) {
        console.error(`💥 Verification error: ${err.message}`);
        process.exit(1);
    }
}

module.exports = {
    verifyVsix,
    CONFIG,
    formatBytes
};
