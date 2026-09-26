import { describe, expect, it } from "vitest";
import { parseUpdatedAt, verdictOf, type RepoProbe } from "../lib/freshness.js";

/**
 * 工作记忆新鲜度的**判据**测试。
 *
 * @remarks
 * 判据原先埋在 `working-memory/check-freshness.mjs` 里（`.mjs`、在 `scripts/` 之外，
 * 同时逃出 tsc / eslint / vitest）——**一条门禁的判据自己没有任何检查**。
 * 这里只测判定，不测 I/O：起 git、读写 `.attested.json` 在 `check-freshness.ts`。
 *
 * **它不查什么**（免得"CI 绿"被读成"记忆是真的"）：
 * 不查 README 的时间戳是不是**人**签的、不查 `.attested.json` 被谁写过、
 * 不查各仓 git 历史的完整性。它只查"事实与声明是否对得上"。
 */
function probe(over: Partial<RepoProbe> & { name: string }): RepoProbe {
  return {
    dir: `/repos/${over.name}`,
    reachable: true,
    head: "abc1234",
    from: null,
    delta: null,
    lastCommitAt: null,
    baselineLost: false,
    baselineDiverged: false,
    ...over,
  };
}

const README_AT = new Date(2026, 8, 25, 21, 0); // 2026-09-25 21:00
const LATER = new Date(2026, 8, 26, 9, 0);
const EARLIER = new Date(2026, 8, 25, 18, 0);

describe("parseUpdatedAt", () => {
  it("认全角冒号（本仓 README 的写法）", () => {
    expect(parseUpdatedAt("# x\n**更新**：2026-09-25 21:00  \n")?.getTime()).toBe(README_AT.getTime());
  });

  it("也认半角冒号", () => {
    expect(parseUpdatedAt("**更新**: 2026-09-25 21:00")?.getTime()).toBe(README_AT.getTime());
  });

  // 2026-09-26 实测：签名写成 `7:59`（小时一位数），旧正则要求 `\d{2}` → 报"找不到"。
  // 人手写签名不该有关卡；机器侧的输出一律规范化。
  it("小时可以是一位数（`7:59`）", () => {
    const t = parseUpdatedAt("**更新**：2026-09-26 7:59");
    expect(t?.getUTCFullYear()).toBe(2026);
    expect(t?.getHours()).toBe(7);
    expect(t?.getMinutes()).toBe(59);
  });

  it("时刻也用全角冒号（`7：59`）也能读", () => {
    const t = parseUpdatedAt("**更新**：2026-09-26 7：59");
    expect(t?.getHours()).toBe(7);
    expect(t?.getMinutes()).toBe(59);
  });

  it("没有那一行 → null（**不是**新鲜）", () => {
    expect(parseUpdatedAt("# 没有时间戳的 README")).toBeNull();
  });

  it("日期不合法 → null", () => {
    expect(parseUpdatedAt("**更新**：2026-13-45 99:99")).toBeNull();
  });
});

describe("verdictOf", () => {
  it("有基线：增量为 0 → 新鲜", () => {
    const v = verdictOf([probe({ name: "collaboration", from: "d498eb1", delta: 0 })], README_AT);
    expect(v.fresh).toBe(true);
    expect(v.stale).toEqual([]);
  });

  it("有基线：增量 > 0 → 不新鲜，并带上数字与基准", () => {
    const v = verdictOf([probe({ name: "collab-cli", from: "b305b32", delta: 13 })], README_AT);
    expect(v.fresh).toBe(false);
    expect(v.stale).toEqual([
      { name: "collab-cli", kind: "delta", delta: 13, from: "b305b32" },
    ]);
  });

  it("仓库不可达 → 不新鲜（不可达是硬失败，不是跳过）", () => {
    const v = verdictOf([probe({ name: "evolutionary", reachable: false })], README_AT);
    expect(v.stale.map((s) => s.kind)).toEqual(["unreachable"]);
  });

  it("基准 commit 丢了（rebase）→ 不新鲜", () => {
    const v = verdictOf(
      [probe({ name: "collab-cli", from: "gone123", baselineLost: true })],
      README_AT,
    );
    expect(v.stale.map((s) => s.kind)).toEqual(["baseline-lost"]);
  });

  // 2026-09-26 实测的假绿：`--attest` 时在 topic 分支（HEAD=ac7aa6c），之后切回更旧的 main。
  // `rev-list --count ac7aa6c..HEAD` 返回 0 → 旧逻辑报"0 个提交，新鲜"，
  // 而账本覆盖的**是另一条分支**。判据补了"基准必须是当前 HEAD 的祖先"。
  it("基准不在当前分支上（切分支/回退）→ 不新鲜（哪怕增量算出来是 0）", () => {
    const v = verdictOf(
      [probe({ name: "evolutionary", from: "ac7aa6c", baselineDiverged: true })],
      README_AT,
    );
    expect(v.fresh).toBe(false);
    expect(v.stale).toEqual([
      { name: "evolutionary", kind: "diverged", delta: null, from: "ac7aa6c" },
    ]);
  });

  it("无基线：最后一次产品提交晚于 README → 不新鲜", () => {
    const v = verdictOf([probe({ name: "collab-cli", lastCommitAt: LATER })], README_AT);
    expect(v.stale.map((s) => s.kind)).toEqual(["no-baseline"]);
  });

  it("无基线：最后一次产品提交早于 README → 新鲜", () => {
    const v = verdictOf([probe({ name: "collab-cli", lastCommitAt: EARLIER })], README_AT);
    expect(v.fresh).toBe(true);
  });

  it("无基线且拿不到提交时间 → 不新鲜（不可判定 ≠ 通过）", () => {
    const v = verdictOf([probe({ name: "collab-cli", lastCommitAt: null })], README_AT);
    expect(v.stale.map((s) => s.kind)).toEqual(["unknown"]);
  });

  it("三仓混合：只有一处不新鲜，也要红", () => {
    const v = verdictOf(
      [
        probe({ name: "collab-cli", from: "b305b32", delta: 0 }),
        probe({ name: "collaboration", from: "d498eb1", delta: 10 }),
        probe({ name: "evolutionary", reachable: false }),
      ],
      README_AT,
    );
    expect(v.fresh).toBe(false);
    expect(v.stale.map((s) => s.name)).toEqual(["collaboration", "evolutionary"]);
  });
});
