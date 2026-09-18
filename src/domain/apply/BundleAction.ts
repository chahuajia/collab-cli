import type { ValueOf } from "@/shared/types";

/**
 * bundle 中单个文件的操作类型值域。
 *
 * @remarks
 * 命名采用 `*Values` 后缀：这个名字表示"值的集合"，而非单一值的类型。
 * 类型 `BundleAction` 单独导出，保持简洁。
 */
export const BundleActionValues = {
  Create: "create",
  Replace: "replace",
  Delete: "delete",
} as const;

/**
 * 单个文件的操作类型联合。
 */
export type BundleAction = ValueOf<typeof BundleActionValues>;
