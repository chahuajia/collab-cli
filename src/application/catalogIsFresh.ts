import { buildCatalog } from "@/application/buildCatalog";
import { Issue } from "@/domain/validation/Issue";
import type { Workspace } from "@/domain/entry/WorkspaceLoader";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * 校验 `catalog.json` 与工作区一致（**生成物不能过期**）。
 *
 * @remarks
 * **为什么在 application 层而不是 domain**：它要组合 `buildCatalog`（应用层）
 * 与工作区，是"编排"而不是"规则逻辑"。domain 只定义 `RuleContext` 的形状。
 *
 * **为什么属于 validate**：校验与构建本来就承接 —— 过期的 catalog 会让 agent
 * 路由到错位置，与死链、缺索引是同一类"与工作区不一致"。
 *
 * 对比时**忽略 `generatedAt`**（时间戳每次都不同）。三种情况：
 * - `undefined` → 不检查（工作区没提供）
 * - `null` → 不报（不是每个工作区都需要 catalog；删掉它是可见行为）
 * - 解析失败 / entries 不一致 → `CATALOG_STALE`
 *
 * @param context - 校验上下文（需要 `catalogJson` 与 `allEntries`）
 */
export function catalogIsFresh(context: RuleContext): readonly Issue[] {
  const raw = context.catalogJson;
  if (raw === undefined || raw === null) return [];

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return [Issue.catalogStale("it is not valid JSON")];
  }

  const storedEntries = readEntries(stored);
  if (storedEntries === null) {
    return [Issue.catalogStale("it has no `entries` array")];
  }

  const workspace: Workspace = {
    entries: context.allEntries.map((entry) => ({
      path: entry.path,
      entry,
      parseIssues: [],
    })),
    indexFiles: context.indexFiles,
    allMarkdownPaths: context.allMarkdownPaths,
  };
  const fresh = buildCatalog(workspace, { generatedAt: "" });

  if (JSON.stringify(storedEntries) !== JSON.stringify(fresh.entries)) {
    return [
      Issue.catalogStale(
        "entries differ from the workspace (files added, removed, or renamed)",
      ),
    ];
  }

  return [];
}

/**
 * 从解析结果里取出 `entries` 数组。
 *
 * @remarks
 * 用类型守卫而不是 `as` 断言 —— 断言是"我保证"，守卫是"我验证"。
 *
 * @returns entries 数组，或 null（不是对象 / 没有该字段 / 不是数组）
 */
function readEntries(value: unknown): readonly unknown[] | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("entries" in value)) return null;
  const entries: unknown = value.entries;
  return Array.isArray(entries) ? entries : null;
}
