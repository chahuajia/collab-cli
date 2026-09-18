import { describe, it, expect } from "vitest";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { makeRuleContext } from "@/domain/validation/__tests__/testHelpers";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { enforcedShape } from "@/domain/validation/rules/enforcedShape";

const ctx = makeRuleContext();

/** 造一条带 `enforced` 的条目。 */
function withEnforced(enforced: string) {
  return makeEntry({
    id: "S13",
    type: "Skill",
    path: "skills/S13.md",
    enforced,
  });
}

describe("enforcedShape", () => {
  it("null → 不报（未毕业是合法状态）", () => {
    const entry = makeEntry({ id: "S13", type: "Skill", path: "skills/S13.md" });
    expect(enforcedShape(entry, ctx)).toHaveLength(0);
  });

  it("合法形态 <repo>:<path> → 不报", () => {
    const entry = withEnforced(
      "evolutionary:backend/src/test/java/com/evolutionary/architecture/DomainFrameworkFreeTest.java",
    );
    expect(enforcedShape(entry, ctx)).toHaveLength(0);
  });

  it("缺 `<repo>:` 前缀 → 报（这正是实测犯过的错）", () => {
    // 2026-09-18 实测：把路径写成裸路径，validate 报 0 issue，
    // 于是一个**不存在的产物**被当成了毕业依据。
    const entry = withEnforced("com/evolutionary/DomainFrameworkFreeTest.java");

    const issues = enforcedShape(entry, ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(IssueCodeValues.EnforcedShapeInvalid);
    // suggestion 给的是**具体例子**（`<repo>:<path>` 的形态），不是字面量 ——
    // 对要照着改的人来说，例子比抽象模式有用。
    expect(issues[0]?.suggestion).toContain("evolutionary:");
  });

  it("空串 → 报（空串是「看起来填了、其实没填」，应当用 null）", () => {
    const entry = withEnforced("");

    const issues = enforcedShape(entry, ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(IssueCodeValues.EnforcedShapeInvalid);
    expect(issues[0]?.message).toContain("null");
  });

  it("纯空白 → 报", () => {
    const entry = withEnforced("   ");
    expect(enforcedShape(entry, ctx)).toHaveLength(1);
  });

  it("仓名后有空白 → 报（路径不该以空白开头）", () => {
    const entry = withEnforced("evolutionary:   /tmp/x");
    expect(enforcedShape(entry, ctx)).toHaveLength(1);
  });
});
