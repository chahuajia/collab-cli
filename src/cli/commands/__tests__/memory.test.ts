import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  toFail,
  toSucceed,
  useTestWorkspace,
} from "@/cli/commands/__tests__/testHelpers";

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
});
