import { isRouted } from "@/domain/entry/routed";
import { fileNameOf, refersToIdentity } from "@/domain/validation/resolvesRef";
import { extractLinks, lastSegmentOf } from "@/domain/validation/rules/_shared";
import type { Entry } from "@/domain/entry/Entry";
import type { EntryId } from "@/domain/entry/EntryId";

/**
 * 图中的一个节点：条目，或一篇根文档。
 *
 * @remarks
 * 根文档（`ROOT.md` / `AGENTS.md` / `README.md`）是**种子** ——
 * 它们回答"从入口出发能走到哪"，所以必须在图里，但不在候选里。
 */
export interface ReachNode {
  readonly id: EntryId;
  readonly fileName: string;
  readonly body: string;
}

/** 一条候选：孤岛条目 + 为什么它是候选。 */
export interface UnreachableEntry {
  readonly id: EntryId;
  readonly path: string;
  /** 指向它的条目数（入度）。0 = 没人指向它。 */
  readonly inbound: number;
  /** 它指向的条目数（出度）。0 = 它谁也没指向。 */
  readonly outbound: number;
}

/**
 * 计算**不与任何根文档连通**的条目。
 *
 * @remarks
 * 这是 `meta/pruning-policy` 里那条"标记-清除"的可执行版本 —— 它在此之前
 * **从未实现过**（`meta/known-gaps` 记着"有政策、缺机制"）。
 *
 * ### 判据（2026-09-19 裁决，见 pruning-policy 的"读法歧义"一节）
 *
 * 政策原文说种子是"`ROOT.md` / `_index.md` / 被引用条目"。**字面照做是空操作**：
 * `checkIndexForward` 保证每条目都在自己的 `_index.md` 里，于是同一条索引下的
 * 条目互相连通 —— 实测扫出 **0 条**（脚本 `working-memory/reach-check.cjs` 可重跑）。
 *
 * 所以：
 * - **节点** = 条目 + 根文档；**`_index.md` 不进图** —— 索引成员资格是另一条
 *   已被强制的轴（`MISSING_FROM_INDEX`），混进来会让可达性变成同义反复。
 * - **边** = `[[…]]` 引用，**无向**。政策要抓的是"没人指向、也没指向谁"
 *   （孤岛），那正是**弱连通分量**的定义。
 * - **种子** = 根文档。
 *
 * ### 为什么是无向而不是有向
 *
 * 有向读法实测扫出 24 条，但其中包含 `A20`/`A21` 这类**明显还活着**的条目
 * （它们只是没被根文档直接引用）。有向可达性会被"条目普遍向上引用枢纽"
 * 这个结构打偏。无向读法给出 1 条，且那一条经人工核对**确实是孤岛**。
 * 宁可少报（人再审），不要多报（人被淹没后就不看了）。
 *
 * ### 已毕业的条目**必须是节点**（哪怕它已退出路由索引）
 *
 * 实测踩到的假阳性（2026-09-19）：第一版把 `isRouted` 的过滤放在了建图之前，
 * 于是已毕业的 `S13` 不在图上 —— 而 `S20`/`S24`/`S25`/`S28` 都指向它，
 * 边成了悬空的，那 4 条被误报成孤岛。
 *
 * **退出路由索引 ≠ 从图上消失。** 毕业的条目文件仍在、仍可链接、仍是活的引用目标
 * （`retire` 的设计就是"除名不删文件"）。建图要用**全部**条目；
 * `isRouted` 只用来过滤**候选输出**。
 *
 * ### 它**不是**删除判据
 *
 * 孤岛 ≠ 该删。新写的条目还没轮到被引用，也是"孤岛"。
 * 调用方应叠加**宽限期**（`created` 太新的不计入）再交给人判断 ——
 * 见 `collab retire --candidates`。
 */
export function findUnreachable(
  entries: readonly Entry[],
  rootDocs: ReadonlyMap<string, string>,
  options: { readonly now?: string; readonly graceDays?: number } = {},
): readonly UnreachableEntry[] {
  const nodes: ReachNode[] = entries.map((e) => ({
    id: e.frontmatter.id,
    fileName: fileNameOf(e.path),
    body: e.body,
  }));

  const pathOf = new Map(entries.map((e) => [e.frontmatter.id, e.path]));
  const createdOf = new Map(entries.map((e) => [e.frontmatter.id, e.frontmatter.created]));

  /** 引用解析成节点 id（id 与文件名两种锚都认 —— 复用唯一的匹配规则）。 */
  const resolve = (ref: string): string | null => {
    const last = lastSegmentOf(ref);
    for (const n of nodes) {
      if (refersToIdentity(ref, n.id, n.fileName) || last === n.fileName) return n.id;
    }
    return null;
  };

  // 无向邻接表
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)?.add(b);
    adj.get(b)?.add(a);
  };

  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();
  for (const e of entries) {
    inbound.set(e.frontmatter.id, 0);
    outbound.set(e.frontmatter.id, 0);
  }

  for (const n of nodes) {
    for (const ref of extractLinks(n.body)) {
      const target = resolve(ref);
      if (target === null || target === n.id) continue;
      link(n.id, target);
      outbound.set(n.id, (outbound.get(n.id) ?? 0) + 1);
      inbound.set(target, (inbound.get(target) ?? 0) + 1);
    }
  }

  // 根文档 → 条目（根文档本身不参与候选）
  const seeds: string[] = [];
  for (const [rel, content] of rootDocs) {
    seeds.push(rel);
    for (const ref of extractLinks(content)) {
      const target = resolve(ref);
      if (target === null) continue;
      link(rel, target);
      inbound.set(target, (inbound.get(target) ?? 0) + 1);
    }
  }

  // BFS（无向 = 弱连通）
  const seen = new Set(seeds);
  const queue = [...seeds];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === undefined) break;
    for (const nb of adj.get(cur) ?? []) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      queue.push(nb);
    }
  }

  const graceDays = options.graceDays ?? 0;
  const now = options.now;

  const out: UnreachableEntry[] = [];
  for (const e of entries) {
    const id = e.frontmatter.id;
    if (seen.has(id)) continue;
    // 已退役的条目**不作为候选** —— 它们已经退出路由索引，没什么可退的。
    // 但它们**仍在图上**（见上面的注释），否则会制造假阳性。
    if (!isRouted(e.frontmatter)) continue;
    if (isTooNew(createdOf.get(id), now, graceDays)) continue;
    out.push({
      id,
      path: pathOf.get(id) ?? "",
      inbound: inbound.get(id) ?? 0,
      outbound: outbound.get(id) ?? 0,
    });
  }

  // 越孤立越靠前（入度 + 出度 升序）
  out.sort((a, b) => a.inbound + a.outbound - (b.inbound + b.outbound));
  return out;
}

/**
 * 宽限期：`created` 太新的条目不算候选。
 *
 * @remarks
 * 新写的条目还没轮到被引用，"孤岛"是它的**正常状态**，不是问题。
 * 没有这一层，扫出来的是一串假阳性 —— 而假阳性会让人干脆不看这个报告。
 */
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;

function isTooNew(
  created: string | undefined,
  now: string | undefined,
  graceDays: number,
): boolean {
  if (graceDays <= 0 || created === undefined || now === undefined) return false;
  const createdMs = Date.parse(`${created}T00:00:00Z`);
  const nowMs = Date.parse(`${now}T00:00:00Z`);
  if (Number.isNaN(createdMs) || Number.isNaN(nowMs)) return false;
  return (nowMs - createdMs) / MS_PER_DAY < graceDays;
}
