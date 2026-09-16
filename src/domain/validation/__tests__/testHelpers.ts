import type { Entry } from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * 构造 `RuleContext` 的测试辅助。
 *
 * @remarks
 * **统一的 Arrange** —— 覆盖 4 种调用形态：
 * 1. 只给 entryIds（`linksResolve`）
 * 2. 只给 entries（`checkIndexForward` / `checkIndexExists`）
 * 3. 给 entries + indexFiles
 * 4. 给 entries + indexDirs（空内容 Map）
 *
 * **关键设计**：
 * - **所有参数可选** —— 默认空。
 * - **`entryIds` 与 `markdownPaths` 都可派生** —— 从 `entries` 提取（单一真相源）。
 *   `markdownPaths` 尤其重要：**链接按文件名解析**（2026-09-16 修正），
 *   不派生出路径的话，`[[S12]]` 会被误判成死链。
 * - **`indexFiles` 和 `indexDirs` 互斥** —— 前者优先。
 */
export interface RuleContextInput {
  readonly entries?: readonly Entry[];
  /** 显式指定 entry id 集合（不给则从 entries 派生）。 */
  readonly entryIds?: readonly string[];
  /** 完整 index 内容（`dir → content`）。 */
  readonly indexFiles?: ReadonlyMap<string, string>;
  /** 只给目录名（内容用空串占位）。 */
  readonly indexDirs?: readonly string[];
  /** 所有 `.md` 路径（去 `.md` 后缀）。 */
  readonly markdownPaths?: readonly string[];
}

export function makeRuleContext(input: RuleContextInput = {}): RuleContext {
  const entries = input.entries ?? [];
  const entryIds = input.entryIds ?? entries.map((e) => e.frontmatter.id);

  const indexFiles =
    input.indexFiles ??
    new Map((input.indexDirs ?? []).map((dir) => [dir, ""]));

  const markdownPaths = input.markdownPaths ?? [];

  // 未显式给 markdownPaths 时，从 entries 派生（去掉 `.md`，统一分隔符）
  const derivedPaths =
    input.markdownPaths ??
    entries.map((e) => e.path.replace(/\\/g, "/").replace(/\.md$/, ""));

  return {
    allEntries: entries,
    allEntryIds: new Set(entryIds),
    indexFiles,
    allMarkdownPaths: new Set(
      input.markdownPaths === undefined ? derivedPaths : markdownPaths,
    ),
  };
}
