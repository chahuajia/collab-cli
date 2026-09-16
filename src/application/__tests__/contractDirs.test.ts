import { describe, expect, it } from "vitest";
import { CONTRACT_DIRS, contractDirs } from "@/application/contractDirs";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import type { RuleContext } from "@/domain/validation/Rule";

function ctxWith(paths: readonly string[]): RuleContext {
  return {
    allEntries: [],
    allEntryIds: new Set(),
    indexFiles: new Map(),
    allMarkdownPaths: new Set(paths),
  };
}

describe("contractDirs", () => {
  it("passes when every directory is declared", () => {
    const issues = contractDirs(
      ctxWith(["agreements/A10-review", "skills/S1-h2-output", "integrations/chatgpt-output-format"]),
    );
    expect(issues).toHaveLength(0);
  });

  it("reports an undeclared top-level directory", () => {
    const issues = contractDirs(ctxWith(["handbook/some-note"]));
    expect(issues.map((i) => i.code)).toEqual([IssueCodeValues.UndeclaredDir]);
    expect(issues[0]?.message).toContain("handbook/");
    expect(issues[0]?.suggestion).toContain("ADR");
  });

  it("ignores files at the repo root", () => {
    expect(contractDirs(ctxWith(["ROOT", "README", "AGENTS"]))).toHaveLength(0);
  });

  it("ignores dot-directories (tooling)", () => {
    expect(contractDirs(ctxWith([".github/workflows/evolution"]))).toHaveLength(0);
  });

  it("reports each undeclared directory once, sorted", () => {
    const issues = contractDirs(ctxWith(["zoo/a", "handbook/b", "zoo/c"]));
    expect(issues.map((i) => i.path)).toEqual(["handbook", "zoo"]);
  });

  it("declares exactly the frozen list", () => {
    expect([...CONTRACT_DIRS]).toEqual([
      "agreements",
      "workflows",
      "skills",
      "patterns",
      "integrations",
      "meta",
      "domains",
      "rfcs",
      "profiles",
      "templates",
      "inbox",
    ]);
  });
});
