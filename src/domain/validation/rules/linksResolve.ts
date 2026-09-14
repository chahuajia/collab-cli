import {Issue} from "@/domain/validation/Issue";
import {extractLinks, lastSegmentOf} from "@/domain/validation/rules/_shared";
import type {Entry} from "@/domain/entry/Entry";
import type {RuleContext} from "@/domain/validation/Rule";


/**
 * 单个条目内最多报告的失效链接数。
 *
 * @remarks
 * 防止一个"整体失联"的条目刷出几十条 Issue 淹没其他问题。
 * 前 10 条足以定位问题；超出部分不会丢失——修好前 10 条后再跑一次即可看到后续。
 */
export const MAX_DEAD_LINKS = 10;

/**
 * 判断引用是否解析为已知条目。
 *
 * @remarks
 * D2=C 的两步匹配：
 * 1. 精确匹配（长引用直接命中）
 * 2. 取最后一段匹配（短引用 / 长引用统一命中）
 */
function resolvesTo(ref: string, allEntryIds: ReadonlySet<string>): boolean {
    if (allEntryIds.has(ref)) return true;
    const last = lastSegmentOf(ref);
    return allEntryIds.has(last);
}

/**
 * 校验条目 body 中的所有 `[[X]]` 引用是否指向已存在的条目。
 *
 * @remarks
 * 不变量：
 * @param entry - 待校验条目
 * @param context - 提供 `allEntryIds` 用于匹配
 */
export const linksResolve = (
  entry: Entry,
  context: RuleContext,
): readonly Issue[] => {
  const rawRefs = extractLinks(entry.body);

  // 按 lastSegment 去重
  const firstSeen = new Map<string, string>();
  for (const ref of rawRefs) {
    const key = lastSegmentOf(ref);
    if (!firstSeen.has(key)) {
      firstSeen.set(key, ref);
    }
  }

  // 收集失效引用
  const deadRefs: string[] = [];
  for (const [, originalRef] of firstSeen) {
    const resolvesAsEntry = resolvesTo(originalRef, context.allEntryIds);
    const resolvesAsFile = context.allMarkdownPaths.has(originalRef);
    if (!resolvesAsEntry && !resolvesAsFile) {
      deadRefs.push(originalRef);
    }
  }

  return deadRefs
    .slice(0, MAX_DEAD_LINKS)
    .map((ref) => Issue.deadLink(entry.path, ref));
};