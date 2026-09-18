import { createHash } from "node:crypto";
import { BundleActionValues } from "@/domain/apply/BundleAction";
import { validateBundle } from "@/domain/apply/validateBundle";
import type { WorkspaceFacts } from "@/domain/apply/ApplyWorkspace";
import type { BundleFileInput, BundleInput } from "@/domain/apply/BundleInput";
import type { ValidatedFile } from "@/domain/apply/validateBundle";

/**
 * 测试用的哈希实现。
 *
 * @remarks
 * **故意不复用生产的 `sha256Hex`** —— 测试自己算一遍，
 * 生产的哈希实现就是被验证的对象之一。
 */
export function hashOf(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** 构造 bundle 输入（边界层产物的替身）。 */
export function bundleInput(
  files: readonly BundleFileInput[],
): BundleInput {
  return {
    version: 1,
    generatedAt: null,
    generatedBy: null,
    baseCommit: null,
    files,
  };
}

/** 构造一个自洽的 `create` 文件输入（内容与 sha256 一致）。 */
export function createFile(path: string, content: string): BundleFileInput {
  return {
    path,
    action: BundleActionValues.Create,
    content,
    sha256: hashOf(content),
    baseSha256: null,
  };
}

export function replaceFile(
  path: string,
  content: string,
  baseSha256: string,
): BundleFileInput {
  return {
    path,
    action: BundleActionValues.Replace,
    content,
    sha256: hashOf(content),
    baseSha256,
  };
}

export function deleteFile(path: string): BundleFileInput {
  return {
    path,
    action: BundleActionValues.Delete,
    content: null,
    sha256: null,
    baseSha256: null,
  };
}

/**
 * 用**生产校验器**把文件输入跑成 `ValidatedFile[]`。
 *
 * @remarks
 * `resolvePlan` 的测试因此不必手工拼 `ValidatedFile` 字面量 ——
 * fixture 走生产逻辑（"测试 DDD"）。
 *
 * 注入的哈希函数用本文件的 `hashOf`，**不用 `infrastructure/crypto`**：
 * 领域层（含其测试）不得依赖基础设施 —— 生产实现的正确性由 E2E 保证。
 */
export function validated(
  files: readonly BundleFileInput[],
): readonly ValidatedFile[] {
  const result = validateBundle(bundleInput(files), hashOf);
  if (!result.ok) {
    throw new Error(
      `fixture rejected by validateBundle: ${result.error
        .map((issue) => issue.format())
        .join(" | ")}`,
    );
  }
  return result.value;
}

/**
 * 构造工作区事实快照。
 *
 * @remarks
 * 只列"已存在"的文件；未列出的路径视为不存在。
 */
export function factsOf(
  entries: Readonly<Record<string, string>>,
): WorkspaceFacts {
  return new Map(
    Object.entries(entries).map(([path, sha256]) => [
      path,
      { exists: true, sha256 },
    ]),
  );
}
