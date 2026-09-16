import { fileNameOf } from "@/domain/validation/resolvesRef";
import type { Workspace } from "@/domain/entry/WorkspaceLoader";

/** catalog 落盘时的缩进 —— 只在这里出现一次。 */
const CATALOG_JSON_INDENT = 2;

/**
 * 把 catalog 序列化为落盘内容。
 *
 * @remarks
 * **唯一生产者。** CLI（`collab catalog`）与 MCP 都调它 ——
 * 两个入口写出的 catalog 必须是同一种形状，否则
 * `CATALOG_STALE` 会在两条路径之间随机报错。
 */
export function serializeCatalog(catalog: Catalog): string {
  return `${JSON.stringify(catalog, null, CATALOG_JSON_INDENT)}\n`;
}

/** catalog 里的一条条目 —— 供 agent 路由用的最小信息。 */
export interface CatalogEntry {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  /** 一句话标题（取正文首个 H1；没有则退回文件名） */
  readonly title: string;
  readonly path: string;
  readonly domains: readonly string[];
  readonly appliesTo: readonly string[];
  /** 什么时候该读这条（路由用）—— 由人/模型写，工具不生成 */
  readonly trigger?: string;
  /** 什么时候不用读这条 */
  readonly antiTrigger?: string;
}

export interface Catalog {
  readonly generatedAt: string;
  readonly entries: readonly CatalogEntry[];
  readonly summary: {
    readonly total: number;
    readonly byType: Readonly<Record<string, number>>;
    readonly byStatus: Readonly<Record<string, number>>;
  };
}

export interface BuildCatalogOptions {
  /** 生成时间（注入 —— 保持纯函数可测）。 */
  readonly generatedAt: string;
}

/**
 * **不进入路由表**的状态。
 *
 * @remarks
 * `dormant` 的正确语义不是"灰掉但仍占索引位"，而是**从路由索引中除名**
 * （见 `meta/pruning-policy`）。死亡成本归零，抵抗删除才没有理由。
 *
 * 只排除"明确退役"的两种；`draft` 仍然进入 —— 那是"在用但未定稿"，不是退役。
 */
const RETIRED_STATUSES: ReadonlySet<string> = new Set(["dormant", "deprecated"]);

/**
 * 从工作区生成 `catalog.json`。
 *
 * @remarks
 * **生成物，不是手写物。** 手写的索引必然是第二份真相源 —— 它会先漂移，然后骗人。
 *
 * 用途：agent 先读这份路由表（几百行）定位，再按需读 2-3 条全文，
 * 而不是把整个知识库塞进上下文 —— 直接实现 [[A16-上下文预算法]] 的"上下文是预算"。
 *
 * 纯函数：无 IO，时间由调用方注入。
 */
export function buildCatalog(
  workspace: Workspace,
  options: BuildCatalogOptions,
): Catalog {
  const entries: CatalogEntry[] = [];
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const loaded of workspace.entries) {
    if (loaded.entry === null) continue;
    const fm = loaded.entry.frontmatter;
    if (RETIRED_STATUSES.has(fm.status)) continue;

    entries.push({
      id: fm.id,
      type: fm.type,
      status: fm.status,
      title: titleOf(loaded.entry.body, loaded.path),
      path: loaded.path,
      domains: fm.domains,
      appliesTo: fm.appliesTo,
      ...(fm.trigger === undefined ? {} : { trigger: fm.trigger }),
      ...(fm.antiTrigger === undefined ? {} : { antiTrigger: fm.antiTrigger }),
    });

    byType[fm.type] = (byType[fm.type] ?? 0) + 1;
    byStatus[fm.status] = (byStatus[fm.status] ?? 0) + 1;
  }

  // 稳定排序（type → id）：让生成结果可 diff、可复现
  entries.sort((a, b) =>
    a.type === b.type ? a.id.localeCompare(b.id) : a.type.localeCompare(b.type),
  );

  return {
    generatedAt: options.generatedAt,
    entries,
    summary: { total: entries.length, byType, byStatus },
  };
}

/**
 * 取条目的一句话标题。
 *
 * @remarks
 * 优先正文首个 H1；没有 H1 就退回文件名。
 * **不在这里发明标题** —— 标题要么在文件里，要么就是文件名。
 */
function titleOf(body: string, filePath: string): string {
  const match = /^#\s+(.+?)\s*$/m.exec(body);
  if (match !== null && match[1] !== undefined) return match[1];
  return fileNameOf(filePath);
}
