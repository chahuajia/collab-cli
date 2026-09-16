import { BundleActionValues } from "@/domain/apply/BundleAction";
import { resolvePlan } from "@/domain/apply/resolvePlan";
import { validateBundle } from "@/domain/apply/validateBundle";
import type { ApplyPlan } from "@/domain/apply/ApplyPlan";
import type {
  ApplyWorkspace,
  ContentHasher,
  FileFacts,
  WorkspaceFacts,
} from "@/domain/apply/ApplyWorkspace";
import type { BundleInput } from "@/domain/apply/BundleInput";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

/**
 * 把 bundle 落盘的用例。
 *
 * @remarks
 * 编排职责：
 * 1. 预检（`validateBundle`：路径 / 内容 / 哈希）—— 纯逻辑。
 * 2. 观察工作区（`ApplyWorkspace.inspect`）—— IO。
 * 3. 解出计划（`resolvePlan`：冲突）—— 纯逻辑。
 * 4. 执行计划（`ApplyWorkspace.write/remove`）—— IO，且只在调用 `execute` 时发生。
 *
 * 关键性质：**`plan` 不改任何文件**。因此 `--dry-run` 就是
 * "只调用 plan、不调用 execute"，而不是另写一条分支。
 *
 * 不负责：解析 JSON（边界层）、validate / index / commit（各自独立的用例）。
 */
export class ApplyUseCase {
  constructor(
    private readonly workspace: ApplyWorkspace,
    private readonly hasher: ContentHasher,
  ) {}

  /**
   * 预检 + 冲突检查，产出一个完整计划。
   *
   * @remarks
   * 计划要么完整，要么不存在 —— 不存在"部分计划"。
   * 这正是"全有或全无"在类型上的表达。
   *
   * @returns 成功返回计划，失败返回全部 Issue（一个文件都不写）
   */
  plan(input: BundleInput): Result<ApplyPlan, readonly Issue[]> {
    const validated = validateBundle(input, this.hasher);
    if (!validated.ok) return validated;

    const facts = this.observe(validated.value.map((file) => file.path));
    return resolvePlan(validated.value, facts);
  }

  /**
   * 执行计划。
   *
   * @remarks
   * 按 `operations` 顺序执行，**不再做任何判断**（预检已保证）。
   * 不返回 Result：到了这一步不存在"可预期的失败"，
   * 真正的 IO 异常（磁盘满、权限）应该直接抛出去，而不是伪装成校验失败。
   */
  execute(plan: ApplyPlan): void {
    for (const operation of plan.operations) {
      if (operation.kind === BundleActionValues.Delete) {
        this.workspace.remove(operation.path);
      } else {
        this.workspace.write(operation.path, operation.content);
      }
    }
  }

  /**
   * 观察所有目标路径的当前状态。
   *
   * @remarks
   * 去重：同一个路径在一次 bundle 里出现两次时只读一次盘。
   */
  private observe(paths: readonly string[]): WorkspaceFacts {
    const facts = new Map<string, FileFacts>();
    for (const path of paths) {
      if (facts.has(path)) continue;
      facts.set(path, this.workspace.inspect(path));
    }
    return facts;
  }
}
