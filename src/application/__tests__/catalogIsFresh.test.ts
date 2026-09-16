import { describe, expect, it } from "vitest";
import { buildCatalog } from "@/application/buildCatalog";
import { catalogIsFresh } from "@/application/catalogIsFresh";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import type { Entry } from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";

function ctxOf(
  entries: readonly Entry[],
  catalogJson: string | null | undefined,
): RuleContext {
  return {
    allEntries: entries,
    allEntryIds: new Set(entries.map((e) => e.frontmatter.id)),
    indexFiles: new Map(),
    allMarkdownPaths: new Set(entries.map((e) => e.path)),
    catalogJson,
  };
}

function anEntry(id = "S1", filePath = "skills/S1-a.md"): Entry {
  return makeEntry({ id, path: filePath, body: "# 标题\n" });
}

/** 生成一份与给定 entries 一致的 catalog 文本。 */
function freshCatalogFor(entries: readonly Entry[]): string {
  return JSON.stringify(
    buildCatalog(
      {
        entries: entries.map((entry) => ({
          path: entry.path,
          entry,
          parseIssues: [],
        })),
        indexFiles: new Map(),
        allMarkdownPaths: new Set(entries.map((e) => e.path)),
      },
      { generatedAt: "任意时间戳" },
    ),
  );
}

describe("catalogIsFresh", () => {
  it("skips when the workspace does not provide a catalog", () => {
    expect(catalogIsFresh(ctxOf([anEntry()], undefined))).toHaveLength(0);
  });

  it("does not require a catalog to exist", () => {
    expect(catalogIsFresh(ctxOf([anEntry()], null))).toHaveLength(0);
  });

  it("passes when the catalog matches the workspace", () => {
    const entries = [anEntry()];
    const stored = freshCatalogFor(entries);
    expect(catalogIsFresh(ctxOf(entries, stored))).toHaveLength(0);
  });

  it("ignores generatedAt (timestamps always differ)", () => {
    const entries = [anEntry()];
    const stored = freshCatalogFor(entries).replace("任意时间戳", "另一个时间");
    expect(catalogIsFresh(ctxOf(entries, stored))).toHaveLength(0);
  });

  it("reports a stale catalog when an entry was added", () => {
    const stored = freshCatalogFor([anEntry()]);
    const issues = catalogIsFresh(
      ctxOf([anEntry(), anEntry("S2", "skills/S2-b.md")], stored),
    );

    expect(issues.map((i) => i.code)).toEqual([IssueCodeValues.CatalogStale]);
    expect(issues[0]?.suggestion).toContain("collab catalog");
  });

  it("reports a catalog that is not valid JSON", () => {
    const issues = catalogIsFresh(ctxOf([anEntry()], "{ 不是 JSON"));
    expect(issues.map((i) => i.code)).toEqual([IssueCodeValues.CatalogStale]);
  });

  it("reports a catalog without an entries array", () => {
    const issues = catalogIsFresh(ctxOf([anEntry()], JSON.stringify({ v: 1 })));
    expect(issues.map((i) => i.code)).toEqual([IssueCodeValues.CatalogStale]);
  });
});
