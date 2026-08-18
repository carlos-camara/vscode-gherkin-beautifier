const fs = require('fs');

const lcovPath = 'coverage/lcov.info';
if (!fs.existsSync(lcovPath)) {
    console.error('lcov.info not found');
    process.exit(1);
}

const lines = fs.readFileSync(lcovPath, 'utf8').split('\n');
let keep = false;
const filtered = [];

for (const line of lines) {
    if (line.startsWith('SF:')) {
        const file = line.substring(3);
        if (file.includes('src/') && !file.includes('dist/') && !file.includes('out/') && !file.includes('scripts/')) {
            keep = true;
        } else {
            keep = false;
        }
    }
    if (keep) {
        filtered.push(line);
    }
}

fs.writeFileSync(lcovPath, filtered.join('\n'), 'utf8');
console.log('Filtered lcov.info to keep only src/ files');

const summaryPath = 'coverage/coverage-summary.json';
if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    let totalLines = { total: 0, covered: 0, skipped: 0, pct: 0 };
    let totalStatements = { total: 0, covered: 0, skipped: 0, pct: 0 };
    let totalFunctions = { total: 0, covered: 0, skipped: 0, pct: 0 };
    let totalBranches = { total: 0, covered: 0, skipped: 0, pct: 0 };
    
    for (const key of Object.keys(summary)) {
        if (key !== 'total') {
            if (key.includes('src/') && !key.includes('dist/') && !key.includes('out/') && !key.includes('scripts/')) {
                totalLines.total += summary[key].lines.total;
                totalLines.covered += summary[key].lines.covered;
                totalStatements.total += summary[key].statements.total;
                totalStatements.covered += summary[key].statements.covered;
                totalFunctions.total += summary[key].functions.total;
                totalFunctions.covered += summary[key].functions.covered;
                totalBranches.total += summary[key].branches.total;
                totalBranches.covered += summary[key].branches.covered;
            } else {
                delete summary[key];
            }
        }
    }
    
    totalLines.pct = totalLines.total > 0 ? Number(((totalLines.covered / totalLines.total) * 100).toFixed(2)) : 100;
    totalStatements.pct = totalStatements.total > 0 ? Number(((totalStatements.covered / totalStatements.total) * 100).toFixed(2)) : 100;
    totalFunctions.pct = totalFunctions.total > 0 ? Number(((totalFunctions.covered / totalFunctions.total) * 100).toFixed(2)) : 100;
    totalBranches.pct = totalBranches.total > 0 ? Number(((totalBranches.covered / totalBranches.total) * 100).toFixed(2)) : 100;
    
    summary.total = {
        lines: totalLines,
        statements: totalStatements,
        functions: totalFunctions,
        branches: totalBranches
    };
    
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log('Filtered coverage-summary.json to keep only src/ files');
}
