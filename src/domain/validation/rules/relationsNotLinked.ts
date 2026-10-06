import { Issue } from "@/domain/validation/Issue";
import { refersTo } from "@/domain/validation/resolvesRef";
import type { Entry } from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";

/** 「关联」节的标题（H2，允许前后空白）。 */
const RELATIONS_HEADING = /^##\s*关联\s*$/;

/** 单个条目最多报告几条（同 `MAX_DEAD_LINKS` 的理由：别淹没其他问题）。 */
export const MAX_UNLINKED_RELATIONS = 10;

/** 取「## 关联」节正文；没有这一节时返回 `null`。 */
function relationsSectionOf(body: string): string | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => RELATIONS_HEADING.test(line));
  if (start < 0) return null;

  let end = start + 1;
  while (end < lines.length && !/^##\s/.test(lines[end] ?? "")) end += 1;
  return lines.slice(start + 1, end).join("\n");
}

/**
 * 「## 关联」节里的引用必须是 `[[双链]]`，不能写成纯文本。
 *
 * @remarks
 * **为什么需要它**：`linksResolve` 只查"已经是链接的东西能不能解析"。
 * 一句 `patterns/agent-delegation-criteria`（或带 `.md` 的路径）**不是链接** ——
 * 死链规则视而不见，可达性扫描与 `catalog` 的图却**少了一条边**：
 * 目标看起来更像孤岛，`retire --candidates` 的判据也跟着失真。
 * 2026-10-06 实测：某项目由 agent 落盘的三条条目，关联节全是裸路径。
 *
 * **只查「关联」节**（范围即判据）：
 * - 正文里用反引号写路径是**正当写法**（本库到处是，且 base-contract 明说"行内代码里的双括号不算链接"）；
 * - 「关联」按定义就是"这一条与哪些条目有关" —— 这里写裸路径没有第二种解释。
 *   全库扫会一片假阳性，而假阳性会让仪器被无视（`patterns/policy-without-mechanism`）。
 *
 * **只报"能解析到已存在实体"的 token**：解析不到的多半是散文（`src/foo.ts`、外部链接），
 * 那不是"漏写的链接"，该由别的判据管。
 */
export function relationsNotLinked(entry: Entry, context: RuleContext): readonly Issue[] {
  const section = relationsSectionOf(entry.body);
  if (section === null) return [];

  // 已经写好的 `[[…]]` 先挖掉 —— 它们的解析由 `linksResolve` 负责。
  const stripped = section.replace(/\[\[[^\]]*\]\]/g, " ");

  const issues: Issue[] = [];
  const seen = new Set<string>();
  for (const raw of stripped.split(/[\s，,、;；|()（）\[\]<>`*"'：:]+/)) {
    const token = raw.replace(/[.。]+$/, "");
    if (token.length < 2 || seen.has(token)) continue;
    if (!/[A-Za-z]/.test(token)) continue;
    // **只看它是不是指向某条「条目」** —— 「关联」按定义就是"条目之间"。
    // （用 `resolvesRef` 会连 `working-memory/x.md` 这种非条目文件一起报 —— 太宽。）
    const target = context.allEntries.find((e) => refersTo(token, e));
    if (target === undefined) continue;
    if (issues.length >= MAX_UNLINKED_RELATIONS) break;

    seen.add(token);
    // 建议用 **id**（不可变快照，ADR-0009）；拿不到就退回末段。
    const suggestion = target.frontmatter.id;
    issues.push(Issue.relationsNotLinked(entry.path, token, suggestion));
  }

  return issues;
}
