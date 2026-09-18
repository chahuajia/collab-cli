import type { BundleAction, BundleActionValues } from "@/domain/apply/BundleAction";

/**
 * 计划中的一步。
 *
 * @remarks
 * 判别联合（discriminated union）：`delete` 没有 `content`。
 * 这样调用方无需 `as` 断言或非空断言就能取到内容。
 */
export type PlannedOperation =
  | {
      readonly kind:
        | typeof BundleActionValues.Create
        | typeof BundleActionValues.Replace;
      readonly path: string;
      readonly content: string;
    }
  | {
      readonly kind: typeof BundleActionValues.Delete;
      readonly path: string;
    };

/**
 * 落盘计划值对象。
 *
 * @remarks
 * 只描述"将要发生什么"，不做任何 IO。
 * 计划一旦生成就是完整的 —— 执行阶段不再判断，只按顺序执行。
 */
export class ApplyPlan {
  private constructor(
    private readonly _operations: readonly PlannedOperation[],
  ) {}

  /**
   * 从操作列表构造计划。
   */
  static of(operations: readonly PlannedOperation[]): ApplyPlan {
    return new ApplyPlan([...operations]);
  }

  /**
   * 按顺序排列的操作。
   *
   * @remarks
   * 顺序即 bundle 中 `files` 的顺序 —— 不重排，保持可预期。
   */
  get operations(): readonly PlannedOperation[] {
    return this._operations;
  }

  /** 操作总数。 */
  count(): number {
    return this._operations.length;
  }

  /** 指定操作类型的数量。 */
  countOf(kind: BundleAction): number {
    return this._operations.filter((op) => op.kind === kind).length;
  }

  /** 计划是否为空。 */
  isEmpty(): boolean {
    return this._operations.length === 0;
  }
}
