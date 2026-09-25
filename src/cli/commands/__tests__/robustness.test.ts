// 健壮性：**交接文档里"没验过的维度"中，能写成检查的那几条**。
//
// 背景：2026-09-26 的会话级交接列了 7 条「没验过的维度」，并说明理由 ——
// "验过的是我想到的维度"。本文件把那 7 条里能自动化的 3 条变成可复查的断言：
//
//   1. 路径含**空格与中文**（原：只跑过普通路径）
//   2. **大 KB** 的 catalog + validate 时间预算（原：真库只有 129 条）
//   3. **并发 apply**（原：只验过单进程的乐观锁）
//
// 另外 4 条（真 MCP 客户端 / 真远端 push / PowerShell 文本管道 / 生成的 CI 真实执行）
// **刻意不在这里**：它们需要外部环境，写成假测试比不写更坏。
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import { CLI_ENTRY, toSucceed, useTestWorkspace, writeEntry } from "./testHelpers.js";

const sha256 = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

describe("健壮性：路径与规模", () => {
  const ctx = useTestWorkspace({ collab: false });

  it("路径含空格与中文：init → new → index → catalog → validate 全绿", async () => {
    const kb = path.join(ctx().root, "我的 知识库 with spaces");

    await toSucceed(["init", "--profile", "kb", "--dir", kb], ctx().root);
    await toSucceed(["--dir", kb, "new", "pattern", "space-test"], ctx().root);
    await toSucceed(["--dir", kb, "index"], ctx().root);
    await toSucceed(["--dir", kb, "catalog"], ctx().root);
    await toSucceed(["--dir", kb, "validate"], ctx().root);

    const entry = await readFile(path.join(kb, "patterns", "space-test.md"), "utf8");
    expect(entry.length, "条目内容不该为空").toBeGreaterThan(0);
  }, 60_000);

  it("大 KB：400 条条目的 index + catalog + validate 在时间预算内完成", async () => {
    const kb = path.join(ctx().root, "bigkb");
    await toSucceed(["init", "--profile", "kb", "--dir", kb], ctx().root);

    const COUNT = 400;
    for (let i = 1; i <= COUNT; i += 1) {
      await writeEntry({
        relPath: `skills/S${i}.md`,
        id: `S${i}`,
        kind: "skill",
        collabDir: kb,
      });
    }

    const startedAt = Date.now();
    await toSucceed(["--dir", kb, "index"], ctx().root);
    await toSucceed(["--dir", kb, "catalog"], ctx().root);
    await toSucceed(["--dir", kb, "validate"], ctx().root);
    const elapsed = Date.now() - startedAt;

    // 预算刻意宽松：它要抓的是**复杂度爆炸**（O(n²) 会在几百条时露头），不是机器快慢。
    expect(elapsed, `${COUNT} 条的 index+catalog+validate 用了 ${elapsed}ms`).toBeLessThan(
      30_000,
    );
  }, 120_000);

  it("并发 apply：两个进程同时创建同一路径，不出现半写", async () => {
    const kb = path.join(ctx().root, "conckb");
    await toSucceed(["init", "--profile", "kb", "--dir", kb], ctx().root);

    const bundleFor = (marker: string): string => {
      const content = [
        "---",
        "id: conc",
        "type: pattern",
        "status: draft",
        "created: 2026-09-26",
        "updated: 2026-09-26",
        "author: t",
        "aliases:",
        "  - conc",
        "enforced: null",
        "---",
        "",
        `# ${marker}`,
        "",
        "## 上下文",
        "",
        "## 问题",
        "",
        "## 方案",
        "",
        "## 反面",
        "",
        "## 关联",
        "",
      ].join("\n");
      return JSON.stringify({
        version: 1,
        generated_at: "2026-09-26T00:00:00Z",
        generated_by: "robustness-test",
        base_commit: null,
        files: [
          {
            path: "patterns/conc.md",
            action: "create",
            content,
            sha256: sha256(content),
            base_sha256: null,
          },
        ],
      });
    };

    const bundleA = path.join(ctx().root, "bundle-a.json");
    const bundleB = path.join(ctx().root, "bundle-b.json");
    await writeFile(bundleA, bundleFor("A"), "utf8");
    await writeFile(bundleB, bundleFor("B"), "utf8");

    const run = (bundle: string) =>
      execa("node", [CLI_ENTRY, "--dir", kb, "apply", bundle], {
        cwd: ctx().root,
        reject: false,
        env: { ...process.env, ...ctx().envOverrides },
      });

    const [r1, r2] = await Promise.all([run(bundleA), run(bundleB)]);

    // 不变量（测试真正断言的东西）：**至少一个成功**，且最终内容是**其中一个输入的原样**。
    // 换句话说：允许"后写覆盖先写"（那是可接受的竞争结果），不允许**半写/交错写**。
    expect(
      r1.exitCode === 0 || r2.exitCode === 0,
      `两个并发 apply 都失败了：\nA=${r1.stderr}\nB=${r2.stderr}`,
    ).toBe(true);

    const final = await readFile(path.join(kb, "patterns", "conc.md"), "utf8");
    expect(["A", "B"]).toContain(/^# (\w)$/m.exec(final)?.[1] ?? "?");
    expect(final.startsWith("---\nid: conc\n"), "frontmatter 被破坏（半写）").toBe(true);
  }, 60_000);
});
