const fs = require('fs');
const appJs = fs.readFileSync('public/app.js', 'utf8');
const html = fs.readFileSync('public/workspace.html', 'utf8');

const idRegex = /\$\("([^"]+)"\)/g;
const ids = new Set();
let match;
while ((match = idRegex.exec(appJs)) !== null) {
  ids.add(match[1]);
}

const missing = [];
for (const id of ids) {
  // Ignore dynamic IDs created at runtime or landing page elements
  if (
    id.startsWith('row-') ||
    id.startsWith('table-row-') ||
    id.startsWith('strat-') ||
    id.startsWith('chk-item-') ||
    id.startsWith('pill-step-') ||
    id.startsWith('view-') ||
    id.startsWith('dup-group-') ||
    id.startsWith('dup-card-') ||
    id.startsWith('dup-opt-') ||
    id === 'btn-reset-topic-filter' ||
    id === 'hero-sample-btn'
  ) {
    continue;
  }
  if (!html.includes(`id="${id}"`)) {
    missing.push(id);
  }
}

console.log('Checked', ids.size, 'DOM IDs.');
if (missing.length > 0) {
  console.error('Missing in workspace.html:', missing);
  process.exit(1);
} else {
  console.log('All static workspace DOM IDs verified successfully!');
}
