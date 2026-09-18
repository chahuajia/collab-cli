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
});
