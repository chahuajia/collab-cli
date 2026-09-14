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
 * - 失效引用报 `DeadLink`（error，D1=A）
 * - 长引用与短引用等价（D2=C）
 * - 自引用允许（D3=A）
 * - 同一目标只报一次，保留首次出现的原文（D4=A）
 * - 标题里的链接也校验（D5=A）
 * - 代码块内也校验（D6=B，已知限制，TODO 后修）
 * - `[[]]` 忽略（D7=A，正则天然不匹配）
 * - 每个条目最多报 `MAX_DEAD_LINKS` 条（新增）
 *
 * 不负责：
 * - 反向对称性（A→B 与 B→A 是独立判断）
 * - 链接书写风格的一致性（如全用短引用）
 * - Markdown 链接 `[text](url)`
 *
 * @param entry - 待校验条目
 * @param context - 提供 `allEntryIds` 用于匹配
 */
export const linksResolve = (
    entry: Entry,
    context: RuleContext,
): readonly Issue[] => {
    const rawRefs = extractLinks(entry.body);

    // 按 lastSegment 去重，保留首次出现的原文（用于消息显示）
    const firstSeen = new Map<string, string>();
    for (const ref of rawRefs) {
        const key = lastSegmentOf(ref);
        if (!firstSeen.has(key)) {
            firstSeen.set(key, ref);
        }
    }

    // 收集失效引用（保留原文用于报错）
    const deadRefs: string[] = [];
    for (const [, originalRef] of firstSeen) {
        if (!resolvesTo(originalRef, context.allEntryIds)) {
            deadRefs.push(originalRef);
        }
    }

    // 限流
    return deadRefs
        .slice(0, MAX_DEAD_LINKS)
        .map((ref) => Issue.deadLink(entry.path, ref));
};