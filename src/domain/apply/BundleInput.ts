import type { BundleAction } from "@/domain/apply/BundleAction";

/**
 * bundle 中单个文件的输入。
 *
 * @remarks
 * `*Input` 命名遵循 S12：**只由边界解析函数生产**（`parseBundle`），
 * 调用方不得手工构造。字段是"原始字符串"，尚未经过领域不变量校验。
 *
 * - `content` / `sha256`：`delete` 允许为 null；`create` / `replace` 必须非空。
 * - `baseSha256`：`replace` 的乐观锁 —— 与文件当前哈希比对。
 */
export interface BundleFileInput {
  /** 相对知识库根的路径（可能带 `COLLABORATION/` 前缀，需规范化） */
  readonly path: string;
  readonly action: BundleAction;
  readonly content: string | null;
  readonly sha256: string | null;
  readonly baseSha256: string | null;
}

/**
 * 一个 bundle（`bundle.json`）的输入。
 *
 * @remarks
 * `version` 在边界层被约束为 `1`（zod `literal`）——
 * 领域层因此无需再做版本判断。
 */
export interface BundleInput {
  readonly version: number;
  readonly generatedAt: string | null;
  readonly generatedBy: string | null;
  readonly baseCommit: string | null;
  readonly files: readonly BundleFileInput[];
}
