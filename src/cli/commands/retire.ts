import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { isRouted } from "@/domain/entry/routed";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import type { LoadedEntry } from "@/domain/entry/WorkspaceLoader";

/**
 * `collab retire <id>` —— 让一条条目**退出路由索引**。
 *
 * @remarks
 * 这是知识库此前缺失的那个**代谢出口**。在此之前，条目只有一种死法：被冷落
 * （0 引用、0 拦截）—— 而这个死法同时命中"已经成功的"和"本来就没用的"，
 * 于是修剪没有可用的判据（见 `meta/pruning-policy` 的"判据"一节）。
 *
 * 两条退役路径，含义不同：
 *
 * | 路径 | 含义 | 对应判据 |
 * | :--- | :--- | :--- |
 * | `--dormant` | **被冷落**：内容过时/重复/表达差/未成熟 | `pruning-policy` 四分类 |
 * | `--enforced <path>` | **已毕业**：内容已被测试/工具固化 | "条目 → 测试"输送带 |
 *
 * **退出索引 ≠ 删除。** 文件仍在、仍被 validate 校验、仍可被链接 ——
 * 只是不再进 `catalog.json`，不再占路由成本。git 保留基因（见 `pruning-policy`）。
 *
 * 为什么 `--enforced` 要 `--confirm`：毕业意味着"从此不必再被读"，
 * 而判断"某个测试真的固化了这条内容"比判断"这条过时了"更容易错 ——
 * 更高的不可逆性配更重的确认门。
 */
export async function cmdRetire(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      dormant: { type: "boolean", default: false },
      enforced: { type: "string" },
      reason: { type: "string" },
      confirm: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const id = positionals[0];
  if (!id) {
    throw new Error(
      "missing <id> argument. Usage: collab retire <id> --dormant --reason \"...\"\n" +
        "  或：collab retire <id> --enforced <测试/工具路径> --confirm --reason \"...\"",
    );
  }

  // parseArgs 把 string 选项的类型放宽成 `string | boolean` —— 这里收窄。
  const enforcedRaw = values.enforced;
  const enforcedPath = typeof enforcedRaw === "string" ? enforcedRaw : undefined;
  const wantDormant = values.dormant === true;

  if (!wantDormant && enforcedPath === undefined) {
    throw new Error(
      "要指定退役路径：--dormant（被冷落）或 --enforced <path>（已毕业）。二者可同时给。",
    );
  }

  const reason = values.reason;
  if (typeof reason !== "string" || reason.trim().length === 0) {
    // pruning-policy §三：每个修剪决策要写一句"为什么"。
    // 不写理由的退役会让下一个人无法判断"是不是他删错了"。
    throw new Error(
      '必须给 --reason "<过时|重复|表达差|未成熟>: <具体证据>"。\n' +
        "  判据是四分类之一 + 证据；写不出证据的，按 pruning-policy 属于\"未成熟\"（降级，不是删除）。",
    );
  }

  // 毕业是更高的不可逆性 —— 单独一道确认门。
  const needsConfirm = enforcedPath !== undefined;
  if (needsConfirm && values.confirm !== true) {
    throw new Error(
      `把这条标为"已毕业"意味着**从此不必再被读** —— 请确认 ${enforcedPath} 真的固化了它的内容。\n` +
        "  确认无误请加 --confirm。",
    );
  }

  const dryRun = values["dry-run"] === true;
  const { collabDir } = findCollabRoot(process.cwd());
  const workspace = new FileWorkspaceLoader(collabDir).load();

  const target = findById(workspace.entries, id);
  if (target === null) {
    throw new Error(`找不到 id 为 ${id} 的条目。`);
  }
  if (target.entry === null) {
    throw new Error(`${target.path} 解析失败，无法退役 —— 先修好它。`);
  }

  const fm = target.entry.frontmatter;
  const wasRouted = isRouted(fm);
  const abs = path.join(collabDir, target.path);
  const raw = fs.readFileSync(abs, "utf8");

  let next = raw;
  if (wantDormant) next = setScalarField(next, "status", "dormant");
  if (enforcedPath !== undefined) {
    next = setScalarField(next, "enforced", enforcedPath);
  }
  if (next === raw) {
    throw new Error(
      `没有可写的变化（${id} 已经是目标状态？当前 status=${fm.status}, enforced=${fm.enforced ?? "null"}）。`,
    );
  }

  // 两条路径都通向同一件事：退出路由索引。区别只在**为什么**。
  const willBeRouted = false;

  if (dryRun) {
    console.log(`(dry-run) would retire ${id}`);
    console.log(`  path:     ${target.path}`);
    if (wantDormant) console.log(`  status:   ${fm.status} → dormant`);
    if (enforcedPath !== undefined) {
      console.log(`  enforced: ${fm.enforced ?? "null"} → ${enforcedPath}`);
    }
    console.log(`  routed:   ${wasRouted} → ${willBeRouted}`);
    console.log("");
    console.log("(dry-run) nothing was written.");
    return;
  }

  fs.writeFileSync(abs, next, "utf8");

  console.log(`✔ retired ${id} — ${target.path}`);
  if (wantDormant) console.log(`  status   → dormant`);
  if (enforcedPath !== undefined) console.log(`  enforced → ${enforcedPath}`);
  console.log(`  路由索引：${wasRouted ? "在" : "不在"} → ${willBeRouted ? "在" : "不在"}`);
  console.log("");
  // pruning-policy §三要求把判断依据记进 evolution-log —— 这里只**打印**待登记的行：
  // 版本号递增是一次演化决策，不该由 CLI 代拟（见 policy-without-mechanism 的反面）。
  console.log("请把下面这行登记进 collaboration/meta/evolution-log.md：");
  console.log("");
  console.log(`  条目 ${id} 退役：${reason}`);
  console.log("");
  console.log("下一步：collab catalog（刷新路由表）→ collab validate（应归零）");
}

/** 按 id 找条目（id 是不变快照，见 ADR-0009）。 */
function findById(entries: readonly LoadedEntry[], id: string): LoadedEntry | null {
  for (const loaded of entries) {
    if (loaded.entry !== null && loaded.entry.frontmatter.id === id) return loaded;
  }
  return null;
}

/**
 * 改写 frontmatter 里某个**标量字段**的值。
 *
 * @remarks
 * 行手术而非 YAML 往返：往返会重排键、丢注释、把整块 frontmatter 重排 ——
 * 制造噪音 diff，而 retire 的 diff 应该只有一行。
 *
 * 三种形态：
 * 1. 字段已存在（`key: x` 或 `key: "x"`）→ 只换值，保住键的位置。
 * 2. 字段不存在但模板留了空位（`key:`）→ 补值。
 * 3. 都没有 → 在收尾 `---` 前插入。
 *
 * 找不到 frontmatter 时返回原内容（调用方比对后可报错）。
 */
function setScalarField(raw: string, key: string, value: string): string {
  // 行尾归一化：知识库在 Windows 上是 CRLF（git core.autocrlf），
  // 不归一化则每行都带 `\r`，`lines[0] !== "---"` 永远不成立 ——
  // 表现为"命令没报错但什么也没改"（本项目把这种失效叫假绿灯）。
  // 写回时按原文件的风格还原，避免制造整文件的行尾 diff。
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") return raw;
  const end = lines.indexOf("---", 1);
  if (end === -1) return raw;

  const fm = lines.slice(1, end);
  const keyRe = new RegExp(`^${key}:\\s*(.*)$`);

  for (let i = 0; i < fm.length; i++) {
    const line = fm[i];
    if (line === undefined || !keyRe.test(line)) continue;
    // 空位（`enforced:`）或已有值 —— 两种情况都是换值，保住键的位置。
    fm[i] = `${key}: ${value}`;
    return [...lines.slice(0, 1), ...fm, ...lines.slice(end)].join(eol);
  }

  fm.push(`${key}: ${value}`);
  return [...lines.slice(0, 1), ...fm, ...lines.slice(end)].join(eol);
}
