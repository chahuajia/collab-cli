// scripts/one-off/add-aliases.ts
//
// 给"文件名 ≠ frontmatter.id"的条目加 aliases。
//
// 用法：
//   tsx scripts/one-off/add-aliases.ts <collab-dir> [--dry-run]
//
// 逻辑：
//   - 文件名 = id        → 跳过（无需 aliases）
//   - 文件名 = id-描述   → 加 aliases: [id]（如果还没有）
//   - 其他不一致         → 警告
//
// 幂等：已有 aliases 的条目跳过。
//
// 2026-09-26 转 TS 时顺带修掉一处漂移：这里原先是**手抄**的 5 个目录，
// 少了 `integrations` —— 于是集成层的条目会被它静默跳过。现在目录从
// `EntryKindDir`（领域契约）派生：`scripts/lib/entryFiles.ts`。
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { collectEntryFiles, isInsideEntryDir, toPosixRel } from "../lib/entryFiles.js";
import { hasField, locateFrontmatter, readId, rebuild } from "../lib/entryFrontmatter.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const collabDir = path.resolve(args.find((a) => !a.startsWith("--")) ?? ".");

let updated = 0;
let skipped = 0;
let warned = 0;

for (const file of collectEntryFiles(collabDir)) {
  const rel = toPosixRel(collabDir, file);
  if (!isInsideEntryDir(rel)) continue;

  const block = locateFrontmatter(readFileSync(file, "utf8"));
  if (block === null) {
    console.log(`⚠ ${rel}: no frontmatter`);
    warned++;
    continue;
  }

  const id = readId(block);
  if (id === null) {
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
  if (fileNameNoExt.startsWith(`${id}-`)) {
    if (hasField(block, "aliases")) {
      console.log(`- ${rel}: aliases already exist`);
      skipped++;
      continue;
    }
    const next = rebuild(block, [
      ...block.lines.slice(0, block.endIndex),
      `aliases: [${id}]`,
      ...block.lines.slice(block.endIndex),
    ]);
    if (!dryRun) writeFileSync(file, next, "utf8");
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
