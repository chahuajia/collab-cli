// src/application/CreateEntryUseCase.ts
import { computeNextId } from "@/application/computeNextId";
import { extractIdsForKind } from "@/application/extractIdsForKind";
import { agreementQuotaExceeded } from "@/domain/entry/agreementQuota";
import { EntryId } from "@/domain/entry/EntryId";
import { isRouted } from "@/domain/entry/routed";
import { EntryKindDir, EntryKindValues } from "@/domain/entry/types";
import { buildTemplate } from "@/infrastructure/formatting/entryTemplate";
import type { EntryKind } from "@/domain/entry/types";
import type { WorkspaceLoader } from "@/domain/entry/WorkspaceLoader";

/**
 * 新条目的**用例**：从"用户想要一条 X"到"该写哪个文件、写什么内容"。
 *
 * @remarks
 * 抽出来的理由（2026-09-26）：这一段原先全在 `cli/commands/new.ts` 里 ——
 * 参数解析、配额判断、id 生成、git 身份、模板、路径拼接混在一处，
 * 于是**业务判断既不能被单测钉住，也不属于任何一层**。
 *
 * 现在这一层只做决策，I/O 通过注入：
 * - 读现状 → `WorkspaceLoader`（domain 声明的端口，infrastructure 实现）
 * - 取作者 → `readAuthor`（函数注入；`new` 走 git，测试可给固定值）
 * - 写盘 / 打印 → 留在 CLI（它是驱动适配器，天然该做 I/O）
 *
 * 失败一律 `throw Error`（沿用原行为：错就是错，不做"部分成功"）。
 */
export interface CreateEntryRequest {
  readonly type: EntryKind;
  /** 用户显式给的 id；`null` = 自动生成（`type` 的下一个号） */
  readonly id: string | null;
  /** `--author`；`null` = 问 `readAuthor` */
  readonly author: string | null;
}

export interface CreateEntryDeps {
  readonly workspace: WorkspaceLoader;
  /** 作者来源（端口）。返回 `undefined` = 拿不到 → 用例拒绝生成。 */
  readonly readAuthor: () => string | undefined;
}

/** 计划：相对知识库根的路径 + 完整内容。**没有副作用**。 */
export interface CreateEntryPlan {
  readonly relPath: string;
  readonly content: string;
}

export function planCreateEntry(
  request: CreateEntryRequest,
  deps: CreateEntryDeps,
): CreateEntryPlan {
  const { type } = request;

  assertAgreementQuota(type, deps);

  const id = resolveId(request, deps);
  const relPath = `${EntryKindDir[type]}/${id}.md`;
  const author = resolveAuthor(request, deps);

  return { relPath, content: buildTemplate({ type, id, author }) };
}

/**
 * 约定层的代谢门：加之前必须先减。
 *
 * @remarks
 * 只数**占路由索引位**的条目 —— 判据与 `buildCatalog` 同源（`isRouted`）。
 * 曾用 `extractIdsForKind().length`（不过滤状态）把已退役的也算进来，
 * 于是"归档腾位置"成了空头支票：照做也解不开配额。
 */
function assertAgreementQuota(type: EntryKind, deps: CreateEntryDeps): void {
  if (type !== EntryKindValues.Agreement) return;
  const occupying = deps.workspace
    .load()
    .entries.filter(
      (loaded) =>
        loaded.entry !== null &&
        loaded.entry.frontmatter.type === type &&
        isRouted(loaded.entry.frontmatter),
    ).length;
  const message = agreementQuotaExceeded(occupying);
  if (message !== null) throw new Error(message);
}

/** 显式 id 走领域校验；缺省则算下一个号。 */
function resolveId(request: CreateEntryRequest, deps: CreateEntryDeps): string {
  if (request.id !== null) {
    const result = EntryId.create(request.id, request.type);
    if (!result.ok) {
      const suffix = result.error.suggestion ? `\n  → ${result.error.suggestion}` : "";
      throw new Error(result.error.message + suffix);
    }
    return result.value;
  }
  return computeNextId(
    extractIdsForKind(deps.workspace.load(), request.type),
    request.type,
  );
}

function resolveAuthor(request: CreateEntryRequest, deps: CreateEntryDeps): string {
  const author = request.author ?? deps.readAuthor();
  if (author === null || author === undefined || author.length === 0) {
    throw new Error(
      "git user.name is not set. Run `git config user.name <your-name>` or pass --author.",
    );
  }
  return author;
}
