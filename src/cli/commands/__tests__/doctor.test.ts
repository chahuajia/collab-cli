import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import {
  cleanupWorkspace,
  CLI_ENTRY,
  createWorkspace,
  type WorkspaceContext,
} from "./testHelpers.js";

/**
 * `collab doctor` —— **接线还在不在**。
 *
 * @remarks
 * 它不查内容对错（那是 `validate` 的事），只查四件事接没接上：
 * 工作区能定位 / 校验过 / **入口点名工具** / 有 git。
 *
 * 起因（2026-10-06 实测）：某新项目 agent 整段会话 `collab` 用了 0 次 ——
 * 入口只说"读什么"，一个字没提工具。doctor 把这条变成**能红的一行**。
 */
async function runCli(args: string[], ctx: WorkspaceContext) {
  return execa("node", [CLI_ENTRY, ...args], {
    cwd: ctx.root,
    reject: false,
    env: { ...process.env, ...ctx.envOverrides },
  });
}

describe("collab doctor", () => {
  it("入口点名了工具 + 校验过 → 全绿，exit 0", async () => {
    const ctx = await createWorkspace();
    try {
      await writeFile(
        path.join(ctx.root, "AGENTS.md"),
        "# AGENTS.md\n\n验收：`npx --yes @chahuajia/collab-cli --dir <KB> validate`\n",
        "utf8",
      );

      const r = await runCli(["doctor", "--dir", "."], ctx);
      expect(r.exitCode, r.stderr).toBe(0);
      expect(r.stdout).toContain("入口");
      expect(r.stdout).toContain("点名了工具");
      expect(r.stdout).toContain("ok 接线都在");
    } finally {
      await cleanupWorkspace(ctx.root);
    }
  });

  it("入口**没提** collab → 出声（warning）但 exit 0，并给出该补的那一行", async () => {
    const ctx = await createWorkspace();
    try {
      await writeFile(path.join(ctx.root, "AGENTS.md"), "# AGENTS.md\n\n只写读什么。\n", "utf8");

      const r = await runCli(["doctor", "--dir", "."], ctx);
      expect(r.exitCode, r.stderr).toBe(0);
      expect(r.stdout).toContain("没有提到 collab 命令");
      expect(r.stdout).toContain("@chahuajia/collab-cli");
    } finally {
      await cleanupWorkspace(ctx.root);
    }
  });

  it("定位不到工作区 → 报错 exit 1，并给出 --dir 的写法", async () => {
    const ctx = await createWorkspace({ collab: false, git: false });
    try {
      const r = await runCli(["doctor"], ctx);
      expect(r.exitCode).toBe(1);
      expect(r.stdout).toContain("工作区");
      expect(r.stdout).toContain("--dir");
    } finally {
      await cleanupWorkspace(ctx.root);
    }
  });
});
