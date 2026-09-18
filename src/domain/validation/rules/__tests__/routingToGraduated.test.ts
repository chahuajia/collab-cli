import { describe, it, expect } from "vitest";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { makeRuleContext } from "@/domain/validation/__tests__/testHelpers";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { routingToGraduated } from "@/domain/validation/rules/routingToGraduated";

/** 一条已毕业的条目。 */
function graduated(id = "S13", path = "skills/S13.md") {
  return makeEntry({
    id,
    type: "Skill",
    path,
    enforced: "evolutionary:backend/src/test/java/.../StationTest.java",
  });
}

describe("routingToGraduated", () => {
  it("表格行指向已毕业条目 → 报", () => {
    const context = makeRuleContext({
      entries: [graduated()],
      rootDocs: new Map([
        ["AGENTS.md", "| 不变量放哪一层 | [[S13]] |\n"],
      ]),
    });

    const issues = routingToGraduated(context);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(IssueCodeValues.RoutingToGraduated);
    expect(issues[0]?.path).toBe("AGENTS.md");
    expect(issues[0]?.message).toContain("S13");
  });

  it("标注了「已毕业」的表格行 → 不报", () => {
    const context = makeRuleContext({
      entries: [graduated()],
      rootDocs: new Map([
        ["AGENTS.md", "| 不变量放哪一层 | [[S13]] 已毕业（StationTest 钉死） |\n"],
      ]),
    });

    expect(routingToGraduated(context)).toHaveLength(0);
  });

  it("文件名形式的引用（[[S13-Smart-Constructor]]）也要报 —— 实测漏过", () => {
    // 回归：本规则第一版只比对 id，而症状表实际写的是文件名形式 ——
    // 于是它漏掉了自己存在的理由，却因为测试用 id 形式而全绿。
    // 复用的是 refersToIdentity（全项目唯一的引用匹配规则）。
    const entry = makeEntry({
      id: "S13",
      type: "Skill",
      path: "skills/S13-Smart-Constructor.md",
      enforced: "evolutionary:backend/.../StationTest.java",
    });
    const context = makeRuleContext({
      entries: [entry],
      rootDocs: new Map([
        ["AGENTS.md", "| 不变量放哪一层 | [[S13-Smart-Constructor]] |\n"],
      ]),
    });

    const issues = routingToGraduated(context);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("S13");
  });

  it("关联区（平铺双链）指向已毕业条目 → **不报**（关联不是路由）", () => {
    // 这是实测踩到的假阳性：AGENTS.md 的 ## 关联 区列了所有条目，
    // 毕业后仍应保留 —— 它回答"这条和谁有关"，不回答"现在该读什么"。
    const context = makeRuleContext({
      entries: [graduated()],
      rootDocs: new Map([
        ["AGENTS.md", "[[ROOT]] [[S13]] [[patterns/design-decision]]\n"],
      ]),
    });

    expect(routingToGraduated(context)).toHaveLength(0);
  });

  it("表格行指向**未**毕业条目 → 不报", () => {
    const active = makeEntry({ id: "S13", type: "Skill", path: "skills/S13.md" });
    const context = makeRuleContext({
      entries: [active],
      rootDocs: new Map([["AGENTS.md", "| 不变量放哪一层 | [[S13]] |\n"]]),
    });

    expect(routingToGraduated(context)).toHaveLength(0);
  });

  it("查 domain 索引（extraDocs）里的路由表", () => {
    const context = makeRuleContext({
      entries: [graduated()],
      extraDocs: new Map([
        ["domains/architecture/_index.md", "| 领域层碰了框架 | [[S13]] |\n"],
      ]),
    });

    const issues = routingToGraduated(context);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe("domains/architecture/_index.md");
  });

  it("没有任何毕业条目 → 不报（快速路径）", () => {
    const context = makeRuleContext({
      entries: [makeEntry({ id: "S13", type: "Skill", path: "skills/S13.md" })],
      rootDocs: new Map([["AGENTS.md", "| x | [[S13]] |\n"]]),
    });

    expect(routingToGraduated(context)).toHaveLength(0);
  });
});
