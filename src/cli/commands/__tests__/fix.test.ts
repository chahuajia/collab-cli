import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  toSucceed,
  useTestWorkspace,
} from "@/cli/commands/__tests__/testHelpers";

const ctx = useTestWorkspace();

/** 一条合法但**缺 aliases** 的条目（前置 `---`，收尾 `---`）。 */
function entryWithoutAliases(id: string, extraLines: readonly string[] = []): string {
  return [
    "---",
    `id: ${id}`,
    "type: skill",
    "status: active",
    "created: 2026-09-16",
    "updated: 2026-09-16",
    "author: Test",
    ...extraLines,
    "---",
    "",
    "# " + id,
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
}

const REL = "skills/S30-fix-me.md";

function abs(rel: string): string {
  return path.join(ctx().collabDir, rel);
}

describe("collab fix", () => {
  it("adds the id to aliases when the field is missing", async () => {
    await writeFile(abs(REL), entryWithoutAliases("S30"), "utf8");

    await toSucceed(["fix"], ctx().root, ctx().envOverrides);

    const content = await readFile(abs(REL), "utf8");
    expect(content).toContain("aliases:");
    expect(content).toContain("  - S30");
  });

  it("appends to an existing block-form aliases list", async () => {
    await writeFile(
      abs(REL),
      entryWithoutAliases("S30", ["aliases:", "  - 旧别名"]),
      "utf8",
    );

    await toSucceed(["fix"], ctx().root, ctx().envOverrides);

    const content = await readFile(abs(REL), "utf8");
    expect(content).toContain("  - 旧别名");
    expect(content).toContain("  - S30");
  });

  it("adds to an inline aliases list", async () => {
    await writeFile(
      abs(REL),
      entryWithoutAliases("S30", ["aliases: [旧别名]"]),
      "utf8",
    );

    await toSucceed(["fix"], ctx().root, ctx().envOverrides);

    expect(await readFile(abs(REL), "utf8")).toContain("aliases: [旧别名, S30]");
  });

  it("never deletes or rewrites anything else", async () => {
    const original = entryWithoutAliases("S30", ["provenance: 保留我"]);
    await writeFile(abs(REL), original, "utf8");

    await toSucceed(["fix"], ctx().root, ctx().envOverrides);

    const content = await readFile(abs(REL), "utf8");
    expect(content).toContain("provenance: 保留我");
    expect(content).toContain("author: Test");
    // 正文一字未动
    expect(content).toContain("# S30");
    expect(content.endsWith("\n")).toBe(true);
  });

  it("does not write in --dry-run", async () => {
    const original = entryWithoutAliases("S30");
    await writeFile(abs(REL), original, "utf8");

    const result = await toSucceed(
      ["fix", "--dry-run"],
      ctx().root,
      ctx().envOverrides,
    );

    expect(result.stdout).toContain("would add");
    expect(await readFile(abs(REL), "utf8")).toBe(original);
  });

  it("leaves a correct entry untouched", async () => {
    const original = entryWithoutAliases("S30", ["aliases:", "  - S30"]);
    await writeFile(abs(REL), original, "utf8");

    await toSucceed(["fix"], ctx().root, ctx().envOverrides);

    expect(await readFile(abs(REL), "utf8")).toBe(original);
  });

  it("reports (and refuses to guess) when frontmatter is missing", async () => {
    const broken = "没有 frontmatter 的文件\n";
    await writeFile(abs(REL), broken, "utf8");

    // 解析失败 → 不在 entries 里 → fix 不会碰它（由 validate 负责报错）
    await toSucceed(["fix"], ctx().root, ctx().envOverrides);
    expect(await readFile(abs(REL), "utf8")).toBe(broken);
  });

  it("is listed as a valid command", async () => {
    const result = await toSucceed(["--help"], ctx().root, ctx().envOverrides);
    expect(result.stdout).toContain("fix");
  });

  it("silences nothing: exit 0 when everything is fixable", async () => {
    await writeFile(abs(REL), entryWithoutAliases("S30"), "utf8");
    const result = await toSucceed(["fix"], ctx().root, ctx().envOverrides);
    expect(result.stdout).toContain("fixed 1 file(s)");
  });

});
