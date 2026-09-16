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
}
