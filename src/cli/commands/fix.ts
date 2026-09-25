import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { idIsAlias } from "@/domain/validation/rules/idIsAlias";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import { findCollabRoot } from "@/infrastructure/fs/findCollabRoot";
import type { RuleContext } from "@/domain/validation/Rule";

/** `idIsAlias` 不看 context —— 传空壳即可。 */
const NO_CONTEXT: RuleContext = {
  allEntries: [],
  allEntryIds: new Set(),
  indexFiles: new Map(),
  allMarkdownPaths: new Set(),
};

/**
 * U+FEFF（BOM）的码位。
 *
 * @remarks
 * `parseDocument` 已经容忍它（读文件时剥掉）—— 这里必须**同样**容忍，
 * 否则会出现"validate 看得见、fix 修不了"。剥掉只用于定位；写回时**原样保留**。
 */
const BOM = 0xfeff;

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

  for (const loaded of workspace.entries) {
    if (loaded.entry === null) continue;
    if (idIsAlias(loaded.entry, NO_CONTEXT).length === 0) continue;

    const id = loaded.entry.frontmatter.id;
    const abs = path.join(collabDir, loaded.path);
    const next = addIdAlias(fs.readFileSync(abs, "utf8"), id);

    // 到这里 next 不可能是 null：能进 entries 就说明 frontmatter 解析成功过，
    // 而 addIdAlias 只在"没有 frontmatter"时返回 null。
    // 保留这层判断是为了将来放宽 entries 的来源（如扫描未解析文件）时不会静默出错。
    if (next === null) throw new Error(`cannot fix ${loaded.path}: frontmatter not found`);

    if (!dryRun) fs.writeFileSync(abs, next, "utf8");
    planned.push(loaded.path);
  }

  for (const p of planned) {
    console.log(`${dryRun ? "(dry-run) would add" : "✔ added"} aliases → ${p}`);
  }

  console.log("");
  console.log(
    dryRun
      ? `(dry-run) ${planned.length} file(s) would change.`
      : `✔ fixed ${planned.length} file(s).`,
  );
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
 * @returns 新内容；找不到 frontmatter 时返回 null（**不猜** —— 调用方据此报错）
 */
function addIdAlias(raw: string, id: string): string | null {
  // 与 `parseDocument` **同判据**：剥掉 BOM、按 CRLF/LF 切分、原样写回。
  //
  // 2026-09-26 实测的偏差：这里曾只做 `raw.split("\n")` 且直接比 `lines[0] !== "---"`，
  // 于是 **带 BOM 的文件**（Windows 编辑器/脚本的默认产物）会出现
  // "validate 看得见、fix 修不了"（`cannot fix ...: frontmatter not found`）；
  // 而按 `\n` 切、按 `\n` 拼还会**静默把 CRLF 改成 LF**。两份定位逻辑必然漂移 ——
  // 这里把两者的语义对齐，并由 `fix.test.ts` 的 BOM / CRLF 两条用例钉住。
  const bom = raw.charCodeAt(0) === BOM;
  const text = bom ? raw.slice(1) : raw;
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  /** 写回时把 BOM 放回去（**只补不删**：BOM 不是我们要改的东西）。 */
  const finish = (content: string): string => (bom ? `\uFEFF${content}` : content);
  if (lines[0] !== "---") return null;

  const end = lines.indexOf("---", 1);
  if (end === -1) return null;

  const fm = lines.slice(1, end);

  // 3. 行内写法
  const inlineIndex = fm.findIndex((l) => /^aliases:\s*\[.*\]\s*$/.test(l));
  if (inlineIndex !== -1) {
    const line = fm[inlineIndex];
    if (line === undefined) return null;
    // 空数组 `[]` 不能盲目拼 `, x`：那会写出**非法 YAML**（`[, x]`）。
    // 2026-09-26 实测：`aliases: []` 经 `fix` 变成 `aliases: [, S30]`，
    // 于是"补一个小字段"的动作把一个合法条目改坏了（validate 报 INVALID_YAML）。
    fm[inlineIndex] = /\[\s*\]/.test(line)
      ? line.replace(/\[\s*\]/, `[${id}]`)
      : line.replace(/\]\s*$/, `, ${id}]`);
    return finish(rebuild(lines, end, fm, newline));
  }

  // 2. 块状写法：在最后一条 `  - x` 后追加
  const blockIndex = fm.findIndex((l) => /^aliases:\s*$/.test(l));
  if (blockIndex !== -1) {
    let insertAt = blockIndex + 1;
    while (insertAt < fm.length && /^\s*-\s/.test(fm[insertAt] ?? "")) insertAt++;
    fm.splice(insertAt, 0, `  - ${id}`);
    return finish(rebuild(lines, end, fm, newline));
  }

  // 1. 没有 aliases：插到收尾 --- 之前
  fm.push("aliases:", `  - ${id}`);
  return finish(rebuild(lines, end, fm, newline));
}

/** 拼回原文（frontmatter 之外的每一行原样保留；换行符沿用原文件）。 */
function rebuild(
  lines: readonly string[],
  end: number,
  fm: readonly string[],
  newline: string,
): string {
  return [...lines.slice(0, 1), ...fm, ...lines.slice(end)].join(newline);
}
