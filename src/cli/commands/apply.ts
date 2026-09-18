import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { ApplyUseCase } from "@/application/ApplyUseCase";
import { ValidateUseCase, contentRules } from "@/application/ValidateUseCase";
import { cmdCatalog } from "@/cli/commands/catalog";
import { cmdCommit } from "@/cli/commands/commit";
import { cmdIndex } from "@/cli/commands/index";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { ApplyIssues } from "@/domain/apply/ApplyIssues";
import { BundleActionValues } from "@/domain/apply/BundleAction";
import { sha256Hex } from "@/infrastructure/crypto/sha256";
import { FileApplyWorkspace } from "@/infrastructure/fs/FileApplyWorkspace";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import { parseBundle } from "@/infrastructure/parsing/BundleParser";
import { Err } from "@/shared/Result";
import type { ApplyPlan } from "@/domain/apply/ApplyPlan";
import type { BundleAction } from "@/domain/apply/BundleAction";
import type { BundleInput } from "@/domain/apply/BundleInput";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

/** 供 `--json` 消费的状态值。 */
const ApplyStatusValues = {
  Applied: "applied",
  DryRun: "dry-run",
  Rejected: "rejected",
  ValidateFailed: "validate-failed",
} as const;

type ApplyStatus = (typeof ApplyStatusValues)[keyof typeof ApplyStatusValues];

const JSON_INDENT = 2;

/**
 * `collab apply <bundle.json> [--dry-run] [--index] [--commit] [--json]`
 *
 * 把 bundle 落盘到知识库，并且**要么全部成功，要么一个都不写**。
 *
 * @remarks
 * 决策落地（spec §行为规格 / §反面）：
 * - 预检全有或全无：任何一条不过就一个字节都不写。
 * - 只吃 JSON —— 文本协议（`===== FILE:`）由未来的 `collab parse` 负责。
 * - 复用 `validate` / `index` / `commit` 的既有逻辑，不重写规则。
 * - 落盘门禁用**内容规则**（`contentRules`）—— 刚落的条目还没进 `_index.md`，
 *   索引规则只能等 `--index` 刷新后由 `--commit` 的全量 validate 把关。
 * - validate 失败**不回滚**：文件已在盘上，git 可恢复；回滚反而更难审。
 * - 默认不 commit：`--commit` 由人显式给出。
 *
 * 退出码：
 * - 0：落盘成功且 validate 通过
 * - 1：预检拒绝（未写盘）或落盘后 validate 失败（已写盘，保留）
 */
export async function cmdApply(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      "dry-run": { type: "boolean", default: false },
      index: { type: "boolean", default: false },
      commit: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  const bundleArg = positionals[0];
  if (bundleArg === undefined || bundleArg.length === 0) {
    throw new Error(
      "missing <bundle.json> argument. " +
        "Usage: collab apply <bundle.json> [--dry-run] [--index] [--commit] [--json]",
    );
  }

  const asJson = values.json === true;
  const isDryRun = values["dry-run"] === true;

  const { collabDir } = findCollabRoot(process.cwd());

  // ── 1. 边界：读文件 + 解析 JSON + 形状校验 ──
  const input = readBundle(bundleArg);
  if (!input.ok) reject(input.error, asJson);

  // ── 2. 计划：预检（路径 / 内容 / 哈希）+ 冲突检查。此处不动任何文件 ──
  const useCase = new ApplyUseCase(
    new FileApplyWorkspace(collabDir),
    sha256Hex,
  );
  const planned = useCase.plan(input.value);
  if (!planned.ok) reject(planned.error, asJson);
  const plan = planned.value;

  // ── 3. dry-run：打印计划即返回 ──
  if (isDryRun) {
    emit(ApplyStatusValues.DryRun, plan, [], asJson);
    return;
  }

  // ── 4. 落盘 ──
  useCase.execute(plan);
  if (!asJson) {
    emit(ApplyStatusValues.Applied, plan, [], false);
  }

  // ── 4b. 刷新派生物：谁让生成物过期，谁负责刷新它 ──
  // 不刷新的话，下一次 `validate` 必然报 CATALOG_STALE，`apply --commit` 也会卡住。
  if (!asJson) await cmdCatalog([]);

  // ── 5. 门禁：复用现有 validate（内容规则，不含索引规则） ──
  const validation = new ValidateUseCase(
    new FileWorkspaceLoader(collabDir),
    contentRules,
  ).execute();

  if (validation.report.hasBlocking()) {
    const errors = validation.report.errors();
    if (asJson) {
      emitJson(ApplyStatusValues.ValidateFailed, plan, errors);
    } else {
      console.log("");
      console.log(
        `✖ validate failed: ${errors.length} error(s). Files are kept on disk — fix them and re-run \`collab validate\`.`,
      );
      for (const issue of errors) {
        console.log(indent(issue.format()));
      }
    }
    process.exit(1);
  }

  if (asJson) {
    emitJson(ApplyStatusValues.Applied, plan, []);
  } else {
    console.log(
      `✔ validate passed (${validation.entries.length} entries, 0 issues)`,
    );
  }

  // ── 6. 可选：刷新索引（复用 `collab index`） ──
  if (values.index === true) {
    await cmdIndex([]);
  }

  // ── 7. 可选：提交（复用 `collab commit`；默认关闭） ──
  if (values.commit === true) {
    await cmdCommit([
      "-m",
      `chore(collab): apply ${path.basename(bundleArg)}`,
    ]);
  }
}

// ─────────────────────────────────────────────
// 边界：读 + 解析
// ─────────────────────────────────────────────

/**
 * 读取并解析 bundle 文件。
 *
 * @remarks
 * 三种失败模式在这里被区分开（都不写盘）：
 * 文件不存在、不是合法 JSON、形状不符（交给 `parseBundle`）。
 */
function readBundle(
  bundlePath: string,
): Result<BundleInput, readonly Issue[]> {
  const abs = path.resolve(process.cwd(), bundlePath);

  if (!fs.existsSync(abs)) {
    return Err([ApplyIssues.invalid(`bundle file not found: ${bundlePath}`)]);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return Err([ApplyIssues.invalid(`bundle is not valid JSON: ${reason}`)]);
  }

  return parseBundle(raw);
}

// ─────────────────────────────────────────────
// 输出
// ─────────────────────────────────────────────

/**
 * 预检拒绝：报告全部 Issue 并以非 0 退出。
 *
 * @remarks
 * 提示语里明确写"no files were written" —— 这是用户最关心的事，
 * 也是这个命令与"边校验边写"的分水岭。
 */
function reject(issues: readonly Issue[], asJson: boolean): never {
  if (asJson) {
    emitJson(ApplyStatusValues.Rejected, null, issues);
  } else {
    console.log(
      `✖ apply rejected: ${issues.length} issue(s) — no files were written.`,
    );
    for (const issue of issues) {
      console.log(indent(issue.format()));
    }
  }
  process.exit(1);
}

/**
 * 输出计划或结果（人类可读 / JSON 二选一）。
 */
function emit(
  status: ApplyStatus,
  plan: ApplyPlan,
  issues: readonly Issue[],
  asJson: boolean,
): void {
  if (asJson) {
    emitJson(status, plan, issues);
    return;
  }

  const create = plan.countOf(BundleActionValues.Create);
  const replace = plan.countOf(BundleActionValues.Replace);
  const remove = plan.countOf(BundleActionValues.Delete);
  const summary = `${create} create, ${replace} replace, ${remove} delete`;

  if (status === ApplyStatusValues.DryRun) {
    console.log(`✔ plan: ${plan.count()} file(s) — ${summary}`);
  } else {
    console.log(`✔ applied ${plan.count()} file(s) — ${summary}`);
  }

  for (const operation of plan.operations) {
    console.log(`  ${markerFor(operation.kind)} ${operation.path}`);
  }

  if (status === ApplyStatusValues.DryRun) {
    console.log("");
    console.log("(dry-run) no files were written.");
  }
}

/**
 * 输出 JSON。
 *
 * @remarks
 * 只输出"发生了什么"，不输出颜色/文案 —— 供脚本与插件消费。
 */
function emitJson(
  status: ApplyStatus,
  plan: ApplyPlan | null,
  issues: readonly Issue[],
): void {
  const payload = {
    status,
    summary: {
      create: plan?.countOf(BundleActionValues.Create) ?? 0,
      replace: plan?.countOf(BundleActionValues.Replace) ?? 0,
      delete: plan?.countOf(BundleActionValues.Delete) ?? 0,
    },
    operations: (plan?.operations ?? []).map((operation) => ({
      action: operation.kind,
      path: operation.path,
    })),
    issues: issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path ?? null,
    })),
  };

  process.stdout.write(JSON.stringify(payload, null, JSON_INDENT) + "\n");
}

/** 操作类型 → 终端的单字符标记。 */
function markerFor(kind: BundleAction): string {
  if (kind === BundleActionValues.Create) return "+";
  if (kind === BundleActionValues.Replace) return "~";
  return "-";
}

/** 给多行文本的每一行加前缀缩进。 */
function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
