// scripts/one-off/add-author.ts
//
// 给 COLLABORATION 里的"条目 .md"补 author 字段。
//
// 用法：
//   tsx scripts/one-off/add-author.ts [target-dir] [--dry-run] [--author <name>]
//
// 只处理"条目目录"下的 .md（目录从 `EntryKindDir` 派生，不再手抄）；
// 其他目录（templates/、meta/ 根下、仓库根）完全跳过。
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { collectEntryFiles, toPosixRel } from "../lib/entryFiles.js";
import {
  hasField,
  insertAfterStatus,
  locateFrontmatter,
  rebuild,
} from "../lib/entryFrontmatter.js";

const PLACEHOLDER = "unknown@collaboration";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const authorFlagIdx = args.indexOf("--author");
let forcedAuthor: string | null = null;
const authorFlagValue = authorFlagIdx === -1 ? undefined : args[authorFlagIdx + 1];
if (authorFlagValue !== undefined && authorFlagValue.length > 0) {
  forcedAuthor = authorFlagValue;
}

const targetDir =
  args.find((a) => !a.startsWith("--") && a !== authorFlagValue) ?? ".";
const absoluteTarget = path.resolve(targetDir);

console.log(`${dryRun ? "(dry-run) " : ""}Scanning: ${absoluteTarget}`);
console.log("");

let updated = 0;
let skipped = 0;
let warned = 0;

for (const file of collectEntryFiles(absoluteTarget)) {
  const relPath = toPosixRel(absoluteTarget, file);
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    console.log(`⚠ ${relPath}  (cannot read)`);
    warned++;
    continue;
  }

  const block = locateFrontmatter(content);
  if (block === null) {
    console.log(`⚠ ${relPath}  (no frontmatter)`);
    warned++;
    continue;
  }
  if (hasField(block, "author")) {
    skipped++;
    console.log(`- ${relPath}  (already has author)`);
    continue;
  }

  const author = forcedAuthor ?? inferAuthor(file) ?? PLACEHOLDER;
  if (!dryRun) {
    writeFileSync(file, rebuild(block, insertAfterStatus(block, [`author: ${author}`])), "utf8");
  }
  updated++;
  console.log(`✓ ${relPath}  → author: ${author}`);
}

console.log("");
console.log(`Summary: ${updated} to update, ${skipped} skipped, ${warned} warned.`);
if (!dryRun && updated > 0) {
  console.log("");
  console.log(`Done. ${updated} files updated.`);
}

/** 从 git 历史推断作者（首次添加该文件的提交者邮箱）。 */
function inferAuthor(absolutePath: string): string | null {
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
