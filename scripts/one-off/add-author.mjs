// scripts/add-author.mjs
//
// 给 COLLABORATION 里的"条目 .md"补 author 字段。
//
// 用法：
//   node scripts/add-author.mjs [target-dir] [--dry-run] [--author <email>]
//
// 只处理"条目目录"下的 .md——见 ENTRY_KIND_DIRS。
// 其他目录（如 templates/、meta/ 根下、仓库根）完全跳过。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// 与 src/domain/entry/types.ts 的 EntryKindDir 保持一致。
// 如果后者变了，这里要同步。
const ENTRY_KIND_DIRS = [
  "agreements",
  "workflows",
  "skills",
  "patterns",
  "meta/decision-records",
];

const PLACEHOLDER = "unknown@collaboration";

// ─────────────────────────────────────────────
// 参数解析
// ─────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const authorFlagIdx = args.indexOf("--author");
let forcedAuthor = null;
if (authorFlagIdx !== -1 && args[authorFlagIdx + 1]) {
  forcedAuthor = args[authorFlagIdx + 1];
}

const targetDir =
  args.find((a) => !a.startsWith("--") && a !== forcedAuthor) ?? ".";
const absoluteTarget = path.resolve(targetDir);

if (!fs.existsSync(absoluteTarget)) {
  console.error(`✖ target directory not found: ${absoluteTarget}`);
  process.exit(1);
}

console.log(`${dryRun ? "(dry-run) " : ""}Scanning: ${absoluteTarget}`);
console.log("");

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────

const files = collectEntryFiles(absoluteTarget);

let updated = 0;
let skipped = 0;
let warned = 0;

for (const file of files) {
  const result = processFile(file);
  switch (result.kind) {
    case "updated":
      updated++;
      console.log(`✓ ${result.relPath}  → author: ${result.author}`);
      break;
    case "skipped":
      skipped++;
      console.log(`- ${result.relPath}  (already has author)`);
      break;
    case "warned":
      warned++;
      console.log(`⚠ ${result.relPath}  (${result.reason})`);
      break;
  }
}

console.log("");
console.log(
  `Summary: ${updated} to update, ${skipped} skipped, ${warned} warned.`,
);

if (!dryRun && updated > 0) {
  console.log("");
  console.log(`Done. ${updated} files updated.`);
}

// ─────────────────────────────────────────────
// 目录 / 文件收集
// ─────────────────────────────────────────────

/** 文件是否在"条目目录"下。 */
function isEntryFile(rel) {
  const norm = rel.replace(/\\/g, "/");
  return ENTRY_KIND_DIRS.some(
    (dir) => norm === dir || norm.startsWith(dir + "/"),
  );
}

/**
 * 是否应该进入某个目录。
 *
 * 规则：进入"条目目录"或"条目目录的父目录"。
 * 例：
 *   '' → 进（根）
 *   'agreements' → 进（是条目目录）
 *   'meta' → 进（meta/decision-records 的前缀）
 *   'meta/decision-records' → 进（是条目目录）
 *   'templates' → 不进
 *   'meta/foo' → 不进
 */
function shouldDescend(rel) {
  const norm = rel.replace(/\\/g, "/");
  if (norm === "" || norm === ".") return true;
  return ENTRY_KIND_DIRS.some(
    (dir) => norm === dir || dir.startsWith(norm + "/"),
  );
}

function collectEntryFiles(baseDir) {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(baseDir, full);

      if (entry.isDirectory()) {
        if (shouldDescend(rel)) walk(full);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".md")) continue;
      if (entry.name.startsWith("_")) continue;
      if (!isEntryFile(rel)) continue;

      out.push(full);
    }
  }
  walk(baseDir);
  return out;
}

// ─────────────────────────────────────────────
// 文件处理
// ─────────────────────────────────────────────

function processFile(absolutePath) {
  const relPath = path.relative(absoluteTarget, absolutePath);

  let content;
  try {
    content = fs.readFileSync(absolutePath, "utf8");
  } catch {
    return { kind: "warned", relPath, reason: "cannot read" };
  }

  const hasBom = content.charCodeAt(0) === 0xfeff;
  const text = hasBom ? content.slice(1) : content;
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);

  if (lines[0] !== "---") {
    return { kind: "warned", relPath, reason: "no frontmatter" };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) {
    return { kind: "warned", relPath, reason: "unclosed frontmatter" };
  }

  for (let i = 1; i < endIndex; i++) {
    if (/^author\s*:/.test(lines[i])) {
      return { kind: "skipped", relPath };
    }
  }

  const author = forcedAuthor ?? inferAuthor(absolutePath) ?? PLACEHOLDER;

  const newLines = [
    ...lines.slice(0, endIndex),
    `author: ${author}`,
    ...lines.slice(endIndex),
  ];
  const newText = newLines.join(newline);

  if (!dryRun) {
    const output = hasBom ? "\uFEFF" + newText : newText;
    fs.writeFileSync(absolutePath, output, "utf8");
  }

  return { kind: "updated", relPath, author };
}

function inferAuthor(absolutePath) {
  try {
    const out = execFileSync(
      "git",
      ["log", "--follow", "--format=%ae", "-1", "--", absolutePath],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
