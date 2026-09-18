import { BundleActionValues } from "@/domain/apply/BundleAction";
import { normalizeBundlePath } from "@/domain/apply/BundlePath";
import type { ApplyWorkspace, ContentHasher } from "@/domain/apply/ApplyWorkspace";

/** 切分产物里的一段文本块（只有位置与内容，没有领域含义）。 */
export interface BundleBlock {
  readonly path: string;
  readonly content: string;
}

/** bundle 里单个文件 —— 落盘所需的**全部**字段。 */
export interface BundleJsonFile {
  readonly path: string;
  readonly action: string;
  readonly content: string;
  readonly sha256: string;
  readonly base_sha256: string | null;
}

/** `bundle.json` 的形状（与 `BundleParser` 的消费端一一对应）。 */
export interface BundleJson {
  readonly version: number;
  readonly generated_at: string;
  readonly generated_by: string;
  readonly base_commit: string | null;
  readonly files: readonly BundleJsonFile[];
}

export interface BuildBundleInput {
  readonly blocks: readonly BundleBlock[];
  /** 只用来**观察**现状（推断 action 与乐观锁），不写盘。 */
  readonly workspace: ApplyWorkspace;
  readonly hasher: ContentHasher;
  readonly generatedAt: string;
  readonly generatedBy: string;
}

/**
 * 把"切分出的文本块"组装成 bundle。
 *
 * @remarks
 * **唯一生产者。** CLI 的 `collab parse` 与 MCP 的 `collab_parse` 都走这里 ——
 * "action 怎么推断"这条规则只能有一份，否则两个入口早晚给出不同的 bundle。
 *
 * action 按工作区现状推断（不是让模型猜）：文件不存在 → `create`；
 * 已存在 → `replace` + `base_sha256`（乐观锁）。一批产出里新建与修订
 * 本来就混在一起，**让工具读现状比让模型猜更准**。
 *
 * 纯编排：没有任何写操作，`generatedAt` 由调用方注入（可测）。
 */
export function buildBundle(input: BuildBundleInput): BundleJson {
  const files: BundleJsonFile[] = input.blocks.map((block) => {
    const normalized = normalizeBundlePath(block.path);
    const facts = normalized.ok
      ? input.workspace.inspect(normalized.value)
      : { exists: false, sha256: null };

    return {
      path: block.path,
      action: facts.exists
        ? BundleActionValues.Replace
        : BundleActionValues.Create,
      content: block.content,
      sha256: input.hasher(block.content),
      base_sha256: facts.exists ? facts.sha256 : null,
    };
  });

  return {
    version: 1,
    generated_at: input.generatedAt,
    generated_by: input.generatedBy,
    base_commit: null,
    files,
  };
}
