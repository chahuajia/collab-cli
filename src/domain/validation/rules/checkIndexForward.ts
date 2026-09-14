// src/domain/validation/rules/checkIndexForward.ts


import {Issue} from "@/domain/validation/Issue";
import {dirOfPath, extractLinks, lastSegmentOf} from "@/domain/validation/rules/_shared";
import type {Entry} from "@/domain/entry/Entry";
import type {RuleContext} from "@/domain/validation/Rule";

/**
 * 单个目录下最多报告的 MissingFromIndex 数。
 *
 * @remarks
 * 虽然此规则是 per-entry 签名（每条目最多贡献 1 条），
 * 此常量保留作为未来扩展的锚点；当前实现未用到 per-directory 限流。
 */
export const MAX_MISSING_FROM_INDEX = 10;

/**
 * 校验单个条目是否被其所在目录的 `_index.md` 列出。
 *
 * @remarks
 * 不变量：
 * - 条目所在目录没有 index → 静默通过（由 `checkIndexExists` 报错）
 * - 条目 id 在 index 内容中以 `[[X]]` 形式出现（短或长引用均可）→ 通过
 * - 否则 → `MissingFromIndex`
 *
 * @param entry - 待校验条目
 * @param context - 提供 indexFiles 和 allEntries
 */
export const checkIndexForward = (
    entry: Entry,
    context: RuleContext,
): readonly Issue[] => {
    const dir = dirOfPath(entry.path);
    const indexContent = context.indexFiles.get(dir);
    if (indexContent === undefined) return [];

    const refs = extractLinks(indexContent);
    const entryId = entry.frontmatter.id;
    const found = refs.some((ref) => lastSegmentOf(ref) === entryId);
    if (found) return [];

    return [Issue.missingFromIndex(entry.path, entryId)];
};