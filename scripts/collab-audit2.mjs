// 状态分布/dormant 计数/interceptions 行数/ADR 状态）
import fs from 'fs';
import path from 'path';

const ROOT = 'D:/actto/front/mock/test-collaboration';
const SKIP = new Set(['.git', '.obsidian', '.idea', 'node_modules', '.landing']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}
const files = walk(ROOT);
const rel = p => p.slice(ROOT.length + 1);

console.log('=== STATUS DISTRIBUTION ===');
const status = new Map();
for (const p of files) {
  const b = fs.readFileSync(p, 'utf8');
  const m = b.match(/^status:\s*(.+)$/m);
  const s = m ? m[1].trim() : '(none)';
  status.set(s, (status.get(s) || 0) + 1);
}
for (const [s, c] of [...status].sort((a, b) => b[1] - a[1])) console.log(`  ${s}: ${c}`);

console.log('\n=== ANY dormant / deprecated / archived? ===');
let found = 0;
for (const p of files) {
  const b = fs.readFileSync(p, 'utf8');
  if (/^(status:\s*(dormant|deprecated))/m.test(b)) { console.log('  ' + rel(p)); found++; }
}
if (!found) console.log('  (NONE — nothing has ever left active in the repo\'s history)');

console.log('\n=== has archive/ dir? ===');
console.log('  ', fs.existsSync(path.join(ROOT, 'archive')) ? 'yes' : 'NO — pruning never produced output');

console.log('\n=== interceptions.md rows ===');
const ip = fs.readFileSync(path.join(ROOT, 'meta/interceptions.md'), 'utf8');
const rows = ip.split('\n').filter(l => /^\|\s*\d{4}-\d{2}-\d{2}/.test(l));
console.log(`  real dated rows: ${rows.length}`);
rows.forEach(r => console.log('   ' + r.slice(0, 120)));

console.log('\n=== evolution-log: 确认者 column ===');
const el = fs.readFileSync(path.join(ROOT, 'meta/evolution-log.md'), 'utf8');
const elRows = el.split('\n').filter(l => /^\|\s*\d{4}-\d{2}-\d{2}/.test(l));
console.log(`  total rows: ${elRows.length}`);
const pending = elRows.filter(r => r.includes('待确认'));
console.log(`  rows with 待确认 (unconfirmed): ${pending.length}`);
const aiOnly = elRows.filter(r => /\|\s*AI\s*\(/.test(r));
console.log(`  rows proposed by AI: ${aiOnly.length}`);
console.log(`  commit-filled rows: ${elRows.filter(r => /\|\s*[0-9a-f]{7}\s*\|/.test(r)).length} (rest are '-')`);

console.log('\n=== ADRs ===');
const adrDir = path.join(ROOT, 'meta/decision-records');
for (const f of fs.readdirSync(adrDir)) {
  if (!f.endsWith('.md') || f === '_index.md') continue;
  const b = fs.readFileSync(path.join(adrDir, f), 'utf8');
  const st = b.match(/^status:\s*(.+)$/m);
  console.log(`  ${f}: status=${st ? st[1].trim() : '?'}`);
}

console.log('\n=== git: commits vs evolution-log versions ===');
console.log('  (see git log separately)');

console.log('\n=== W10 working-memory / parking-lot existence ===');
for (const f of ['working-memory', 'parking-lot.md', 'decisions.md']) {
  console.log(`  ${f}: ${fs.existsSync(path.join(ROOT, f)) ? 'exists' : 'MISSING'}`);
}
