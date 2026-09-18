import { ApplyIssues } from "@/domain/apply/ApplyIssues";
import { ApplyPlan } from "@/domain/apply/ApplyPlan";
import { BundleActionValues } from "@/domain/apply/BundleAction";
import { Err, Ok } from "@/shared/Result";
import type { PlannedOperation } from "@/domain/apply/ApplyPlan";
import type { WorkspaceFacts } from "@/domain/apply/ApplyWorkspace";
import type { ValidatedFile } from "@/domain/apply/validateBundle";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

/**
 * 用"工作区当前状态"解出落盘计划。
 *
 * @remarks
 * 纯函数：事实由调用方观察好再传进来（`WorkspaceFacts`）。
 * 因此冲突规则（spec 预检表的后四行）可以用表驱动测试覆盖。
 *
 * 规则：
 * - `create` 且目标已存在 → 拒绝（提示改用 replace）。
 * - `replace` 且目标不存在 → 拒绝（提示改用 create）。
 * - `replace` 且 `base_sha256` 与当前哈希不符 → 拒绝（文件已被外部修改）。
 * - `delete` 且目标不存在 → 拒绝。
 *
 * 与 `validateBundle` 一样：收集所有问题，不是遇错即停。
 *
 * @param files - `validateBundle` 的产物
 * @param facts - 工作区事实快照
 * @returns 全部通过时返回计划，否则返回全部 Issue
 */
export function resolvePlan(
  files: readonly ValidatedFile[],
  facts: WorkspaceFacts,
): Result<ApplyPlan, readonly Issue[]> {
  const issues: Issue[] = [];
  const operations: PlannedOperation[] = [];

  for (const file of files) {
    const state = facts.get(file.path);
    const exists = state?.exists ?? false;
    const currentHash = state?.sha256 ?? null;

    switch (file.action) {
      case BundleActionValues.Create: {
        if (exists) {
          issues.push(ApplyIssues.createTargetExists(file.path));
          break;
        }
        operations.push({
          kind: file.action,
          path: file.path,
          content: file.content,
        });
        break;
      }
      case BundleActionValues.Replace: {
        if (!exists) {
          issues.push(ApplyIssues.replaceTargetMissing(file.path));
          break;
        }
        if (file.baseSha256 === null || file.baseSha256 !== currentHash) {
          issues.push(ApplyIssues.baseHashMismatch(file.path));
          break;
        }
        operations.push({
          kind: file.action,
          path: file.path,
          content: file.content,
        });
        break;
      }
      case BundleActionValues.Delete: {
        if (!exists) {
          issues.push(ApplyIssues.deleteTargetMissing(file.path));
          break;
        }
        operations.push({ kind: file.action, path: file.path });
        break;
      }
    }
  }

  return issues.length > 0 ? Err(issues) : Ok(ApplyPlan.of(operations));
}
