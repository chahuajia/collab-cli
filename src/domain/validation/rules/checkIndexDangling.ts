// src/domain/validation/rules/checkIndexDangling.ts


import {Issue} from "@/domain/validation/Issue";
import {extractLinks, idPrefixForDir, lastSegmentOf} from "@/domain/validation/rules/_shared";
import type {RuleContext} from "@/domain/validation/Rule";

/**
 * 校验所有 `_index.md` 中的引用是否指向存在的条目。
 *
 * @remarks
 * 目录级检查。对每个 `_index.md`：
 * - 提取所有 `[[X]]`
 * - 跳过 `_` 开头的引用（D8=B，元数据）
 * - 跳过能在 `allEntryIds` 中找到的（D5=B，跨目录引用不报）
 * - 跳过去重后的重复
 * - 剩余引用中，"看起来属于本目录"（前缀匹配）的报 `DanglingIndexEntry`
 *
 * 为什么忽略跨目录引用：
 * `linksResolve` 已经负责全量引用检查；`checkIndexDangling` 只关心
 * "索引表是否列出了实际上不在本目录的条目"——这是索引自身的完整性问题。
 *
 * @param context - 提供所有信息
 */
export function checkIndexDangling(context: RuleContext): readonly Issue[] {
    const issues: Issue[] = [];

    for (const [dir, content] of context.indexFiles) {
        const refs = extractLinks(content);
        const seen = new Set<string>();
        const expectedPrefix = idPrefixForDir(dir);
        const indexPath = `${dir}/_index.md`;

        for (const ref of refs) {
            const key = lastSegmentOf(ref);
            if (seen.has(key)) continue;
            seen.add(key);

            // D8=B：`_` 开头视为元数据
            if (key.startsWith('_')) continue;

            // D5=B：条目存在于任意位置 → 不是 dangling
            if (context.allEntryIds.has(key)) continue;

            // "看起来属于本目录" 才报
            if (expectedPrefix === undefined) continue;
            if (!ref.startsWith(expectedPrefix)) continue;

            issues.push(Issue.danglingIndexEntry(indexPath, ref));
        }
    }

    return issues;
}