// src/domain/validation/rules/checkIndexForward.ts
import {Issue} from "@/domain/validation/Issue";
import { refersTo } from "@/domain/validation/resolvesRef";
import {dirOfPath, extractLinks} from "@/domain/validation/rules/_shared";
import type {Entry} from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * 单个目录下最多报告的 MissingFromIndex 数。
 *
 * @remarks
 * 保留作为未来扩展的锚点；当前实现 per-entry（每条目最多 1 条）。
 */
export const MAX_MISSING_FROM_INDEX = 10;

/**
 * 校验单个条目是否被其所在目录的 `_index.md` 列出。
 *
 * @remarks
 * 不变量：
 * - 条目所在目录没有 index → 静默通过（由 `checkIndexExists` 报错）
 * - index 里任一引用**指向本条目**（短 id 或文件名）→ 通过
 * - 否则 → `MissingFromIndex`
 */
export const checkIndexForward = (
  entry: Entry,
  context: RuleContext,
): readonly Issue[] => {
  const dir = dirOfPath(entry.path);
  const indexContent = context.indexFiles.get(dir);
  if (indexContent === undefined) return [];

  const refs = extractLinks(indexContent);
  const found = refs.some((ref) => refersTo(ref, entry));
  if (found) return [];

  return [Issue.missingFromIndex(entry.path, entry.frontmatter.id)];
};