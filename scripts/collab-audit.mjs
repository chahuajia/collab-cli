//报 ID 重复/死链/入链数/覆盖率/体积
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
const meta = new Map();
const resolvable = new Set();

for (const p of files) {
  const body = fs.readFileSync(p, 'utf8');
  const rel = p.slice(ROOT.length + 1);
  const idM = body.match(/^id:\s*(.+)$/m);
  const id = idM ? idM[1].trim() : null;
  const aliasM = body.match(/^aliases:\s*\[(.*)\]/m);
  const aliases = aliasM ? aliasM[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  meta.set(p, { rel, id, aliases, body });

  resolvable.add(rel.replace(/\.md$/, ''));
  resolvable.add(path.basename(rel, '.md'));
  if (id) resolvable.add(id);
  for (const a of aliases) resolvable.add(a);
}

const byId = new Map();
for (const [p, m] of meta) {
  if (!m.id) continue;
  if (!byId.has(m.id)) byId.set(m.id, []);
  byId.get(m.id).push(m.rel);
}
console.log('=== DUPLICATE IDs ===');
let dupCount = 0;
for (const [id, ps] of byId) {
  if (ps.length > 1) { dupCount++; console.log(`  ${id}: ${ps.join('  |  ')}`); }
}
if (!dupCount) console.log('  (none)');

console.log('\n=== DEAD WIKI-LINKS ===');
const linkRe = /\[\[([^\]|#]+)/g;
const dead = new Map();
for (const [p, m] of meta) {
  let match;
  linkRe.lastIndex = 0;
  while ((match = linkRe.exec(m.body))) {
    const t = match[1].trim().replace(/\.md$/, '');
    if (!t) continue;
    if (!resolvable.has(t)) {
      if (!dead.has(t)) dead.set(t, new Set());
      dead.get(t).add(m.rel);
    }
  }
}
for (const [t, srcs] of [...dead].sort()) {
  console.log(`  [[${t}]]  <- ${srcs.size} file(s): ${[...srcs].map(s => path.basename(s)).join(', ')}`);
}
console.log(`  TOTAL DEAD: ${dead.size}`);

console.log('\n=== INBOUND LINK COUNT ===');
const inbound = new Map();
for (const p of files) inbound.set(p, 0);
for (const [p, m] of meta) {
  const re = /\[\[([^\]|#]+)/g;
  let match;
  while ((match = re.exec(m.body))) {
    const t = match[1].trim().replace(/\.md$/, '');
    for (const [q, mm] of meta) {
      if (q === p) continue;
      const key = mm.rel.replace(/\.md$/, '');
      if (t === key || t === path.basename(key) || t === mm.id || mm.aliases.includes(t)) {
        inbound.set(q, inbound.get(q) + 1);
      }
    }
  }
}
const sorted = [...inbound].sort((a, b) => a[1] - b[1]);
const rel = p => p.slice(ROOT.length + 1);
const zero = sorted.filter(([, c]) => c === 0);
console.log(`  --- ZERO inbound (${zero.length}) ---`);
console.log('  ' + zero.map(([p]) => rel(p)).join('\n  '));

console.log('\n=== COVERAGE ===');
for (const dir of ['agreements', 'workflows', 'skills', 'patterns']) {
  const inDir = [...meta].filter(([p]) => rel(p).startsWith(dir + '/') && !rel(p).endsWith('_index.md'));
  const withProv = inDir.filter(([, m]) => /^provenance:/m.test(m.body));
  const withProb = inDir.filter(([, m]) => /^##\s+问题/m.test(m.body));
  const withCtx = inDir.filter(([, m]) => /^##\s+上下文/m.test(m.body));
  console.log(`  ${dir}: n=${inDir.length}  provenance=${withProv.length}  ## 问题=${withProb.length}  ## 上下文=${withCtx.length}`);
}

console.log('\n=== FRONTMATTER SANITY ===');
for (const [p, m] of meta) {
  const r = rel(p);
  if (r.endsWith('_index.md')) continue;
  if (!m.body.startsWith('---')) console.log(`  NO-FRONTMATTER: ${r}`);
  const stem = path.basename(r, '.md');
  const prefix = stem.match(/^([AWS]\d+)/);
  if (prefix && m.id && prefix[1] !== m.id) console.log(`  ID/FILENAME MISMATCH: ${r}  id=${m.id}  prefix=${prefix[1]}`);
}

let total = 0, lines = 0;
for (const [p, m] of meta) { total += Buffer.byteLength(m.body); lines += m.body.split('\n').length; }
console.log(`\n=== SIZE ===\n  ${files.length} md files, ${lines} lines, ${(total / 1024).toFixed(0)} KB`);
