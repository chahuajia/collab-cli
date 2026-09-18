import { z } from "zod";
import { ApplyIssues } from "@/domain/apply/ApplyIssues";
import { BundleActionValues } from "@/domain/apply/BundleAction";
import { enumOf } from "@/infrastructure/parsing/zod-helpers";
import { Err, Ok } from "@/shared/Result";
import type { BundleInput } from "@/domain/apply/BundleInput";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

/**
 * 当前支持的 bundle 版本。
 *
 * @remarks
 * 版本不同 = 契约不同。写成 `literal` 而不是 `number`：
 * 未来出现 v2 时，v1 的输入会**在边界被拒绝**，而不是带着未知字段
 * 悄悄流进领域层。
 */
export const SupportedBundleVersion = 1;

const FileSchema = z.object({
  path: z.string(),
  action: enumOf(BundleActionValues),
  // delete 可以不带 content / sha256
  content: z.string().nullable().default(null),
  sha256: z.string().nullable().default(null),
  base_sha256: z.string().nullable().default(null),
});

const Schema = z.object({
  version: z.literal(SupportedBundleVersion),
  generated_at: z.string().nullable().default(null),
  generated_by: z.string().nullable().default(null),
  base_commit: z.string().nullable().default(null),
  files: z.array(FileSchema),
});

/**
 * 解析 bundle.json。
 *
 * @remarks
 * 边界层的唯一职责（S12 / patterns/parse-dont-validate）：
 * **接收 `unknown`，输出类型化的 `BundleInput`**，只做形状校验。
 *
 * 不在这里做的：
 * - 路径安全性 / 白名单（`normalizeBundlePath`）。
 * - 内容非空、哈希一致（`validateBundle`）。
 * - 与工作区的冲突（`resolvePlan`）。
 *
 * 理由：形状错误是"这个文件不是 bundle"，语义错误是"这个 bundle 坏在哪"，
 * 两者的报错受众与修复动作不同。
 *
 * @param raw - `JSON.parse` 的结果（仍属不可信输入）
 * @returns 成功返回 `BundleInput`，失败返回全部形状 Issue
 */
export function parseBundle(raw: unknown): Result<BundleInput, readonly Issue[]> {
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    return Err(
      parsed.error.issues.map((issue) =>
        ApplyIssues.invalid(`${issue.path.join(".")}: ${issue.message}`),
      ),
    );
  }

  const data = parsed.data;
  return Ok({
    version: data.version,
    generatedAt: data.generated_at,
    generatedBy: data.generated_by,
    baseCommit: data.base_commit,
    files: data.files.map((file) => ({
      path: file.path,
      action: file.action,
      content: file.content,
      sha256: file.sha256,
      baseSha256: file.base_sha256,
    })),
  });
}
