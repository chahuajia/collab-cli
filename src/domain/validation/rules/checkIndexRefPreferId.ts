import { Issue } from "@/domain/validation/Issue";
import {
  fileNameOf,
  refersTo,
} from "@/domain/validation/resolvesRef";
import { dirOfPath, lastSegmentOf } from "@/domain/validation/rules/_shared";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * 从 `_index.md` 表格行提取第一列双链引用。
 *
 * @remarks
 * 只查以 `|` 开头的行 —— 叙事段落里的链接可读性优先，不在此规则范围。
 */
function extractIndexTableRefs(content: string): readonly string[] {
  const refs: string[] = [];
  for (const line of content.split("\n")) {
    if (!line.startsWith("|")) continue;
    const m = line.match(/\[\[([^\]]+)\]\]/);
    if (m?.[1]) refs.push(m[1]);
  }
  return refs;
}

/**
 * 警告 `_index.md` 表格行使用**文件名锚**而非 **id 锚**。
 *
 * @remarks
 * ADR-0009：id 是不可变快照；语义后缀改名后 id 链接存活，文件名链接不会。
 * 两种形式都能通过 `resolvesRef` —— 本规则只表达**推荐**，不阻断 validate。
 *
 * 跳过：
 * - 已用 id 形式（末段 === frontmatter.id）
 * - id 与文件名相同（patterns / integrations 的语义 id）
 * - 找不到同目录条目（跨目录引用、悬空行由其他规则处理）
 */
export function checkIndexRefPreferId(
  context: RuleContext,
): readonly Issue[] {
  const issues: Issue[] = [];

  for (const [dir, content] of context.indexFiles) {
    const indexPath = `${dir}/_index.md`;
    const seen = new Set<string>();

    for (const ref of extractIndexTableRefs(content)) {
      const key = lastSegmentOf(ref);
      if (seen.has(key)) continue;
      seen.add(key);

      const entry = context.allEntries.find(
        (e) => dirOfPath(e.path) === dir && refersTo(ref, e),
      );
      if (entry === undefined) continue;

      const id = entry.frontmatter.id;
      const fileName = fileNameOf(entry.path);
      if (fileName === id) continue;
      if (key === id) continue;
      if (key !== fileName) continue;

      issues.push(Issue.indexRefPreferId(indexPath, ref, id));
    }
  }

  return issues;
}
