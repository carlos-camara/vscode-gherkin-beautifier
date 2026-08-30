const { defineConfig } = require('@vscode/test-cli');
const path = require('path');

module.exports = defineConfig([
  {
    label: 'unitTests',
    files: 'out/test/suite/**/*.test.js',
    version: '1.93.0',
    download: {
      timeout: 300000
    },
    workspaceFolder: './',
    mocha: {
      ui: 'tdd',
      timeout: 20000,
      reporter: 'mocha-multi-reporters',
      reporterOptions: {
        reporterEnabled: 'spec, mocha-junit-reporter',
        mochaJunitReporterReporterOptions: {
          mochaFile: path.join(__dirname, 'test-results', 'unit-test-results.xml')
        }
      }
    },
    coverage: {
      exclude: ['dist/**', 'scripts/**', 'out/**', 'src/test/**', '**/*.js'],
      include: ['src/**/*.ts']
    }
  },
  {
    label: 'e2eTests',
    files: 'out/test/e2e/**/*.test.js',
    version: '1.93.0',
    download: {
      timeout: 300000
    },
    workspaceFolder: './',
    mocha: {
      ui: 'tdd',
      timeout: 20000,
      reporter: 'mocha-multi-reporters',
      reporterOptions: {
        reporterEnabled: 'spec, mocha-junit-reporter',
        mochaJunitReporterReporterOptions: {
          mochaFile: path.join(__dirname, 'test-results', 'e2e-test-results.xml')
        }
      }
    }
  }
]);
