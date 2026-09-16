// 一次性迁移脚本：把 Bundle 中带 `未来文件路径` 声明的条目提取成可落盘文件。
//
// 用法：
//   node scripts/extract-bundle.mjs            # 干跑，只打印清单
//   node scripts/extract-bundle.mjs --write    # 写入 .landing/（不改动正式目录）
//
// 之后由人 review，再把 .landing/ 的内容移入 agreements / workflows / skills / patterns / meta。
// 落盘后本脚本可删除（或移交 collab-cli 的 scripts/）。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const BUNDLE = path.join(ROOT, 'inbox', 'v4.1-bundle.md');
const LANDING = path.join(ROOT, '.landing');
const WRITE = process.argv.includes('--write');

// 允许标记行尾部有注释（如 `AGENTS.md`（项目根））
const MARKER = /^\*\*未来文件路径\*\*[：:]\s*`([^`]+)`/;
const DEBRIS = [
  /^={3,}/,
  /^#{2,3}\s*演化日志追加/,
  /^##\s*[一二三四五六七八九十]+、/,
  /^\|\s*日期\s*\|\s*版本\s*\|/,
  /^`COLLABORATION\/meta\/evolution-log\.md`/,
  /^###\s+\S*动作\s*\d/,
];

const text = fs.readFileSync(BUNDLE, 'utf8');
const lines = text.split(/\r?\n/);

// 1. 收集标记
const marks = [];
lines.forEach((line, i) => {
  const m = line.match(MARKER);
  if (m) marks.push({ at: i, raw: m[1].trim() });
});

// 2. 判断该标记的 frontmatter 在标记之后（常规）还是之前（标记被放在标题下方）
function frontmatterStartBefore(i) {
  let j = i - 1;
  const skipBlank = () => { while (j >= 0 && lines[j].trim() === '') j -= 1; };
  skipBlank();
  if (j >= 0 && /^#\s/.test(lines[j])) { j -= 1; skipBlank(); }
  for (let k = j; k >= Math.max(0, i - 25); k -= 1) {
    if (MARKER.test(lines[k]) || /^#{2,3}\s/.test(lines[k])) return null;
    if (lines[k].trim() === '---' && /^id:/.test((lines[k + 1] ?? '').trim())) return k;
  }
  return null;
}

function startsWithFrontmatter(from) {
  for (let k = from; k < Math.min(lines.length, from + 12); k += 1) {
    if (lines[k].trim() === '') continue;
    return lines[k].trim() === '---' && /^id:/.test((lines[k + 1] ?? '').trim());
  }
  return false;
}

// 3. 切段：内容 = 从（frontmatter 起点）到下一个标记之前
const chunks = marks.map((mk, idx) => {
  const end = idx + 1 < marks.length ? marks[idx + 1].at : lines.length;
  const start = startsWithFrontmatter(mk.at + 1)
    ? mk.at + 1
    : (frontmatterStartBefore(mk.at) ?? mk.at + 1);
  return { raw: mk.raw, at: mk.at, body: lines.slice(start, end) };
});

// 3b. 追加 `===== FILE: <path> =====` … `===== END FILE =====` 块（A17 输出格式）
for (let i = 0; i < lines.length; i += 1) {
  const m = lines[i].match(/^===== FILE:\s*(.+?)\s*=====$/);
  if (!m) continue;
  // 原文个别块漏了 END FILE，所以同时以"下一个 FILE 块"为硬边界
  const endFile = lines.findIndex((l, j) => j > i && /^===== END FILE =====$/.test(l));
  const nextFile = lines.findIndex((l, j) => j > i && /^===== FILE:/.test(l));
  const end = Math.min(
    endFile < 0 ? lines.length : endFile,
    nextFile < 0 ? lines.length : nextFile,
  );
  if (end <= i + 1) continue;
  chunks.push({ raw: m[1], at: i, body: lines.slice(i + 1, end) });
  i = end;
}

// 3. 规范化目标路径（布局 B：去掉 COLLABORATION/ 前缀）
function normalizePath(raw) {
  let p = raw.replace(/^`|`$/g, '').trim();
  const notes = [];
  if (p.startsWith('COLLABORATION/')) p = p.slice('COLLABORATION/'.length);
  if (p === 'AGENTS.md' || p.startsWith('working-memory/')) notes.push('非条目（入口/工作记忆），跳过');
  if (p.endsWith('.md')) { /* ok */ } else notes.push('非 .md 目标');
  return { path: p, notes };
}

// 4. 清洗正文：去掉标记行与尾部对话残渣
function clean(body) {
  // 去掉前导空行（Bundle 里标记与 frontmatter 之间常有空行）
  let start = 0;
  while (start < body.length && body[start].trim() === '') start += 1;
  const out = [];
  const warnings = [];
  for (const line of body.slice(start)) {
    if (MARKER.test(line)) continue; // 条目内重复出现的路径标记不是内容
    if (DEBRIS.some((re) => re.test(line))) {
      warnings.push(`尾部残渣截断：${line.slice(0, 40)}`);
      break;
    }
    out.push(line);
  }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  // 整块被包裹在 ```markdown 里时，只剥掉最外层那对围栏（内部围栏保持原样）
  if (/^```/.test(out[0] ?? '')) {
    out.shift();
    while (out.length && out[0].trim() === '') out.shift();
    if (out[out.length - 1]?.trim() === '```') out.pop();
    while (out.length && out[out.length - 1].trim() === '') out.pop();
    warnings.push('剥掉外层代码围栏');
  }
  // 条目末尾常粘着下一个条目的标题，去掉尾部的标题行
  while (out.length && /^#{2,3}\s/.test(out[out.length - 1])) {
    out.pop();
    while (out.length && out[out.length - 1].trim() === '') out.pop();
  }
  // Bundle 中个别条目丢失了 frontmatter 的起始分隔符（如 S22）
  if (/^id:/.test(out[0] ?? '') && out.findIndex((l, i) => i > 0 && l.trim() === '---') > 0) {
    out.unshift('---');
    warnings.push('补回缺失的 frontmatter 起始分隔符');
  }
  // 「关联」之后的散句不是条目内容（Bundle 里常粘着对话残句）
  const rel = out.map((l, i) => ({ l, i })).filter((x) => /^##\s*关联/.test(x.l)).pop();
  if (rel) {
    let end = rel.i + 1;
    while (end < out.length && (out[end].trim() === '' || /^\s*(\[\[|-{1,2}\s|\*{1,2}\s|\d+\.\s)/.test(out[end]))) end += 1;
    if (end < out.length && out.slice(end).some((l) => l.trim() !== '')) {
      warnings.push(`截断「关联」之后的散句：${out[end].trim().slice(0, 30)}`);
      out.length = end;
    }
  }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  // 代码围栏在原文里可能未闭合（如 A13 的示例块）——在下一个 ## 标题处补上
  let inFence = false;
  for (let i = 0; i < out.length; i += 1) {
    if (/^```/.test(out[i])) { inFence = !inFence; continue; }
    // 只在条目自身的必备章节标题处闭合围栏（示例块内部可能有 ## 标题）
    if (inFence && /^##\s*(上下文|问题|方案|反面|关联|背景|决策|后果|替代方案)\s*$/.test(out[i])) {
      while (out[i - 1]?.trim() === '') out.splice(i - 1, 1), i -= 1;
      out.splice(i, 0, '```', '');
      warnings.push('补回未闭合的代码围栏');
      inFence = false;
      i += 2;
    }
  }
  if (inFence) { out.push('```'); warnings.push('末尾补回未闭合的代码围栏'); }
  const text = out.join('\n');
  if (!text.startsWith('---')) warnings.push('正文不以 frontmatter 开头');
  return { text, warnings };
}

// 5. 校验
function check(p, body) {
  const problems = [];
  const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) problems.push('缺少 frontmatter');
  else {
    for (const key of ['id', 'type', 'status']) {
      if (!new RegExp(`^${key}:`, 'm').test(fm[1])) problems.push(`frontmatter 缺 ${key}`);
    }
  }
  const kind = (fm?.[1].match(/^type:\s*(\w+)/m) ?? [])[1];
  const isAdr = /\/ADR-/.test(p) || /^id:\s*ADR-/m.test(fm?.[1] ?? '');
  const required = kind === 'meta'
    ? ['关联']
    : isAdr
      ? ['背景', '决策', '后果', '替代方案', '关联']
      : ['上下文', '问题', '方案', '反面', '关联'];
  const missing = required.filter((s) => !new RegExp(`^##\\s*${s}`, 'm').test(body));
  if (missing.length) problems.push(`缺章节：${missing.join('/')}`);
  return problems;
}

// 6. 去重（同一路径保留内容最长的版本）
const byPath = new Map();
for (const ch of chunks) {
  const { path: p, notes } = normalizePath(ch.raw);
  if (notes.some((n) => n.includes('跳过'))) continue;
  if (!p.endsWith('.md') || /[<>]/.test(p)) continue; // 占位符与非 Markdown 目标
  const { text: body, warnings } = clean(ch.body);
  const rec = { path: p, at: ch.at, body, warnings, problems: check(p, body) };
  const prev = byPath.get(p);
  if (!prev) byPath.set(p, { ...rec, duplicates: 1 });
  else {
    prev.duplicates += 1;
    if (body.length > prev.body.length) byPath.set(p, { ...rec, duplicates: prev.duplicates });
    else byPath.get(p).warnings.push(`存在 ${prev.duplicates} 个同名声明，保留了较长版本`);
  }
}

const entries = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));

// 7. 落盘（仅写入 .landing/）
if (WRITE) fs.rmSync(LANDING, { recursive: true, force: true });
for (const e of entries) {
  if (!WRITE) continue;
  const target = path.join(LANDING, e.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, e.body + '\n', 'utf8');
}

// 8. 报告
const manifest = entries.map((e) => ({
  path: e.path,
  bytes: Buffer.byteLength(e.body, 'utf8'),
  sha256: crypto.createHash('sha256').update(e.body).digest('hex').slice(0, 12),
  duplicates: e.duplicates,
  problems: e.problems,
  warnings: e.warnings,
}));

console.log(`Bundle: ${path.basename(BUNDLE)}  标记数=${marks.length}  去重后条目=${entries.length}\n`);
for (const m of manifest) {
  const flag = m.problems.length ? 'ERR ' : m.warnings.length ? 'WARN' : 'OK  ';
  const extra = [...m.problems, ...m.warnings].join(' | ');
  console.log(`${flag} ${m.path.padEnd(52)} ${String(m.bytes).padStart(6)}B  ${extra}`);
}

const bad = manifest.filter((m) => m.problems.length);
console.log(`\n合计 ${manifest.length} 条，其中 ${bad.length} 条有硬问题，${manifest.filter((m) => m.warnings.length && !m.problems.length).length} 条有告警。`);
if (WRITE) console.log(`已写入暂存目录：${path.relative(ROOT, LANDING)}/`);
