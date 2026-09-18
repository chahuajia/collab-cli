import { describe, expect, it } from "vitest";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { linksResolveInRootDocs } from "@/domain/validation/rules/linksResolveInRootDocs";
import type { RuleContext } from "@/domain/validation/Rule";

function ctxWith(
  rootDocs: ReadonlyMap<string, string>,
  knownRefs: readonly string[] = [],
): RuleContext {
  return {
    allEntries: [],
    allEntryIds: new Set(knownRefs),
    indexFiles: new Map(),
    allMarkdownPaths: new Set(),
    rootDocs,
  };
}

describe("linksResolveInRootDocs", () => {
  it("skips when the workspace does not provide root docs", () => {
    const context: RuleContext = {
      allEntries: [],
      allEntryIds: new Set(),
      indexFiles: new Map(),
      allMarkdownPaths: new Set(),
    };
    expect(linksResolveInRootDocs(context)).toHaveLength(0);
  });

  it("passes when root-doc links resolve", () => {
    const docs = new Map([["AGENTS.md", "[[A10-review-前置原则]]"]]);
    expect(linksResolveInRootDocs(ctxWith(docs, ["A10-review-前置原则"]))).toHaveLength(0);
  });

  it("reports a dead link in an entry point (the most expensive kind)", () => {
    const docs = new Map([["AGENTS.md", "先读 [[NO-SUCH-ENTRY]]"]]);
    const issues = linksResolveInRootDocs(ctxWith(docs));

    expect(issues.map((i) => i.code)).toEqual([IssueCodeValues.DeadLink]);
    expect(issues[0]?.path).toBe("AGENTS.md");
  });

  it("checks every root doc, not just AGENTS.md", () => {
    const docs = new Map([
      ["AGENTS.md", "[[S1]]"],
      ["ROOT.md", "[[GONE]]"],
      ["README.md", "[[ME_TOO]]"],
    ]);
    const issues = linksResolveInRootDocs(ctxWith(docs, ["S1"]));

    expect(issues.map((i) => i.path).sort()).toEqual(["README.md", "ROOT.md"]);
  });

  it("ignores links inside code (same rule as entries)", () => {
    const docs = new Map([["AGENTS.md", "示例 `[[NO-SUCH]]`"]]);
    expect(linksResolveInRootDocs(ctxWith(docs))).toHaveLength(0);
  });
});
