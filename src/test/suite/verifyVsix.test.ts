const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { verifyVsix, formatBytes, CONFIG } = require('../../../scripts/verify-vsix');

function createZip(sourceDir: string, zipPath: string) {
    if (process.platform === 'win32') {
        try {
            execSync(`powershell -NoProfile -NonInteractive -Command "Compress-Archive -Path '${sourceDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`, { stdio: 'pipe' });
        } catch (e) {
            execSync(`tar -a -cf "${zipPath}" -C "${sourceDir}" .`, { stdio: 'pipe' });
        }
    } else {
        try {
            execSync(`cd "${sourceDir}" && zip -r "${zipPath}" .`, { stdio: 'pipe' });
        } catch (e) {
            execSync(`tar -a -cf "${zipPath}" -C "${sourceDir}" .`, { stdio: 'pipe' });
        }
    }
}

suite('VSIX Automated Verification Test Suite', () => {

    test('formatBytes: Formats bytes correctly', () => {
        assert.strictEqual(formatBytes(0), '0 Bytes');
        assert.strictEqual(formatBytes(1024), '1 KB');
        assert.strictEqual(formatBytes(1048576), '1 MB');
        assert.strictEqual(formatBytes(5242880), '5 MB');
    });

    test('verifyVsix: Throws error if VSIX file does not exist', () => {
        assert.throws(() => {
            verifyVsix('/non/existent/package.vsix');
        }, /VSIX file not found/);
    });

    test('verifyVsix: Detects forbidden files and missing assets in dummy zip package', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsix-unit-test-'));
        const dummyZipPath = path.join(tempDir, 'dummy-test.vsix');

        try {
            // Create dummy package content
            const packageDir = path.join(tempDir, 'pkg');
            fs.mkdirSync(path.join(packageDir, 'extension', 'src'), { recursive: true });
            fs.mkdirSync(path.join(packageDir, 'extension', 'assets'), { recursive: true });

            // Create invalid files: TypeScript source, source map, unapproved markdown document, validation report
            fs.writeFileSync(path.join(packageDir, 'extension', 'src', 'index.ts'), 'console.log("src");');
            fs.writeFileSync(path.join(packageDir, 'extension', 'extension.js.map'), '{}');
            fs.writeFileSync(path.join(packageDir, 'extension', 'UNAPPROVED.md'), '# Unapproved');
            fs.writeFileSync(path.join(packageDir, 'extension', 'vsix-validation-report.md'), '# Report');
            fs.writeFileSync(path.join(packageDir, 'extension', 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', publisher: 'test', main: './dist/extension.js' }));

            // Zip the dummy directory into a .vsix archive cross-platform
            createZip(packageDir, dummyZipPath);

            // Run verification
            const reportPath = path.join(tempDir, 'report.md');
            const result = verifyVsix(dummyZipPath, reportPath);

            assert.strictEqual(result.checksPassed, false, 'Validation should fail for invalid package');
            assert.ok(result.violations.some((v: any) => v.file.includes('index.ts')), 'Should detect TypeScript file');
            assert.ok(result.violations.some((v: any) => v.file.includes('extension.js.map')), 'Should detect source map');
            assert.ok(result.violations.some((v: any) => v.file.includes('UNAPPROVED.md')), 'Should detect unapproved markdown file');
            assert.ok(result.violations.some((v: any) => v.file.includes('vsix-validation-report.md')), 'Should detect validation report file');
            assert.ok(result.violations.some((v: any) => v.type === 'Missing Required Asset'), 'Should detect missing required assets');
            assert.ok(fs.existsSync(reportPath), 'Validation report file should be created');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('CONFIG: Has accurate default size limits', () => {
        assert.strictEqual(CONFIG.maxCompressedSizeBytes, 5 * 1024 * 1024);
        assert.strictEqual(CONFIG.maxUncompressedSizeBytes, 15 * 1024 * 1024);
    });
});
