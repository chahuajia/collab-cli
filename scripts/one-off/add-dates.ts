// scripts/one-off/add-dates.ts
//
// 给 COLLABORATION 里的"条目 .md"补 created / updated 字段。
//
// 用法：
//   tsx scripts/one-off/add-dates.ts [target-dir] [--dry-run] [--literal <date>]
//
// 数据来源：
//   - created = git 首次添加该文件的 commit 日期（YYYY-MM-DD）
//   - updated = git 最后一次修改该文件的 commit 日期（YYYY-MM-DD）
//   - 无 git 历史 → 用 --literal 或默认 1970-01-01
//
// 插入位置：优先 `status:` 之后（标准字段顺序），兜底 frontmatter 末尾。
// 目录从 `EntryKindDir` 派生（原先手抄一份，已见过一次漂移）。
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { collectEntryFiles, entryKindDirs, toPosixRel } from "../lib/entryFiles.js";
import {
  hasField,
  insertAfterStatus,
  locateFrontmatter,
  rebuild,
} from "../lib/entryFrontmatter.js";

const DEFAULT_LITERAL = "1970-01-01";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const literalIdx = args.indexOf("--literal");
const literalValue = literalIdx === -1 ? undefined : args[literalIdx + 1];
let literalDate: string | null = null;
if (literalValue !== undefined && literalValue.length > 0) literalDate = literalValue;

const targetDir = args.find((a) => !a.startsWith("--") && a !== literalValue) ?? ".";
const absoluteTarget = path.resolve(targetDir);

console.log(`${dryRun ? "(dry-run) " : ""}Scanning: ${absoluteTarget}`);
console.log(`Looking in: ${entryKindDirs().join(", ")}`);
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

  const hasCreated = hasField(block, "created");
  const hasUpdated = hasField(block, "updated");
  if (hasCreated && hasUpdated) {
    skipped++;
    console.log(`- ${relPath}  (already has both dates)`);
    continue;
  }

  const created = hasCreated
    ? null
    : (literalDate ?? inferCreatedDate(file) ?? DEFAULT_LITERAL);
  const updatedAt = hasUpdated
    ? null
    : (literalDate ?? inferUpdatedDate(file) ?? DEFAULT_LITERAL);

  const fieldLines: string[] = [];
  if (created !== null) fieldLines.push(`created: ${created}`);
  if (updatedAt !== null) fieldLines.push(`updated: ${updatedAt}`);

  if (!dryRun) {
    writeFileSync(file, rebuild(block, insertAfterStatus(block, fieldLines)), "utf8");
  }
  updated++;
  console.log(
    `✓ ${relPath}  → created: ${created ?? "(existing)"}, updated: ${updatedAt ?? "(existing)"}`,
  );
}

console.log("");
console.log(`Summary: ${updated} to update, ${skipped} skipped, ${warned} warned.`);
if (!dryRun && updated > 0) {
  console.log("");
  console.log(`Done. ${updated} files updated.`);
}

/** 首次 commit 的日期（最早）。 */
function inferCreatedDate(absolutePath: string): string | null {
  const lines = gitLines(absolutePath, [
    "log",
    "--follow",
    "--diff-filter=A",
    "--format=%ad",
    "--date=short",
    "--",
    absolutePath,
  ]);
  return lines.length > 0 ? (lines[lines.length - 1] ?? null) : null;
}

/** 最后 commit 的日期（最新）。 */
function inferUpdatedDate(absolutePath: string): string | null {
  const lines = gitLines(absolutePath, [
    "log",
    "--follow",
    "--format=%ad",
    "--date=short",
    "-1",
    "--",
    absolutePath,
  ]);
  return lines.length > 0 ? (lines[0] ?? null) : null;
}

function gitLines(cwdFilePath: string, argv: readonly string[]): readonly string[] {
  try {
    return execFileSync("git", argv, {
      encoding: "utf8",
      cwd: path.dirname(cwdFilePath),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}
