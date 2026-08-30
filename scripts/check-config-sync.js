const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function fail(msg) {
  console.error(`❌ CONFIG SYNC ERROR: ${msg}`);
  process.exit(1);
}

console.log('🔍 Checking configuration synchronization across codebase...');

// 1. Load package.json contributes.configuration
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const pkgProps = packageJson.contributes?.configuration?.properties;

if (!pkgProps) {
  fail('package.json does not contain contributes.configuration.properties');
}

// 2. Load JSON Schema
const schemaPath = path.join(rootDir, 'gherkin-powertools.schema.json');
const jsonSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// 3. Expected setting definitions from CONFIG_SCHEMA_CONTRACT
const expectedSettings = [
  {
    key: 'gherkinPowerTools.indentation.steps',
    section: 'indentation',
    prop: 'steps',
    type: 'number',
    schemaType: 'integer',
    default: 4
  },
  {
    key: 'gherkinPowerTools.tables.alignToKeyword',
    section: 'tables',
    prop: 'alignToKeyword',
    type: 'boolean',
    schemaType: 'boolean',
    default: true
  },
  {
    key: 'gherkinPowerTools.tags.format',
    section: 'tags',
    prop: 'format',
    type: 'string',
    schemaType: 'string',
    default: 'wrap',
    enum: ['wrap', 'singleLine']
  },
  {
    key: 'gherkinPowerTools.tags.sort',
    section: 'tags',
    prop: 'sort',
    type: 'string',
    schemaType: 'string',
    default: 'preserve',
    enum: ['preserve', 'alphabetical']
  },
  {
    key: 'gherkinPowerTools.emptyLines.betweenScenarios',
    section: 'emptyLines',
    prop: 'betweenScenarios',
    type: 'number',
    schemaType: 'integer',
    default: 1
  },
  {
    key: 'gherkinPowerTools.behave.stepGlobs',
    section: 'behave',
    prop: 'stepGlobs',
    type: 'array',
    schemaType: 'array',
    default: ["**/steps/**/*.py", "**/features/steps/**/*.py"]
  },
  {
    key: 'gherkinPowerTools.behave.ignoreGlobs',
    section: 'behave',
    prop: 'ignoreGlobs',
    type: 'array',
    schemaType: 'array',
    default: ["**/node_modules/**", "**/.venv/**", "**/venv/**", "**/env/**"]
  },
  {
    key: 'gherkinPowerTools.behave.additionalArguments',
    section: 'behave',
    prop: 'additionalArguments',
    type: 'array',
    schemaType: 'array',
    default: []
  },

  {
    key: 'gherkinPowerTools.behave.execution',
    section: 'behave',
    prop: 'execution',
    type: 'object',
    schemaType: 'object',
    default: { executable: 'behave', arguments: [] }
  },
  {
    key: 'gherkinPowerTools.behave.localExecutable',
    section: 'behave',
    prop: 'localExecutable', // Not in schema, handled specially
    type: 'string',
    schemaType: null,
    default: undefined
  },
  {
    key: 'gherkinPowerTools.behave.localExecution',
    section: 'behave',
    prop: 'localExecution', // Not in schema, handled specially
    type: 'object',
    schemaType: null,
    default: undefined
  }
];

// Check package.json configuration
for (const s of expectedSettings) {
  const p = pkgProps[s.key];
  if (!p) {
    fail(`Setting "${s.key}" missing in package.json contributes.configuration`);
  }
  if (p.type !== s.type) {
    fail(`Type mismatch in package.json for "${s.key}": expected ${s.type}, got ${p.type}`);
  }
  if (s.default !== undefined && JSON.stringify(p.default) !== JSON.stringify(s.default)) {
    fail(`Default mismatch in package.json for "${s.key}": expected ${JSON.stringify(s.default)}, got ${JSON.stringify(p.default)}`);
  }
}

// Check JSON schema (gherkin-powertools.schema.json)
for (const s of expectedSettings) {
  if (s.schemaType === null) continue; // Skip settings not intended for project schema

  const sectionObj = jsonSchema.properties?.[s.section];
  if (!sectionObj || !sectionObj.properties) {
    fail(`Section "${s.section}" missing in gherkin-powertools.schema.json`);
  }
  const p = sectionObj.properties[s.prop];
  if (!p) {
    fail(`Property "${s.section}.${s.prop}" missing in gherkin-powertools.schema.json`);
  }
  if (p.type !== s.schemaType) {
    fail(`Type mismatch in JSON schema for "${s.section}.${s.prop}": expected ${s.schemaType}, got ${p.type}`);
  }
  if (JSON.stringify(p.default) !== JSON.stringify(s.default)) {
    fail(`Default mismatch in JSON schema for "${s.section}.${s.prop}": expected ${JSON.stringify(s.default)}, got ${JSON.stringify(p.default)}`);
  }
}

// Check docs/configuration.md
const docsConfigPath = path.join(rootDir, 'docs', 'configuration.md');
const docsConfigContent = fs.readFileSync(docsConfigPath, 'utf8');

for (const s of expectedSettings) {
  if (!docsConfigContent.includes(s.key)) {
    fail(`Setting "${s.key}" not documented in docs/configuration.md`);
  }
}

console.log('✅ Configuration synchronization check PASSED!');
