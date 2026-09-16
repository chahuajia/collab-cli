import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { idIsAlias } from "@/domain/validation/rules/idIsAlias";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import type { RuleContext } from "@/domain/validation/Rule";

/** `idIsAlias` 不看 context —— 传空壳即可。 */
const NO_CONTEXT: RuleContext = {
  allEntries: [],
  allEntryIds: new Set(),
  indexFiles: new Map(),
  allMarkdownPaths: new Set(),
};

/**
 * `collab fix [--dry-run]`
 *
 * 补齐**机械字段**，**只补不删**。
 *
 * @remarks
 * 决策落地：
 * - **只补不删**：补是机械事实（id 必须登记为 alias），删是判断 —— 判断归人。
 * - 补不了的就**报错**，不猜、不覆盖、不重排。
 * - `--dry-run` 只打印计划。
 *
 * 判据复用领域规则 `idIsAlias`，**不在这里重写一份** ——
 * 否则又会出现"校验说缺、修复说不缺"的两份真相。
 */
export async function cmdFix(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { "dry-run": { type: "boolean", default: false } },
    strict: false,
  });
  const dryRun = values["dry-run"] === true;

  const { collabDir } = findCollabRoot(process.cwd());
  const workspace = new FileWorkspaceLoader(collabDir).load();

  const planned: string[] = [];
  const unfixable: string[] = [];

  for (const loaded of workspace.entries) {
    if (loaded.entry === null) continue;
    if (idIsAlias(loaded.entry, NO_CONTEXT).length === 0) continue;

    const id = loaded.entry.frontmatter.id;
    const abs = path.join(collabDir, loaded.path);
    const next = addIdAlias(fs.readFileSync(abs, "utf8"), id);

    if (next === null) {
      unfixable.push(loaded.path);
      continue;
    }
    if (!dryRun) fs.writeFileSync(abs, next, "utf8");
    planned.push(loaded.path);
  }

  for (const p of planned) {
    console.log(`${dryRun ? "(dry-run) would add" : "✔ added"} aliases → ${p}`);
  }
  for (const p of unfixable) {
    console.log(`✖ cannot fix automatically (frontmatter not found): ${p}`);
  }

  console.log("");
  console.log(
    dryRun
      ? `(dry-run) ${planned.length} file(s) would change; ${unfixable.length} need manual attention.`
      : `✔ fixed ${planned.length} file(s); ${unfixable.length} need manual attention.`,
  );

  if (unfixable.length > 0 && !dryRun) process.exit(1);
}

/**
 * 在 frontmatter 里补上 `id` 这条 alias。
 *
 * @remarks
 * **只增不删、不改写已有内容** —— 三种形态分别处理：
 * 1. 没有 `aliases:` → 在收尾 `---` 前插入块状写法；
 * 2. 块状 `aliases:` → 在最后一条别名后追加 `  - <id>`；
 * 3. 行内 `aliases: [a, b]` → 变成 `[a, b, <id>]`。
 *
 * @returns 新内容；找不到 frontmatter 时返回 null（**不猜**）
 */
function addIdAlias(raw: string, id: string): string | null {
  const lines = raw.split("\n");
  if (lines[0] !== "---") return null;

  const end = lines.indexOf("---", 1);
  if (end === -1) return null;

  const fm = lines.slice(1, end);

  // 3. 行内写法
  const inlineIndex = fm.findIndex((l) => /^aliases:\s*\[.*\]\s*$/.test(l));
  if (inlineIndex !== -1) {
    const line = fm[inlineIndex];
    if (line === undefined) return null;
    const closed = line.replace(/\]\s*$/, `, ${id}]`);
    fm[inlineIndex] = closed;
    return rebuild(lines, end, fm);
  }

  // 2. 块状写法：在最后一条 `  - x` 后追加
  const blockIndex = fm.findIndex((l) => /^aliases:\s*$/.test(l));
  if (blockIndex !== -1) {
    let insertAt = blockIndex + 1;
    while (insertAt < fm.length && /^\s*-\s/.test(fm[insertAt] ?? "")) insertAt++;
    fm.splice(insertAt, 0, `  - ${id}`);
    return rebuild(lines, end, fm);
  }

  // 1. 没有 aliases：插到收尾 --- 之前
  fm.push("aliases:", `  - ${id}`);
  return rebuild(lines, end, fm);
}

/** 拼回原文（frontmatter 之外的每一行原样保留）。 */
function rebuild(
  lines: readonly string[],
  end: number,
  fm: readonly string[],
): string {
  return [...lines.slice(0, 1), ...fm, ...lines.slice(end)].join("\n");
}
