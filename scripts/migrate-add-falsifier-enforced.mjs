// scripts/migrate-add-falsifier-enforced.mjs
//
// 基座变更迁移：给条目补 `enforced: null`。
//
// 背景（见 meta/decision-records/ADR-0011）：
//   知识库此前只有一种"条目退场"的方式 —— 被冷落（0 引用、0 拦截）。
//   这个死法同时命中"已经成功的"和"本来就没用的"，所以修剪没有可用判据。
//   新增字段把退场变成可判定的：
//     enforced   毕业标记：非空 = 内容已被测试/工具固化 → 退出路由索引。
//
// 用法：
//   node scripts/migrate-add-falsifier-enforced.mjs <collab-dir> [--dry-run]
//
// 幂等：已有 `enforced` 的条目跳过。可重跑、可审计（见 skills/S30-批处理脚本骨架）。
//
// **为什么只迁移 enforced，不迁移 falsifier：**
//   - `enforced` 在 schema 里是 required-nullable（对齐 `supersedes`），
//     已有条目必须显式补 `null` 才能通过解析。
//   - `falsifier` 是 optional —— 缺失是合法状态，无位可补。
//     它由 `collab new` 在创建时发空位、由人在入库时填写（见 W5）。
//     若在这里写 `falsifier: ""`，会制造"看起来填了、其实没填"的假象 ——
//     而假象正是这个库一直在删的东西（假绿灯、编造的数字、与事实相反的规则）。
//
//   **本脚本不编内容。** enforced 一律写 null：毕业是判断，判断归人。
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
  "integrations",
  "meta/decision-records",
];

function isEntryFile(rel) {
  const norm = rel.replace(/\\/g, "/");
  return ENTRY_DIRS.some((d) => norm.startsWith(d + "/"));
}

/** 找到 frontmatter 的边界：`---` ... `---`。保留原换行风格。 */
function parseFrontmatter(content) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
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
  return { lines, endIndex: end, eol };
}

function hasField(lines, endIndex, key) {
  const re = new RegExp(`^${key}\\s*:`);
  for (let i = 1; i < endIndex; i++) {
    if (re.test(lines[i])) return true;
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

  if (hasField(parsed.lines, parsed.endIndex, "enforced")) {
    skipped++;
    continue;
  }

  // 插在收尾 `---` 之前 —— 只增不改，保住已有行的位置（与 fix.ts 的 addIdAlias 同策略）。
  const newLines = [
    ...parsed.lines.slice(0, parsed.endIndex),
    "enforced: null",
    ...parsed.lines.slice(parsed.endIndex),
  ];

  if (!dryRun) fs.writeFileSync(file, newLines.join(parsed.eol), "utf8");
  console.log(`${dryRun ? "[dry-run] " : "✓ "}${rel}  → enforced: null`);
  updated++;
}

console.log("");
console.log(
  `${dryRun ? "[dry-run] " : ""}Summary: ${updated} updated, ${skipped} skipped, ${warned} warned.`,
);
