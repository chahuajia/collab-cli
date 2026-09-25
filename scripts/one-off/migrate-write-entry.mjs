// scripts/migrate-write-entry.mjs
//
// 把 `writeEntry({...})` 的调用替换为具名工厂。
//
// 用法：
//   node scripts/migrate-write-entry.mjs [target-dir] [--dry-run]
//
// 约束：
//   - 单行调用才能被替换 —— 多行保持原样
//   - 有额外参数（status/author/...）的调用不替换
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const targetDir = args.find((a) => !a.startsWith("--")) ?? ".";
const absoluteTarget = path.resolve(targetDir);

const KIND_TO_FN = {
  skill: "writeSkill",
  agreement: "writeAgreement",
  workflow: "writeWorkflow",
  pattern: "writePattern",
  adr: "writeAdr",
};

// 匹配单行 writeEntry({ relPath, id, kind, collabDir }) —— 无额外参数
// 允许空白、引号风格差异（' 或 "）
const WRITE_ENTRY_PATTERN =
  /writeEntry\(\{\s*relPath:\s*(['"])([^'"]+)\1\s*,\s*id:\s*(['"])([^'"]+)\3\s*,\s*kind:\s*(['"])(\w+)\5\s*,\s*collabDir\s*,?\s*\}\)/g;

// 旧 writeIndex('skills', ['S1']) —— 需加 collabDir 为第一个参数
// 但 collabDir 由上下文提供，不能纯文本替换 —— 跳过，人工处理
// （写在这里是为了提醒脚本作者：writeIndex 的替换不在本脚本范围内）

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

let totalReplaced = 0;
let filesChanged = 0;

for (const file of walk(absoluteTarget)) {
  const original = fs.readFileSync(file, "utf8");
  let localCount = 0;

  const modified = original.replace(
    WRITE_ENTRY_PATTERN,
    (match, _q1, relPath, _q2, id, _q3, kind) => {
      const fn = KIND_TO_FN[kind];
      if (!fn) return match; // 未知 kind，保持原样
      localCount++;
      // 用单引号 —— 保持项目风格
      return `${fn}('${relPath}', '${id}', collabDir)`;
    },
  );

  if (modified !== original) {
    if (!dryRun) {
      fs.writeFileSync(file, modified, "utf8");
    }
    filesChanged++;
    totalReplaced += localCount;
    console.log(
      `${dryRun ? "[dry-run] " : ""}✓ ${path.relative(absoluteTarget, file)}  (${localCount} replacements)`,
    );
  }
}

console.log("");
console.log(
  `${dryRun ? "[dry-run] " : ""}Summary: ${totalReplaced} replacements across ${filesChanged} file(s).`,
);

console.log("");
console.log("⚠ Not replaced (need manual review):");
console.log("  - writeEntry with extra args (status/author/created/updated)");
console.log("  - multi-line writeEntry calls");
console.log(
  "  - writeIndex calls (signature changed: now needs collabDir first arg)",
);
