import { ApplyIssues } from "@/domain/apply/ApplyIssues";
import { BundleActionValues } from "@/domain/apply/BundleAction";
import { normalizeBundlePath } from "@/domain/apply/BundlePath";
import { Err, Ok } from "@/shared/Result";
import type { ContentHasher } from "@/domain/apply/ApplyWorkspace";
import type { BundleInput } from "@/domain/apply/BundleInput";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

/**
 * 通过预检的单个文件。
 *
 * @remarks
 * 判别联合保证：
 * - `create` / `replace` 一定有非空 `content`。
 * - `delete` 一定没有 `content`。
 *
 * 因此下游（`resolvePlan`）不需要 `as` 或 `!`。
 */
export type ValidatedFile =
  | {
      readonly action:
        | typeof BundleActionValues.Create
        | typeof BundleActionValues.Replace;
      readonly path: string;
      readonly content: string;
      readonly baseSha256: string | null;
    }
  | {
      readonly action: typeof BundleActionValues.Delete;
      readonly path: string;
      readonly baseSha256: string | null;
    };

/**
 * bundle 的纯预检：路径、内容、哈希。
 *
 * @remarks
 * 不碰文件系统 —— 需要"文件当前状态"的检查（冲突）在 `resolvePlan`。
 * 这样切分的原因：两者的失败受众不同，且这一半可以完全用表格测试。
 *
 * 收集所有问题，不是"遇到第一个就停"——
 * 用户要一次看到"这个 bundle 到底有几处坏"。
 *
 * @param input - 边界层解析出的 bundle
 * @param hasher - 内容哈希函数（由基础设施注入）
 * @returns 全部通过时返回规范化后的文件列表，否则返回全部 Issue
 */
export function validateBundle(
  input: BundleInput,
  hasher: ContentHasher,
): Result<readonly ValidatedFile[], readonly Issue[]> {
  const issues: Issue[] = [];

  if (input.files.length === 0) {
    issues.push(ApplyIssues.invalid("bundle contains no files"));
  }

  const validated: ValidatedFile[] = [];
  for (const file of input.files) {
    const pathResult = normalizeBundlePath(file.path);
    if (!pathResult.ok) {
      issues.push(pathResult.error);
      continue;
    }
    const path = pathResult.value;

    if (file.action === BundleActionValues.Delete) {
      validated.push({
        action: file.action,
        path,
        baseSha256: file.baseSha256,
      });
      continue;
    }

    if (file.content === null || file.content.trim().length === 0) {
      issues.push(ApplyIssues.emptyContent(path));
      continue;
    }

    if (file.sha256 === null || file.sha256 !== hasher(file.content)) {
      issues.push(ApplyIssues.hashMismatch(path));
      continue;
    }

    validated.push({
      action: file.action,
      path,
      content: file.content,
      baseSha256: file.baseSha256,
    });
  }

  return issues.length > 0 ? Err(issues) : Ok(validated);
}
