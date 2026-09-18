import { Issue } from "@/domain/validation/Issue";
import type { Entry } from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * 校验 `frontmatter.id` 出现在 `aliases` 里。
 *
 * @remarks
 * **为什么这条不可省**（2026-09-16）：
 * 渲染层（Obsidian）解析 `[[X]]` 只有两条路 —— **文件名** 或 **`aliases` 里的别名**。
 * 所以 `[[S12]]` 能跳，靠的不是"它是 id"，而是"id 被登记成了 alias"。
 *
 * 而**没有任何规则要求"id 必须出现在 aliases 里"** —— 谁忘了写，谁的
 * id 链接就静默断掉，而且工具查不出来（`resolvesRef` 按 id 就能解析）。
 *
 * 这条规则把"渲染层能解析 id"从**假设**变成**不变量**：
 * 校验器的判定与渲染器的判定，从此来自同一处。
 *
 * @param entry - 待校验条目
 * @param _context - 未使用；只看单条 entry
 */
export const idIsAlias = (
  entry: Entry,
  _context: RuleContext,
): readonly Issue[] => {
  const id = entry.frontmatter.id;
  if (entry.frontmatter.aliases.includes(id)) return [];
  return [Issue.idNotInAliases(entry.path, id)];
};
