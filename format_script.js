const fs = require('fs');
const { GherkinFormattingEditProvider } = require('./out/formatter.js');
const formatter = new GherkinFormattingEditProvider();
const text = fs.readFileSync('test.feature', 'utf8');
const lines = text.split(/\r?\n/);
const formatted = formatter.formatGherkin(lines, 4, { stepIndentation: 4, indentationStyle: 'flat', alignTableToKeyword: true, tagsFormat: 'wrap', emptyLinesBetweenScenarios: 1 });
console.log(formatted.join('\n'));
