// scripts/lib/freshness.ts

/**
 * 工作记忆新鲜度的**判据**（纯函数，不碰文件系统、不起 git 进程）。
 *
 * @remarks
 * 从 `working-memory/check-freshness.mjs` 里拆出来的。那个脚本是 `.mjs`，
 * 而且**不在 `scripts/` 下** —— 于是它同时逃出 `tsc`、`eslint`、`vitest include`：
 * 一条门禁的判据本身没有任何检查。这正是 `scripts/README.md` 第 1、3 条
 * 已经写成教训的那件事，它是**最后一处漏网**。
 *
 * 拆法沿用 `skip-accounting.ts`：判定在这里（有单测），
 * 起进程、读写文件、打印在 `scripts/check-freshness.ts`。
 */

/** 一条仓的探测结果 —— 由 I/O 侧填好，判据只看它。 */
export interface RepoProbe {
  readonly name: string;
  /** 仓目录（仅用于打印） */
  readonly dir: string;
  /** 目录可达且是个 git 仓 */
  readonly reachable: boolean;
  readonly head: string;
  /** 基线 commit（`.attested.json` 里记的那个）；没有基线时为 `null` */
  readonly from: string | null;
  /** 自上次对账以来的**产品提交数**；没有基线时为 `null` */
  readonly delta: number | null;
  /** 没有基线时的回退判据：最后一次产品代码提交的时间；取不到时为 `null` */
  readonly lastCommitAt: Date | null;
  /** 有基线，但那个 commit 已不可达（分支被重写 / rebase 过） */
  readonly baselineLost: boolean;
}

/** 一条"不新鲜"的理由。分门别类，因为三种理由的下一步动作不同。 */
export type StaleKind = "unreachable" | "baseline-lost" | "unknown" | "delta" | "no-baseline";

export interface StaleReason {
  readonly name: string;
  readonly kind: StaleKind;
  /** `kind === "delta"` 时的提交数 */
  readonly delta: number | null;
  /** 基准 commit（`kind === "delta"`） */
  readonly from: string | null;
}

export interface FreshnessVerdict {
  readonly fresh: boolean;
  readonly stale: readonly StaleReason[];
}

/**
 * 从 README 里读出 `**更新**：YYYY-MM-DD HH:MM`。
 *
 * @remarks
 * 读不到返回 `null` —— 调用方**不能**把它当成"新鲜"：时间戳是人的签名，
 * 它不在就等于这份记忆没人签过。
 */
export function parseUpdatedAt(readme: string): Date | null {
  // **宽进**：小时允许一位数（`7:59` 是人手写的自然写法），时刻的分隔符全角半角都收。
  // 2026-09-26 实测：签名写成 `**更新**：2026-09-26 7:59`，旧正则要求 `\d{2}` → 报
  // "找不到时间戳"，而**那一行明明就在那里**。人手写签名这件事不该有关卡；
  // 机器这边的输出**一律规范化**成 `YYYY-MM-DD HH:MM`（见 check-freshness 的 `updatedRaw`）。
  const m =
    /\*\*更新\*\*\s*[：:]\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2})\s*[：:]\s*(\d{2})/.exec(readme);
  if (m === null) return null;
  const [, y, mo, d, h, mi] = m;
  if (
    y === undefined ||
    mo === undefined ||
    d === undefined ||
    h === undefined ||
    mi === undefined
  ) {
    return null;
  }
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (Number.isNaN(dt.getTime())) return null;

  // **回读校验**：`new Date(2026, 12, 45)` 不会报错，它会**静默滚动**成 2027 年 ——
  // 于是签名那行写错了月份/日期，检查反而"看起来通过了"。
  // （这条是单测抓出来的：`2026-13-45` 原本会通过。）
  const roundTrip =
    dt.getFullYear() === Number(y) &&
    dt.getMonth() === Number(mo) - 1 &&
    dt.getDate() === Number(d) &&
    dt.getHours() === Number(h) &&
    dt.getMinutes() === Number(mi);
  return roundTrip ? dt : null;
}

/**
 * 判定：这份工作记忆还配得上被信任吗？
 *
 * @remarks
 * 两代判据并存，不是历史包袱而是兼容：
 *
 * | 基线 | 判据 |
 * | :--- | :--- |
 * | 有（`.attested.json`） | 比**增量**：`HEAD..HEAD` 里有几个产品提交。报"自上次对账以来 3 个提交"，不是"你过期了" —— 前者可执行，后者只是责备 |
 * | 没有 | 回退比**时间**：上次产品提交是否晚于 README 的时间戳 |
 *
 * "不可判定"一律算**不新鲜**（宁可红）：目录不可达、git 报错、基准丢了都归这类。
 * 把它们当成"通过"，正是本仓删过两次的那种假绿灯。
 */
export function verdictOf(
  probes: readonly RepoProbe[],
  readmeUpdatedAt: Date,
): FreshnessVerdict {
  const stale: StaleReason[] = [];

  for (const p of probes) {
    if (!p.reachable) {
      stale.push({ name: p.name, kind: "unreachable", delta: null, from: null });
      continue;
    }
    if (p.baselineLost) {
      stale.push({ name: p.name, kind: "baseline-lost", delta: null, from: p.from });
      continue;
    }
    if (p.delta !== null) {
      if (p.delta > 0) {
        stale.push({ name: p.name, kind: "delta", delta: p.delta, from: p.from });
      }
      continue;
    }
    if (p.lastCommitAt === null) {
      stale.push({ name: p.name, kind: "unknown", delta: null, from: null });
      continue;
    }
    if (p.lastCommitAt.getTime() > readmeUpdatedAt.getTime()) {
      stale.push({ name: p.name, kind: "no-baseline", delta: null, from: null });
    }
  }

  return { fresh: stale.length === 0, stale };
}
