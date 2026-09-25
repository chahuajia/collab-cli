// scripts/add-dates.mjs
//
// 给 COLLABORATION 里的"条目 .md"补 created / updated 字段。
//
// 用法：
//   node scripts/add-dates.mjs [target-dir] [--dry-run] [--literal <date>]
//
// 数据来源：
//   - created = git 首次添加该文件的 commit 日期（YYYY-MM-DD）
//   - updated = git 最后一次修改该文件的 commit 日期（YYYY-MM-DD）
//   - 无 git 历史 → 用 --literal 或默认 1970-01-01
//
// 插入位置：
//   - 优先：status 行后（符合标准字段顺序）
//   - 兜底：frontmatter 末尾
//
// 只处理"条目目录"下的 .md——见 ENTRY_KIND_DIRS。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ENTRY_KIND_DIRS = [
  "agreements",
  "workflows",
  "skills",
  "patterns",
  "meta/decision-records",
];

const DEFAULT_LITERAL = "1970-01-01";

// ─────────────────────────────────────────────
// 参数解析
// ─────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const literalIdx = args.indexOf("--literal");
let literalDate = null;
if (literalIdx !== -1 && args[literalIdx + 1]) {
  literalDate = args[literalIdx + 1];
}

const targetDir =
  args.find((a) => !a.startsWith("--") && a !== literalDate) ?? ".";
const absoluteTarget = path.resolve(targetDir);

if (!fs.existsSync(absoluteTarget)) {
  console.error(`✖ target directory not found: ${absoluteTarget}`);
  process.exit(1);
}

console.log(`${dryRun ? "(dry-run) " : ""}Scanning: ${absoluteTarget}`);
console.log(`Looking in: ${ENTRY_KIND_DIRS.join(", ")}`);
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
      console.log(
        `✓ ${result.relPath}  → created: ${result.created}, updated: ${result.updated}`,
      );
      break;
    case "skipped":
      skipped++;
      console.log(`- ${result.relPath}  (already has both dates)`);
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

function isEntryFile(rel) {
  const norm = rel.replace(/\\/g, "/");
  return ENTRY_KIND_DIRS.some(
    (dir) => norm === dir || norm.startsWith(dir + "/"),
  );
}

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

  // 检查现有字段
  let hasCreated = false;
  let hasUpdated = false;
  let statusLineIdx = -1;
  for (let i = 1; i < endIndex; i++) {
    if (/^created\s*:/.test(lines[i])) hasCreated = true;
    if (/^updated\s*:/.test(lines[i])) hasUpdated = true;
    if (/^status\s*:/.test(lines[i])) statusLineIdx = i;
  }

  if (hasCreated && hasUpdated) {
    return { kind: "skipped", relPath };
  }

  // 计算日期
  const created = hasCreated
    ? null
    : (literalDate ?? inferCreatedDate(absolutePath) ?? DEFAULT_LITERAL);
  const updated = hasUpdated
    ? null
    : (literalDate ?? inferUpdatedDate(absolutePath) ?? DEFAULT_LITERAL);

  // 构造要插入的行
  const newFieldLines = [];
  if (created !== null) newFieldLines.push(`created: ${created}`);
  if (updated !== null) newFieldLines.push(`updated: ${updated}`);

  // 插入位置：status 行后；否则 frontmatter 末尾（endIndex 前）
  const insertAt = statusLineIdx !== -1 ? statusLineIdx + 1 : endIndex;

  const newLines = [
    ...lines.slice(0, insertAt),
    ...newFieldLines,
    ...lines.slice(insertAt),
  ];
  const newText = newLines.join(newline);

  if (!dryRun) {
    const output = hasBom ? "\uFEFF" + newText : newText;
    fs.writeFileSync(absolutePath, output, "utf8");
  }

  return {
    kind: "updated",
    relPath,
    created: created ?? "(existing)",
    updated: updated ?? "(existing)",
  };
}

// ─────────────────────────────────────────────
// git 推断
// ─────────────────────────────────────────────

/** 首次 commit 的日期（最早）。 */
function inferCreatedDate(absolutePath) {
  try {
    const out = execFileSync(
      "git",
      [
        "log",
        "--follow",
        "--diff-filter=A",
        "--format=%ad",
        "--date=short",
        "--",
        absolutePath,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const lines = out
      .trim()
      .split("\n")
      .filter((s) => s.length > 0);
    return lines.length > 0 ? lines[lines.length - 1] : null;
  } catch {
    return null;
  }
}

/** 最后 commit 的日期（最新）。 */
function inferUpdatedDate(absolutePath) {
  try {
    const out = execFileSync(
      "git",
      [
        "log",
        "--follow",
        "--format=%ad",
        "--date=short",
        "-1",
        "--",
        absolutePath,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
