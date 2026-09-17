import { describe, it, expect } from "vitest";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { makeRuleContext } from "@/domain/validation/__tests__/testHelpers";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { checkIndexRefPreferId } from "@/domain/validation/rules/checkIndexRefPreferId";
import { SeverityValues } from "@/domain/validation/Severity";

describe("checkIndexRefPreferId", () => {
  it("passes when the table row already uses id anchor", () => {
    const entry = makeEntry({
      id: "S1",
      type: "Skill",
      path: "skills/S1-h2-output.md",
    });
    const context = makeRuleContext({
      entries: [entry],
      indexFiles: new Map([
        ["skills", "| [[S1]] | H2 输出 | meta | active |"],
      ]),
    });

    expect(checkIndexRefPreferId(context)).toHaveLength(0);
  });

  it("warns when the table row uses file-name anchor", () => {
    const entry = makeEntry({
      id: "S1",
      type: "Skill",
      path: "skills/S1-h2-output.md",
    });
    const context = makeRuleContext({
      entries: [entry],
      indexFiles: new Map([
        [
          "skills",
          "| [[S1-h2-output]] | H2 输出 | meta | active |",
        ],
      ]),
    });

    const issues = checkIndexRefPreferId(context);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe(SeverityValues.Warning);
    expect(issues[0]?.code).toBe(IssueCodeValues.IndexRefPreferId);
    expect(issues[0]?.message).toContain("[[S1]]");
  });

  it("ignores narrative links outside table rows", () => {
    const entry = makeEntry({
      id: "W1",
      type: "Workflow",
      path: "workflows/W1-blank-page-triage.md",
    });
    const context = makeRuleContext({
      entries: [entry],
      indexFiles: new Map([
        [
          "workflows",
          [
            "| [[W1]] | triage | active |",
            "",
            "See also [[W1-blank-page-triage]] for details.",
          ].join("\n"),
        ],
      ]),
    });

    expect(checkIndexRefPreferId(context)).toHaveLength(0);
  });

  it("passes for patterns where id equals file name", () => {
    const entry = makeEntry({
      id: "rooted-graph",
      type: "Pattern",
      path: "patterns/rooted-graph.md",
    });
    const context = makeRuleContext({
      entries: [entry],
      indexFiles: new Map([
        ["patterns", "| [[patterns/rooted-graph]] | source | use |"],
      ]),
    });

    expect(checkIndexRefPreferId(context)).toHaveLength(0);
  });

  it("warns for ADR rows that use the long file name", () => {
    const entry = makeEntry({
      id: "ADR-0009",
      type: "Adr",
      path: "meta/decision-records/ADR-0009-id-是不可变快照.md",
    });
    const context = makeRuleContext({
      entries: [entry],
      indexFiles: new Map([
        [
          "meta/decision-records",
          "| [[ADR-0009-id-是不可变快照]] | id 是不可变快照 | 2026-09-16 | accepted |",
        ],
      ]),
    });

    const issues = checkIndexRefPreferId(context);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("[[ADR-0009]]");
  });
});
