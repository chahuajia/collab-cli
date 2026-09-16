import { Issue } from "@/domain/validation/Issue";
import { resolvesRef } from "@/domain/validation/resolvesRef";
import { extractLinks, lastSegmentOf } from "@/domain/validation/rules/_shared";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * 校验**仓库根 Markdown**（`AGENTS.md` / `ROOT.md` / `README.md`）里的链接。
 *
 * @remarks
 * 这些文件不是条目（不在 kind 目录下），所以 `linksResolve` 从来看不到它们 ——
 * 但它们是**最常被读**的文件：入口里的死链比条目里的死链贵得多。
 *
 * 判据复用 `resolvesRef`（与正文链接同一条规则），**不另写一份**。
 */
export function linksResolveInRootDocs(context: RuleContext): readonly Issue[] {
  const rootDocs = context.rootDocs;
  if (rootDocs === undefined) return [];

  const issues: Issue[] = [];
  for (const [docPath, content] of rootDocs) {
    const seen = new Set<string>();
    for (const ref of extractLinks(content)) {
      const key = lastSegmentOf(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!resolvesRef(ref, context)) {
        issues.push(Issue.deadLink(docPath, ref));
      }
    }
  }

  return issues;
}
