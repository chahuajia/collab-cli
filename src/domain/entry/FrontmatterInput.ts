// src/domain/entry/FrontmatterInput.ts
import type { EntryKind, EntryStatus } from './types.js';

/**
 * Frontmatter 工厂的输入契约。
 *
 * @remarks
 * **这不是值对象**。它是一个输入形状（shape），由边界层填充、由领域工厂消费。
 * 命名带 `Input` 后缀，明确表示它不是领域对象。
 *
 * 唯一生产者：`infrastructure/parsing/FrontmatterParser.parseFrontmatterInput`。
 * 唯一消费者：`domain/entry/Frontmatter.create`。
 * **不期望任何其他代码手动构造它**。
 */
export interface FrontmatterInput {
  readonly id: string;
  readonly type: EntryKind;
  readonly status: EntryStatus;
  readonly created: string;
  readonly updated: string;
  readonly domains: readonly string[];
  readonly "applies-to": readonly string[];
  readonly supersedes: string | null;
  readonly author: string;
  readonly "co-authors": readonly string[];
  readonly focus: readonly string[];
  readonly provenance?: string | undefined;
  readonly aliases?: readonly string[] | undefined;
  /** 什么时候**该**读这条（路由用）。由人/模型写 —— 工具生成不出来。 */
  readonly trigger?: string | undefined;
  /** 什么时候**不用**读这条（反触发，防误用）。 */
  readonly "anti-trigger"?: string | undefined;
  /**
   * 不读它，模型会照着**本地哪个模式**写错？（入库门槛 —— 见 `meta/pruning-policy`）
   *
   * @remarks
   * 必须是反事实，且必须是**模仿类**：不是"模型不知道 X"（称职的模型本来就知道，
   * 这一点已被 evolutionary 的 D 实验六跑证伪），而是"模型会照着眼前这段坏代码
   * 继续写下去"。答不出来 → 这条不该入库。
   */
  readonly falsifier?: string | undefined;
  /**
   * 已把这条内容机械化的测试/工具/规则的路径。非空 = **已毕业**。
   *
   * @remarks
   * 毕业的条目**退出路由索引**（见 `domain/entry/routed.ts`），但文件仍在、
   * 仍被校验、仍可链接 —— 它不是被删，是内容已经活在测试里，不需要再被读了。
   */
  readonly enforced: string | null;
}
