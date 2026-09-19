import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { resolveEnforced } from "@/cli/lib/enforcedTargets";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { findUnreachable } from "@/domain/entry/reachability";
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
      candidates: { type: "boolean", default: false },
      "grace-days": { type: "string" },
    },
    allowPositionals: true,
    strict: false,
  });

  // `--candidates`：只报告，不写盘。这是 pruning-policy 那条
  // "标记-清除"的可执行产物（此前从未实现过，见 meta/known-gaps）。
  if (values.candidates === true) {
    reportCandidates(values["grace-days"]);
    return;
  }

  const id = positionals[0];
  if (!id) {
    throw new Error(
      "missing <id> argument. Usage: collab retire <id> --dormant --reason \"...\"\n" +
        "  或：collab retire <id> --enforced <测试/工具路径> --confirm --reason \"...\"\n" +
        "  或：collab retire --candidates（只报告孤岛条目，不写盘）",
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

  // 形态 + **存在性**检查。
  //
  // 为什么必须要：`enforced` 填错时，条目会**静默地**退出路由索引，
  // 而它声称的固化根本不存在 —— 那条知识就真丢了。
  // 2026-09-18 实测：手工把路径写成 `com/evolutionary/DomainFrameworkFreeTest.java`
  // （真实位置在 `architecture/` 子目录），validate 报 0 issue。
  //
  // 存在性检查放在这里而不是 validate：validate 必须**密闭**（不跨仓读文件系统，
  // 否则换个工作区就红）。CLI 有 IO，在**写入那一刻**查最有效。
  if (enforcedPath !== undefined) {
    assertEnforcedTargetExists(enforcedPath);
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

/**
 * `--candidates`：列出**孤岛**条目（不与任何根文档连通）。
 *
 * @remarks
 * **只报告，不写盘，也不下结论。** 孤岛 ≠ 该删 ——
 * 新写的条目还没轮到被引用，也是孤岛。所以：
 *
 * - 默认宽限 30 天（`created` 太新的不算），可用 `--grace-days` 调；
 * - 输出**理由**（入度/出度）而不是"建议删除"；
 * - 真正的退役仍要人逐条给 `--reason`（pruning-policy §三）。
 *
 * 判据与边界见 `domain/entry/reachability.ts` 的注释。
 */
function reportCandidates(graceRaw: string | boolean | undefined): void {
  const parsed = typeof graceRaw === "string" ? Number(graceRaw) : Number.NaN;
  const graceDays = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_GRACE_DAYS;

  const { collabDir } = findCollabRoot(process.cwd());
  const workspace = new FileWorkspaceLoader(collabDir).load();
  // **全部**条目都进图 —— 已毕业的也要在（它们是活的引用目标，
  // 排掉会造成大量假阳性，见 reachability.ts 的注释）。
  // 候选过滤（`isRouted`）在 `findUnreachable` 内部做。
  const entries = workspace.entries
    .filter((l) => l.entry !== null)
    .map((l) => l.entry)
    .filter((e) => e !== null);

  const candidates = findUnreachable(entries, workspace.rootDocs ?? new Map(), {
    now: localToday(),
    graceDays,
  });

  if (candidates.length === 0) {
    console.log(`✔ 没有孤岛条目（宽限 ${graceDays} 天）。`);
    return;
  }

  console.log(`孤岛候选 ${candidates.length} 条（宽限 ${graceDays} 天，按孤立程度排序）：`);
  console.log("");
  for (const c of candidates) {
    console.log(`  ${c.id}`);
    console.log(`    ${c.path}`);
    console.log(`    入度 ${c.inbound} · 出度 ${c.outbound}`);
  }
  console.log("");
  console.log("⚠ **孤岛 ≠ 该删。** 新条目还没轮到被引用时也是孤岛。");
  console.log("  逐条判断后，用 `collab retire <id> --dormant --reason \"<分类>: <证据>\"`。");
}

/** 默认宽限：30 天。见 reportCandidates 的注释。 */
const DEFAULT_GRACE_DAYS = 30;

/** 本地时区的今日日期（YYYY-MM-DD）。 */
function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(DATE_PART_WIDTH, "0");
  const day = String(d.getDate()).padStart(DATE_PART_WIDTH, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `YYYY-MM-DD` 各段的补零宽度。 */
const DATE_PART_WIDTH = 2;

/**
 * 校验 `--enforced` 的目标**真实存在**。
 *
 * @remarks
 * 仓根解析与三态判定都在 `cli/lib/enforcedTargets.ts` —— **与
 * `collab validate --check-enforced` 共用同一份**。
 * 写两份的后果是"写入时查的是 A、复查时查的是 B"，而那种漂移最难发现。
 */
function assertEnforcedTargetExists(value: string): void {
  const r = resolveEnforced(value);
  if (r.kind === "unresolvable") {
    if (r.reason.includes("形态")) {
      throw new Error(
        `--enforced 必须是 "<repo>:<path>" 形态，收到：${value}\n` +
          `  例：--enforced "evolutionary:backend/src/test/java/.../SomeTest.java"`,
      );
    }
    console.log(`⚠ ${r.reason} —— 跳过存在性检查（validate 仍会查形态）。`);
    return;
  }
  if (r.exists) return;

  throw new Error(
    `--enforced 指向的产物不存在：\n` +
      `  ${value}\n` +
      `  （实际查找：${r.abs}）\n` +
      `\n` +
      `  这一条必须拦住：enforced 填错的后果是条目**静默地**退出路由索引，\n` +
      `  而它声称的固化根本不存在 —— 那条知识就真丢了。`,
  );
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
