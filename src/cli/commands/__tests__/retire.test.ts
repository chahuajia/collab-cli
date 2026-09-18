import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EntryKindValues } from "@/domain/entry/types";
import {
  toFail,
  toSucceed,
  useTestWorkspace,
  writeEntry,
  writeIndex,
} from "./testHelpers";

const ctx = useTestWorkspace();

/** 读一条条目文件的绝对路径。 */
function abs(rel: string): string {
  return path.join(ctx().collabDir, rel);
}

/** 建一条 active 的 pattern，并在 _index.md 里登记。 */
async function seedPattern(id: string): Promise<void> {
  await writeEntry({
    relPath: `patterns/${id}.md`,
    id,
    kind: EntryKindValues.Pattern,
    status: "active",
    collabDir: ctx().collabDir,
  });
  await writeIndex(ctx().collabDir, "patterns", [id]);
}

describe("collab retire", () => {
  it("R1: --dormant 把 status 改为 dormant", async () => {
    await seedPattern("stale-entry");

    await toSucceed(
      ["retire", "stale-entry", "--dormant", "--reason", "重复: 与另一条语义重叠"],
      ctx().root,
      ctx().envOverrides,
    );

    const content = await readFile(abs("patterns/stale-entry.md"), "utf8");
    expect(content).toContain("status: dormant");
  });

  it("R2: 退役 = 退出索引，**不是删除** —— 文件仍在", async () => {
    await seedPattern("stale-entry");

    await toSucceed(
      ["retire", "stale-entry", "--dormant", "--reason", "过时: 结论已被推翻"],
      ctx().root,
      ctx().envOverrides,
    );

    // pruning-policy：删除 = 退出索引，git 保留基因。
    const content = await readFile(abs("patterns/stale-entry.md"), "utf8");
    expect(content).toContain("id: stale-entry");
  });

  it("R3: 缺 --reason 被拒绝（每个修剪决策要写一句为什么）", async () => {
    await seedPattern("stale-entry");

    const result = await toFail(
      ["retire", "stale-entry", "--dormant"],
      ctx().root,
      ctx().envOverrides,
    );

    expect(result.stderr + result.stdout).toContain("--reason");
  });

  it("R4: 不给退役路径（--dormant/--enforced）被拒绝", async () => {
    await seedPattern("stale-entry");

    const result = await toFail(
      ["retire", "stale-entry", "--reason", "过时: x"],
      ctx().root,
      ctx().envOverrides,
    );

    expect(result.stderr + result.stdout).toContain("--dormant");
  });

  it("R5: --enforced 缺 --confirm 被拒绝（毕业是更高的不可逆性）", async () => {
    await seedPattern("live-entry");

    const result = await toFail(
      [
        "retire",
        "live-entry",
        "--enforced",
        "src/test/SomeTest.java",
        "--reason",
        "已毕业: 测试固化",
      ],
      ctx().root,
      ctx().envOverrides,
    );

    expect(result.stderr + result.stdout).toContain("--confirm");
  });

  it("R6: --enforced --confirm 写 enforced，且 **status 不动**（两条轴）", async () => {
    await seedPattern("live-entry");

    await toSucceed(
      [
        "retire",
        "live-entry",
        "--enforced",
        // 形态必须是 `<repo>:<path>`。这个仓名本机不认识，
        // 所以只查形态、跳过存在性 —— 正好覆盖"未知仓名"这条分支。
        "some-repo:src/test/SomeTest.java",
        "--confirm",
        "--reason",
        "已毕业: 测试固化",
      ],
      ctx().root,
      ctx().envOverrides,
    );

    const content = await readFile(abs("patterns/live-entry.md"), "utf8");
    expect(content).toContain("enforced: some-repo:src/test/SomeTest.java");
    // enforced 是独立的轴 —— 毕业不等于过时，status 必须保持不变。
    expect(content).toContain("status: active");
  });

  it("R7: --dry-run 不写任何东西", async () => {
    await seedPattern("stale-entry");
    const before = await readFile(abs("patterns/stale-entry.md"), "utf8");

    const result = await toSucceed(
      [
        "retire",
        "stale-entry",
        "--dormant",
        "--reason",
        "未成熟: 未验证",
        "--dry-run",
      ],
      ctx().root,
      ctx().envOverrides,
    );

    expect(result.stdout).toContain("nothing was written");
    const after = await readFile(abs("patterns/stale-entry.md"), "utf8");
    expect(after).toBe(before);
  });

  it("R9: CRLF 文件也能退役（Windows 上知识库是 CRLF）", async () => {
    // 回归：曾因 split("\n") 不归一化行尾，CRLF 文件里每行都带 \r，
    // 于是 `lines[0] !== "---"` 永远成立、命令**什么也没改**。
    const rel = "patterns/crlf-entry.md";
    await seedPattern("crlf-entry");
    const lf = await readFile(abs(rel), "utf8");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(abs(rel), lf.replace(/\n/g, "\r\n"), "utf8");

    await toSucceed(
      ["retire", "crlf-entry", "--dormant", "--reason", "过时: 结论已被推翻"],
      ctx().root,
      ctx().envOverrides,
    );

    const after = await readFile(abs(rel), "utf8");
    expect(after).toContain("status: dormant");
    // 行尾风格必须保持 —— 整文件换行尾会制造巨大的假 diff。
    expect(after).toContain("\r\n");
    expect(after).not.toMatch(/[^\r]\n/);
  });

  it("R10: --enforced 指向不存在的产物 → 拒绝（这是实测犯过的错）", async () => {
    // 2026-09-18 实测：把路径写成裸路径且少了一层目录，validate 报 0 issue，
    // 于是一个**不存在的产物**被当成了毕业依据 —— 条目静默退出路由索引，
    // 而它声称的固化根本不存在。这条必须拦住。
    await seedPattern("live-entry");

    const result = await toFail(
      [
        "retire",
        "live-entry",
        "--enforced",
        "evolutionary:backend/src/test/java/com/evolutionary/NOT_A_REAL_FILE.java",
        "--confirm",
        "--reason",
        "已毕业: x",
      ],
      ctx().root,
      ctx().envOverrides,
    );

    expect(result.stderr + result.stdout).toContain("不存在");
  });

  it("R11: --enforced 缺 `<repo>:` 前缀 → 拒绝", async () => {
    await seedPattern("live-entry");

    const result = await toFail(
      [
        "retire",
        "live-entry",
        "--enforced",
        "some/bare/path.java",
        "--confirm",
        "--reason",
        "已毕业: x",
      ],
      ctx().root,
      ctx().envOverrides,
    );

    expect(result.stderr + result.stdout).toContain("<repo>:<path>");
  });

  it("R8: 未知 id 报错", async () => {
    const result = await toFail(
      ["retire", "no-such-id", "--dormant", "--reason", "过时: x"],
      ctx().root,
      ctx().envOverrides,
    );

    expect(result.stderr + result.stdout).toContain("no-such-id");
  });
});
