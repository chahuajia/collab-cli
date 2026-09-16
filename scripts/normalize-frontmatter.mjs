// 一次性迁移：给缺失 frontmatter 字段的条目补齐 author / created / updated / aliases，
// 并修正会让 YAML 解析失败的值（值里含 ": " 未加引号）。
//
//   node scripts/normalize-frontmatter.mjs            # 干跑
//   node scripts/normalize-frontmatter.mjs --write    # 写入
//
// 迁移完成后本脚本可删除。

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const TODAY = '2026-09-15';
const AUTHOR = 'heiniao';

const DIRS = ['agreements', 'workflows', 'skills', 'patterns', 'meta', 'meta/decision-records'];

function files(dir) {
  return fs.readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith('.md') && f !== '_index.md')
    .map((f) => path.join(dir, f).replace(/\\/g, '/'));
}

function needsQuote(value) {
  if (/^["'\[{]/.test(value)) return false;
  if (value.includes(': ') || value.endsWith(':')) return true;
  return false;
}

let changed = 0;
const report = [];

for (const dir of DIRS) {
  for (const rel of files(dir)) {
    const abs = path.join(ROOT, rel);
    const raw = fs.readFileSync(abs, 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) {
      report.push(`SKIP  ${rel}  没有 frontmatter`);
      continue;
    }
    const fm = m[1];
    const lines = fm.split(/\r?\n/);
    const added = [];
    const fixed = [];

    const has = (k) => new RegExp(`^${k}\\s*:`, 'm').test(fm);
    const idMatch = fm.match(/^id:\s*(.+?)\s*$/m);
    const id = idMatch ? idMatch[1].trim() : null;

    const out = lines.map((line) => {
      const kv = line.match(/^([A-Za-z-]+):\s*(.*)$/);
      if (!kv) return line;
      const [, key, value] = kv;
      if (value !== '' && needsQuote(value)) {
        fixed.push(key);
        return `${key}: "${value.replace(/"/g, '\\"')}"`;
      }
      return line;
    });

    if (!has('created')) { out.push(`created: ${TODAY}`); added.push('created'); }
    if (!has('updated')) { out.push(`updated: ${TODAY}`); added.push('updated'); }
    if (!has('author')) { out.push(`author: ${AUTHOR}`); added.push('author'); }
    if (id && !has('aliases') && !/^type:\s*root/m.test(fm)) {
      out.push(`aliases: [${id}]`);
      added.push('aliases');
    }

    if (!added.length && !fixed.length) continue;
    const next = raw.replace(m[0], `---\n${out.join('\n')}\n---`);
    if (WRITE) fs.writeFileSync(abs, next, 'utf8');
    changed += 1;
    report.push(`FIX   ${rel.padEnd(52)} +${added.join(',') || '-'}${fixed.length ? '  quoted:' + fixed.join(',') : ''}`);
  }
}

for (const line of report) console.log(line);
console.log(`\n共 ${changed} 个文件需要改动${WRITE ? '（已写入）' : '（干跑，未写入）'}`);
