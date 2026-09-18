import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  toFail,
  toSucceed,
  useTestWorkspace,
  writeIndex,
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

  it("--dry-run exits 0 (so it can be used as a check)", async () => {
    await writeFile(abs(REL), entryWithoutAliases("S30"), "utf8");
    const result = await toSucceed(
      ["fix", "--dry-run"],
      ctx().root,
      ctx().envOverrides,
    );
    expect(result.stdout).toContain("would change");
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

  describe("validate 门禁联动（round-5）", () => {
    async function arrangeIndexedEntry(id: string, rel: string): Promise<void> {
      await writeIndex(ctx().collabDir, "skills", [id]);
      await writeFile(abs(rel), entryWithoutAliases(id), "utf8");
    }

    it("C1: validate → fix → validate clears ID_NOT_IN_ALIASES", async () => {
      await arrangeIndexedEntry("S30", REL);

      const before = await toFail(["validate"], ctx().root, ctx().envOverrides);
      expect(before.stdout).toContain("ID_NOT_IN_ALIASES");

      await toSucceed(["fix"], ctx().root, ctx().envOverrides);

      const after = await toSucceed(
        ["validate"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(after.stdout).toContain("0 issues");
      expect(after.stdout).not.toContain("ID_NOT_IN_ALIASES");
    });

    it("C2: --dry-run leaves validate failing", async () => {
      await arrangeIndexedEntry("S30", REL);

      await toFail(["validate"], ctx().root, ctx().envOverrides);
      await toSucceed(["fix", "--dry-run"], ctx().root, ctx().envOverrides);

      const still = await toFail(["validate"], ctx().root, ctx().envOverrides);
      expect(still.stdout).toContain("ID_NOT_IN_ALIASES");
    });

    it("C3: unparseable file stays broken after fix", async () => {
      const broken = "没有 frontmatter 的文件\n";
      await writeFile(abs(REL), broken, "utf8");

      const before = await toFail(["validate"], ctx().root, ctx().envOverrides);
      expect(before.exitCode).toBe(1);

      await toSucceed(["fix"], ctx().root, ctx().envOverrides);
      expect(await readFile(abs(REL), "utf8")).toBe(broken);

      await toFail(["validate"], ctx().root, ctx().envOverrides);
    });

    it("C4: fixes multiple entries in one pass", async () => {
      const rel2 = "skills/S31-fix-me-too.md";
      await writeIndex(ctx().collabDir, "skills", ["S30", "S31"]);
      await writeFile(abs(REL), entryWithoutAliases("S30"), "utf8");
      await writeFile(abs(rel2), entryWithoutAliases("S31"), "utf8");

      await toFail(["validate"], ctx().root, ctx().envOverrides);

      const fixed = await toSucceed(["fix"], ctx().root, ctx().envOverrides);
      expect(fixed.stdout).toContain("fixed 2 file(s)");

      const after = await toSucceed(
        ["validate"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(after.stdout).toContain("2 entries");
      expect(after.stdout).toContain("0 issues");
    });
  });

  describe("fix → index → catalog 修复链（round-15）", () => {
    async function seedCompoundFault(): Promise<void> {
      await toSucceed(["catalog"], ctx().root, ctx().envOverrides);
      await writeIndex(ctx().collabDir, "skills", []);
      await writeFile(abs(REL), entryWithoutAliases("S30"), "utf8");
    }

    it("C1: compound fault surfaces multiple issue codes", async () => {
      await seedCompoundFault();

      const result = await toFail(["validate"], ctx().root, ctx().envOverrides);
      expect(result.stdout).toContain("ID_NOT_IN_ALIASES");
      expect(result.stdout).toContain("MISSING_FROM_INDEX");
      expect(result.stdout).toContain("CATALOG_STALE");
    });

    it("C2: fix alone does not clear validate", async () => {
      await seedCompoundFault();
      await toSucceed(["fix"], ctx().root, ctx().envOverrides);
      await toFail(["validate"], ctx().root, ctx().envOverrides);
    });

    it("C3: fix → index → catalog → validate passes", async () => {
      await seedCompoundFault();
      await toSucceed(["fix"], ctx().root, ctx().envOverrides);
      await toSucceed(["index", "skills"], ctx().root, ctx().envOverrides);
      await toFail(["validate"], ctx().root, ctx().envOverrides);
      await toSucceed(["catalog"], ctx().root, ctx().envOverrides);

      const after = await toSucceed(
        ["validate"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(after.stdout).toContain("1 entries");
      expect(after.stdout).toContain("0 issues");
    });

    it("C4: fix --dry-run leaves compound fault intact", async () => {
      await seedCompoundFault();
      const before = await readFile(abs(REL), "utf8");

      await toSucceed(["fix", "--dry-run"], ctx().root, ctx().envOverrides);
      expect(await readFile(abs(REL), "utf8")).toBe(before);
      await toFail(["validate"], ctx().root, ctx().envOverrides);
    });
  });

});
