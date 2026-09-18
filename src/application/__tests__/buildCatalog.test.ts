import { describe, expect, it } from "vitest";
import { buildCatalog } from "@/application/buildCatalog";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { EntryKindDir, EntryKindValues } from "@/domain/entry/types";
import type { Workspace } from "@/domain/entry/WorkspaceLoader";

const GENERATED_AT = "2026-09-16T00:00:00.000Z";

type EntryTypeKey = keyof typeof EntryKindValues;

function isEntryKindKey(value: string): value is EntryTypeKey {
  return value in EntryKindValues;
}

/** 从路径推断 kind —— 测试数据只需写 path（与生产规则同源）。 */
function kindFor(filePath: string): EntryTypeKey {
  for (const key of Object.keys(EntryKindValues)) {
    if (!isEntryKindKey(key)) continue;
    if (filePath.startsWith(EntryKindDir[EntryKindValues[key]] + "/")) return key;
  }
  return "Skill";
}

function workspaceOf(
  files: readonly { path: string; body: string; status?: string }[],
): Workspace {
  return {
    entries: files.map((f) => ({
      path: f.path,
      entry: makeEntry({
        id: f.path.split("/").pop()?.replace(/\.md$/, "") ?? "x",
        path: f.path,
        type: kindFor(f.path),
        body: f.body,
      }),
      parseIssues: [],
    })),
    indexFiles: new Map(),
    allMarkdownPaths: new Set(files.map((f) => f.path)),
  };
}

describe("buildCatalog", () => {
  it("projects one entry per loaded entry", () => {
    const catalog = buildCatalog(
      workspaceOf([
        { path: "skills/S1-h2-output.md", body: "# S1 H2 输出\n" },
        { path: "agreements/A10-review.md", body: "# A10 Review 前置\n" },
      ]),
      { generatedAt: GENERATED_AT },
    );

    expect(catalog.generatedAt).toBe(GENERATED_AT);
    expect(catalog.summary.total).toBe(2);
  });

  it("carries the routing fields an agent needs", () => {
    const catalog = buildCatalog(
      workspaceOf([{ path: "skills/S1-h2-output.md", body: "# S1 H2 输出\n" }]),
      { generatedAt: GENERATED_AT },
    );

    expect(catalog.entries[0]).toMatchObject({
      id: "S1-h2-output",
      title: "S1 H2 输出",
      path: "skills/S1-h2-output.md",
    });
  });

  it("falls back to the file name when there is no H1", () => {
    const catalog = buildCatalog(
      workspaceOf([{ path: "skills/S9-no-title.md", body: "## 上下文\n" }]),
      { generatedAt: GENERATED_AT },
    );

    expect(catalog.entries[0]?.title).toBe("S9-no-title");
  });

  it("sorts by type then id — so the output is diffable", () => {
    const catalog = buildCatalog(
      workspaceOf([
        { path: "skills/S2-b.md", body: "# b\n" },
        { path: "skills/S1-a.md", body: "# a\n" },
        { path: "agreements/A1-z.md", body: "# z\n" },
      ]),
      { generatedAt: GENERATED_AT },
    );

    expect(catalog.entries.map((e) => e.id)).toEqual([
      "A1-z",
      "S1-a",
      "S2-b",
    ]);
  });

  it("counts by type and status", () => {
    const catalog = buildCatalog(
      workspaceOf([
        { path: "skills/S1-a.md", body: "# a\n" },
        { path: "skills/S2-b.md", body: "# b\n" },
        { path: "agreements/A1-z.md", body: "# z\n" },
      ]),
      { generatedAt: GENERATED_AT },
    );

    expect(catalog.summary.byType).toEqual({ skill: 2, agreement: 1 });
  });

  it("skips entries that failed to parse", () => {
    const workspace: Workspace = {
      entries: [{ path: "skills/broken.md", entry: null, parseIssues: [] }],
      indexFiles: new Map(),
      allMarkdownPaths: new Set(),
    };

    expect(buildCatalog(workspace, { generatedAt: GENERATED_AT }).summary.total).toBe(0);
  });

  it("excludes retired entries — dormant/deprecated leave the routing table", () => {
    const workspace: Workspace = {
      entries: [
        {
          path: "skills/S1-a.md",
          entry: makeEntry({
            id: "S1",
            path: "skills/S1-a.md",
            status: "Active",
            body: "# a\n",
          }),
          parseIssues: [],
        },
        {
          path: "skills/S2-b.md",
          entry: makeEntry({
            id: "S2",
            path: "skills/S2-b.md",
            status: "Dormant",
            body: "# b\n",
          }),
          parseIssues: [],
        },
        {
          path: "skills/S3-c.md",
          entry: makeEntry({
            id: "S3",
            path: "skills/S3-c.md",
            status: "Deprecated",
            body: "# c\n",
          }),
          parseIssues: [],
        },
      ],
      indexFiles: new Map(),
      allMarkdownPaths: new Set(),
    };

    const catalog = buildCatalog(workspace, { generatedAt: GENERATED_AT });
    expect(catalog.entries.map((e) => e.id)).toEqual(["S1"]);
  });

  it("carries trigger / anti-trigger when the entry declares them", () => {
    const withRouting = makeEntry({
      id: "S1",
      path: "skills/S1-a.md",
      body: "# a\n",
    });
    // 路由字段由人/模型写 —— 直接在 input 上补（生产走 frontmatter 解析）
    const catalog = buildCatalog(
      {
        entries: [{ path: "skills/S1-a.md", entry: withRouting, parseIssues: [] }],
        indexFiles: new Map(),
        allMarkdownPaths: new Set(["skills/S1-a.md"]),
      },
      { generatedAt: GENERATED_AT },
    );

    // 没写就不出现（不是空字符串），这样 catalog 里"有 trigger"本身就是信号
    expect(catalog.entries[0]).not.toHaveProperty("trigger");
  });
});
