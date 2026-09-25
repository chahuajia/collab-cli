// scripts/rename-entry-kind.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "../src");

/**
 * 按顺序替换。
 * 用 ASCII 边界 (?<![A-Za-z0-9_]) 和 (?![A-Za-z0-9_]) 替代 \b，
 * 避免 Unicode 词边界问题——中文字符旁的标识符也能正确匹配。
 */
const REPLACEMENTS = [
  // 长的先替换（虽然 lookaround 已保证不会误匹配，但保持顺序更清晰）
  {
    from: /(?<![A-Za-z0-9_])runCliSuccess\((?![A-Za-z0-9_])/g,
    to: "toSucceed\(",
  },
];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

let changed = 0;
let totalReplacements = 0;

for (const file of walk(SRC)) {
  // Node 的 'utf8' 读取会正确剥离 BOM（如果存在）
  const original = fs.readFileSync(file, "utf8");
  let modified = original;
  let localCount = 0;

  for (const { from, to } of REPLACEMENTS) {
    const matches = modified.match(from);
    if (matches) localCount += matches.length;
    modified = modified.replace(from, to);
  }

  if (modified !== original) {
    // writeFileSync 的 'utf8' 不写 BOM，不转换换行
    fs.writeFileSync(file, modified, "utf8");
    console.log(`✓ ${path.relative(SRC, file)}  (${localCount} replacements)`);
    changed++;
    totalReplacements += localCount;
  }
}

console.log(
  `\n${changed} file(s) updated, ${totalReplacements} replacements total.`,
);
