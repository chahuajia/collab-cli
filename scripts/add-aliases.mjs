// scripts/add-aliases.mjs
//
// 给"文件名 ≠ frontmatter.id"的条目加 aliases。
//
// 用法：
//   node scripts/add-aliases.mjs <collab-dir> [--dry-run]
//
// 逻辑：
//   - 文件名 = id        → 跳过（无需 aliases）
//   - 文件名 = id-描述   → 加 aliases: [id]（如果还没有）
//   - 其他不一致         → 警告
//
// 幂等：已有 aliases 的条目跳过。
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const collabDir = path.resolve(args.find((a) => !a.startsWith("--")) ?? ".");

const ENTRY_DIRS = [
  "agreements",
  "workflows",
  "skills",
  "patterns",
  "meta/decision-records",
];

function isEntryFile(rel) {
  const norm = rel.replace(/\\/g, "/");
  return ENTRY_DIRS.some((d) => norm.startsWith(d + "/"));
}

function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  return { lines, endIndex: end };
}

function getId(lines, endIndex) {
  for (let i = 1; i < endIndex; i++) {
    const m = lines[i].match(/^id:\s*(.+)$/);
    if (m) return m[1].trim();
  }
  return null;
}

function hasAliases(lines, endIndex) {
  for (let i = 1; i < endIndex; i++) {
    if (/^aliases\s*:/.test(lines[i])) return true;
  }
  return false;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

let updated = 0;
let skipped = 0;
let warned = 0;

for (const file of walk(collabDir)) {
  const rel = path.relative(collabDir, file).replace(/\\/g, "/");
  if (!isEntryFile(rel)) continue;
  if (path.basename(file).startsWith("_")) continue;

  const content = fs.readFileSync(file, "utf8");
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    console.log(`⚠ ${rel}: no frontmatter`);
    warned++;
    continue;
  }

  const id = getId(parsed.lines, parsed.endIndex);
  if (!id) {
    console.log(`⚠ ${rel}: no id`);
    warned++;
    continue;
  }

  const fileNameNoExt = path.basename(file, ".md");

  // 情况 1：文件名 = id → 不需要 aliases
  if (fileNameNoExt === id) {
    skipped++;
    continue;
  }

  // 情况 2：文件名 = id-描述 → 加 aliases
  if (fileNameNoExt.startsWith(id + "-")) {
    if (hasAliases(parsed.lines, parsed.endIndex)) {
      console.log(`- ${rel}: aliases already exist`);
      skipped++;
      continue;
    }

    const newLines = [
      ...parsed.lines.slice(0, parsed.endIndex),
      `aliases: [${id}]`,
      ...parsed.lines.slice(parsed.endIndex),
    ];
    const newContent = newLines.join("\n");

    if (!dryRun) {
      fs.writeFileSync(file, newContent, "utf8");
    }
    console.log(`${dryRun ? "[dry-run] " : ""}✓ ${rel}  → aliases: [${id}]`);
    updated++;
    continue;
  }

  // 情况 3：其他不一致
  console.log(
    `⚠ ${rel}: filename "${fileNameNoExt}" does not match id "${id}" (unexpected)`,
  );
  warned++;
}

console.log("");
console.log(
  `${dryRun ? "[dry-run] " : ""}Summary: ${updated} updated, ${skipped} skipped, ${warned} warned.`,
);
