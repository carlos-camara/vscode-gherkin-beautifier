const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distCliDir = path.join(rootDir, 'dist-cli');
const packageJsonPath = path.join(rootDir, 'package.json');

// Read root package.json
const rootPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Ensure output directory is clean
if (fs.existsSync(distCliDir)) {
    fs.rmSync(distCliDir, { recursive: true, force: true });
}
fs.mkdirSync(distCliDir);

// Copy CLI binary
const sourceCli = path.join(rootDir, 'dist', 'cli.js');
const targetCli = path.join(distCliDir, 'cli.js');

if (!fs.existsSync(sourceCli)) {
    console.error('Error: dist/cli.js not found. Run the esbuild task first.');
    process.exit(1);
}

fs.copyFileSync(sourceCli, targetCli);

// Preserve executable permissions
fs.chmodSync(targetCli, '755');

// Copy docs
const filesToCopy = ['README.md', 'LICENSE.txt'];
for (const file of filesToCopy) {
    const sourcePath = path.join(rootDir, file);
    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, path.join(distCliDir, file));
    }
}

// Create scoped package.json
const cliPackageJson = {
    name: '@carlos-camara/gherkin-pt',
    version: rootPackageJson.version,
    description: rootPackageJson.description,
    bin: {
        'gherkin-pt': './cli.js'
    },
    engines: {
        node: '>=18.0.0'
    },
    repository: rootPackageJson.repository,
    author: rootPackageJson.author,
    license: rootPackageJson.license,
    keywords: rootPackageJson.keywords,
    dependencies: rootPackageJson.dependencies
};

fs.writeFileSync(
    path.join(distCliDir, 'package.json'),
    JSON.stringify(cliPackageJson, null, 2)
);

console.log('Successfully generated npm CLI package in dist-cli/');
