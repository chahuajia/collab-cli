import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  toFail,
  toSucceed,
  useTestWorkspace,
  writeEntry,
  writeIndex,
} from "@/cli/commands/__tests__/testHelpers";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ctx = useTestWorkspace();

const WM = "working-memory";

function progress(updated: string): string {
  return `# Progress\n\n**更新**：${updated}\n\n## 当前阶段\n\nx\n`;
}

async function writeMemory(relPath: string, content: string): Promise<void> {
  const full = path.join(ctx().root, WM, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

describe("collab memory", () => {
  it("passes when current-state files are fresh", async () => {
    await writeMemory("tasks/t/progress.md", progress(today()));
    await toSucceed(["memory"], ctx().root, ctx().envOverrides);
  });

  it("reports a stale current-state file", async () => {
    await writeMemory("tasks/t/progress.md", progress("2020-01-01"));

    const result = await toFail(["memory"], ctx().root, ctx().envOverrides);

    expect(result.stderr).toContain("progress.md");
    expect(result.stderr).toContain("last updated");
  });

  it("reports a current-state file with no date (cannot be checked)", async () => {
    await writeMemory("tasks/t/anchors.md", "# Anchors\n\n没有日期\n");

    const result = await toFail(["memory"], ctx().root, ctx().envOverrides);
    expect(result.stderr).toContain("no `更新：YYYY-MM-DD` line");
  });

  it("does NOT require dates on append-only logs (decisions / parking-lot / spec)", async () => {
    await writeMemory("tasks/t/progress.md", progress(today()));
    await writeMemory("decisions.md", "# Decisions\n\n| 日期 | 决策 |\n| :- | :- |\n");
    await writeMemory("parking-lot.md", "# 未决项\n");
    await writeMemory("tasks/t/spec.md", "# Spec\n");

    await toSucceed(["memory"], ctx().root, ctx().envOverrides);
  });

  it("ignores _archive (snapshots never expire)", async () => {
    await writeMemory("tasks/t/progress.md", progress(today()));
    await writeMemory("tasks/t/_archive/2020-01-01-old.md", progress("2020-01-01"));

    await toSucceed(["memory"], ctx().root, ctx().envOverrides);
  });

  it("errors when there is no working-memory directory", async () => {
    const result = await toFail(["memory"], path.parse(ctx().root).root, ctx().envOverrides);
    expect(result.stderr).toContain("not found");
  });

  describe("WM 新鲜度压测（round-13）", () => {
    it("C1: reports every stale current-state file", async () => {
      await writeMemory("tasks/a/progress.md", progress("2020-01-01"));
      await writeMemory("tasks/b/anchors.md", "# Anchors\n\n**更新**：2020-01-01\n\nx\n");
      await writeMemory("README.md", `# WM\n\n**更新**：2020-01-01\n\nx\n`);

      const result = await toFail(["memory"], ctx().root, ctx().envOverrides);
      expect(result.stderr).toContain("tasks/a/progress.md");
      expect(result.stderr).toContain("tasks/b/anchors.md");
      expect(result.stderr).toContain("README.md");
    });

    it("C2: --max-age 0 rejects yesterday", async () => {
      const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString().slice(0, 10);
      await writeMemory("tasks/t/progress.md", progress(yesterday));

      const result = await toFail(
        ["memory", "--max-age", "0"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(result.stderr).toContain("progress.md");
    });

    it("C3: fixing stale files makes memory pass", async () => {
      await writeMemory("tasks/t/progress.md", progress("2020-01-01"));

      await toFail(["memory"], ctx().root, ctx().envOverrides);
      await writeMemory("tasks/t/progress.md", progress(today()));
      await toSucceed(["memory"], ctx().root, ctx().envOverrides);
    });

    it("C4: memory failure is orthogonal to COLLABORATION validate", async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir: ctx().collabDir,
      });
      await writeIndex(ctx().collabDir, "skills", ["S1"]);
      await writeMemory("tasks/t/progress.md", progress("2020-01-01"));

      await toFail(["memory"], ctx().root, ctx().envOverrides);
      await toSucceed(["validate"], ctx().root, ctx().envOverrides);
    });
  });

  // ── 假阳性收窄 ─────────────────────────────────────────
  // 嵌套 README 是**结构文档**，不声称当前状态。把它们一起查会稳定产假阳性，
  // 而假阳性会让整个仪器被无视（"多报 → 没人看"）。

  describe("嵌套 README 不算当前状态", () => {
    it("E1: agents/*/README.md 没有日期 → 不报", async () => {
      await writeMemory("agents/fe/README.md", "# FE agent\n\n角色说明，无日期\n");
      await writeMemory("tasks/t/contracts/README.md", "# 契约\n\n无日期\n");
      await toSucceed(["memory"], ctx().root, ctx().envOverrides);
    });

    it("E2: 根 README.md 没有日期 → 仍报（那是真·状态文件）", async () => {
      await writeMemory("README.md", "# WM\n\n没有更新行\n");
      const r = await toFail(["memory"], ctx().root, ctx().envOverrides);
      expect(r.stdout + r.stderr).toContain("README.md");
    });
  });

  // ── 候选池：有入口没出口的那类文件 ──────────────────────
  // 约定是「记候选 → W4 通过后 harvest」，但后半句没有触发机制。
  // 实测：连加几轮候选却从未跑过 W4。这里给它装一根线。

  describe("候选池龄期（W4 触发）", () => {
    function candidates(rows: readonly string[]): string {
      return [
        "# 候选",
        "",
        "| 日期 | 条目 | 拦住了什么 | 证据 | 状态 |",
        "| :--- | :--- | :--- | :--- | :--- |",
        ...rows,
        "",
      ].join("\n");
    }

    it("D1: 新鲜的待办候选 → 通过", async () => {
      await writeMemory(
        "interceptions-candidates.md",
        candidates([`| ${today()} | [[patterns/a]] | x | abc123 | 待 W4 |`]),
      );
      await toSucceed(["memory"], ctx().root, ctx().envOverrides);
    });

    it("D2: 挂了太久的待办候选 → 失败（这就是 W4 的触发）", async () => {
      await writeMemory(
        "interceptions-candidates.md",
        candidates([`| 2020-01-01 | [[patterns/old]] | x | abc123 | 待 W4 |`]),
      );
      const r = await toFail(["memory"], ctx().root, ctx().envOverrides);
      expect(r.stdout + r.stderr).toContain("未 harvest");
      expect(r.stdout + r.stderr).toContain("W4");
    });

    it("D3: 已 harvest 的旧行 → 通过（历史正常，不该报）", async () => {
      await writeMemory(
        "interceptions-candidates.md",
        candidates([`| 2020-01-01 | [[patterns/done]] | x | abc123 | harvested |`]),
      );
      await toSucceed(["memory"], ctx().root, ctx().envOverrides);
    });

    it("D4: 只报过期的那个，不报新鲜的", async () => {
      await writeMemory(
        "interceptions-candidates.md",
        candidates([
          `| 2020-01-01 | [[patterns/old]] | x | a | 待 W4 |`,
          `| ${today()} | [[patterns/new]] | y | b | 待 W4 |`,
        ]),
      );
      const r = await toFail(["memory"], ctx().root, ctx().envOverrides);
      expect(r.stdout + r.stderr).toContain("patterns/old");
      expect(r.stdout + r.stderr).not.toContain("patterns/new");
    });
  });
});
