import { Issue } from "@/domain/validation/Issue";
import { fileNameOf, refersToIdentity } from "@/domain/validation/resolvesRef";
import { extractLinks } from "@/domain/validation/rules/_shared";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * 路由面不得指向**已毕业**的条目。
 *
 * @remarks
 * 毕业（`enforced` 非空）意味着条目已退出 `catalog.json` —— 它的内容
 * 已经活在某个测试/工具里，**不需要再被读**（见 [[ADR-0011]]）。
 *
 * 而**路由面**（`AGENTS.md` 症状表、`domains/architecture/_index.md` 的"症状 → 先读"表）
 * 是"我该读哪条"的映射。它若还指向一条毕业条目，就是在收一份
 * **读了没用**的税 —— 这正是 [[patterns/policy-without-mechanism]] 说的
 * "加规则反而更慢"里最隐蔽的一种：不是规则错了，是规则的**入口**过期了。
 *
 * **只管路由面**，不管 `_index.md` 的条目表 —— 索引保留毕业条目是**对的**：
 * 索引回答"库里有什么"，路由回答"现在该读什么"。两条轴。
 *
 * 判定是**文本级**的：路由面是散文表格，没有结构化标记，所以只能看
 * "这一行里有没有指向某条已毕业条目的引用"。用行做粒度（而非整文件），
 * 这样标注可以就近写在同一行（`已毕业 → <产物>`）。
 *
 * **只查表格行**（`| … | … |`）。判据是形状，不是文件位置：
 * 路由的本质是**映射**（"遇到 X → 读 Y"），而表格行才是映射；
 * 文件末尾的 `## 关联` 是一串平铺的双链，那是**关联**不是路由 ——
 * 它回答"这条和谁有关"，不回答"现在该读什么"，毕业后仍应保留。
 *
 * 这个区分不是凑出来的：`AGENTS.md` 同时有症状表（行）和关联区（串），
 * 只有按形状区分才能既不漏报路由、又不误伤关联。
 */
export function routingToGraduated(context: RuleContext): readonly Issue[] {
  const graduated = graduatedEntries(context);
  if (graduated.length === 0) return [];

  const issues: Issue[] = [];
  const surfaces = collectSurfaces(context);

  for (const [path, content] of surfaces) {
    for (const raw of content.split("\n")) {
      issues.push(...issuesForLine(path, raw, graduated));
    }
  }

  return issues;
}

/** 一条已毕业条目：id、文件名、enforced 路径。 */
interface Graduated {
  readonly id: string;
  readonly fileName: string;
  readonly enforced: string;
}

function graduatedEntries(context: RuleContext): readonly Graduated[] {
  const out: Graduated[] = [];
  for (const entry of context.allEntries) {
    const fm = entry.frontmatter;
    if (fm.enforced === null) continue;
    out.push({ id: fm.id, fileName: fileNameOf(entry.path), enforced: fm.enforced });
  }
  return out;
}

/** 路由面 = 根文档 + kind 目录之外的 `_index.md`。 */
function collectSurfaces(context: RuleContext): ReadonlyMap<string, string> {
  const surfaces = new Map<string, string>();
  for (const [rel, content] of context.rootDocs ?? []) surfaces.set(rel, content);
  for (const [rel, content] of context.extraDocs ?? []) surfaces.set(rel, content);
  return surfaces;
}

/**
 * 一行里是否有指向已毕业条目的引用，且**没有标注**。
 *
 * @remarks
 * "标注过"的判据刻意宽松（含"已毕业"三字即可）：本规则要抓的是
 * **忘了更新**，不是文风。宁可漏报，不要逼着人为了过检查去凑措辞。
 */
function issuesForLine(
  path: string,
  line: string,
  graduated: readonly Graduated[],
): readonly Issue[] {
  const issues: Issue[] = [];

  // 只查表格行 —— 那是"症状 → 条目"的映射形态。
  // 平铺的双链列表（`## 关联`）是关联不是路由，毕业后仍该保留。
  if (!/^\s*\|/.test(line)) return [];

  // 行级豁免：任何提到"已毕业"的行都视为已标注。
  if (line.includes("已毕业")) return [];

  for (const ref of extractLinks(line)) {
    // **必须同时认 id 和文件名两种锚**，且复用 `refersToIdentity` ——
    // 这是全项目唯一的引用匹配规则。
    //
    // 实测教训：本规则第一版只比对 id（`S13`），而症状表写的是
    // `[[S13-Smart-Constructor]]`（文件名形式）—— 于是它**漏掉了自己存在的理由**，
    // 却因为单元测试用的是 id 形式而全绿。第二份匹配规则 = 第二个 bug 源。
    for (const g of graduated) {
      if (!refersToIdentity(ref, g.id, g.fileName)) continue;
      issues.push(Issue.routingToGraduated(path, g.id, g.enforced));
    }
  }

  return issues;
}
