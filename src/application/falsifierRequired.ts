import { isRouted } from "@/domain/entry/routed";
import { Issue } from "@/domain/validation/Issue";
import type { Entry } from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * `falsifier` 成为必填的**生效日**。
 *
 * @remarks
 * 在 `created >= 该日期` 的条目上，`falsifier` 必填。
 *
 * **为什么是日期而不是"全库计数基线"**：第一版实现用了一个绝对基线
 * （"缺 falsifier 的条目不得超过 115"）。它**在任何小于该基线的工作区里都是死的** ——
 * 包括全部测试 fixture、fork、以及任何新仓。一个只在作者本机才生效的规则，
 * 不是机制，是环境耦合。（写完当天就实测到了：scratch 工作区 1 条条目，
 * 1 <= 115，永远通过。）
 *
 * 日期截止则**跟着条目走**，与工作区大小无关：
 * 存量条目（created < 该日）豁免 —— 它们是在门槛生效前写的；
 * 新增条目必须填 —— 这就是要治的那个病。
 *
 * 为什么不是"一次填满 118 条"：`meta/interceptions.md` 的判据写着**不要编造**。
 * 批量凑出来的 falsifier 会让字段失去意义，比空着更坏。存量慢慢补。
 */
export const FALSIFIER_REQUIRED_SINCE = "2026-09-19";

/**
 * 已**入库**的 status —— 门槛只对它们生效。
 *
 * @remarks
 * `draft` / `proposed` 是**脚手架**，不是入库。
 * `collab new` 造的正是 draft：那一刻条目还是一具空骨架，
 * 而 falsifier 问的是"不读它会错什么"——**对空骨架答不出这个问题**，
 * 强行要求只会逼出编造，而 `meta/interceptions.md` 的判据写着"不要编造"。
 *
 * 入库（`draft → active`，ADR 是 `proposed → accepted`）才是做这个判断的时刻，
 * 也正好是 W5 流程发生的地方。
 *
 * 实测教训：本规则第一版对**所有**路由中条目生效，结果 `collab new` 造出的
 * 空条目立刻让 validate 变红 —— 13 个 "new → index → validate" 链路测试失败。
 * 门槛错位到"创建"而不是"入库"，就会把"该不该进库"的判断提前到
 * 还无法回答它的时刻。
 */
const ADMITTED_STATUSES: ReadonlySet<string> = new Set(["active", "accepted"]);

/**
 * 入库门槛：此日期之后**入库**的条目必须有 `falsifier`。
 *
 * @remarks
 * 判据（必须是**模仿类**反事实）：
 * "不读它，模型会照着**本地哪个模式**写错？"
 *
 * 反面：写成"模型不知道 X"不算 —— 称职的模型本来就知道，
 * 这一点已被 evolutionary 的 D 实验六跑证伪（见 `meta/pruning-policy`、`ADR-0011`）。
 */
export function falsifierRequired(
  entry: Entry,
  _context: RuleContext,
): readonly Issue[] {
  const fm = entry.frontmatter;
  if (!isRouted(fm)) return [];
  if (!ADMITTED_STATUSES.has(fm.status)) return [];
  if (fm.created < FALSIFIER_REQUIRED_SINCE) return [];

  const f = fm.falsifier;
  if (f !== undefined && f.trim().length > 0) return [];

  return [Issue.falsifierRequired(entry.path, fm.id, FALSIFIER_REQUIRED_SINCE)];
}
