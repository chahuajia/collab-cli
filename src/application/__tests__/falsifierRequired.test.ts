import { describe, it, expect } from "vitest";
import {
  FALSIFIER_REQUIRED_SINCE,
  falsifierRequired,
} from "@/application/falsifierRequired";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { makeRuleContext } from "@/domain/validation/__tests__/testHelpers";
import { IssueCodeValues } from "@/domain/validation/IssueCode";

const ctx = makeRuleContext();

/** 门槛生效日之后创建的条目。 */
const AFTER = FALSIFIER_REQUIRED_SINCE;
/** 门槛生效日之前创建的条目（存量）。 */
const BEFORE = "2026-09-01";

describe("falsifierRequired（入库门槛，日期截止）", () => {
  it("生效日之后创建、有 falsifier → 通过", () => {
    const entry = makeEntry({
      id: "S12",
      type: "Skill",
      path: "skills/S12.md",
      created: AFTER,
      updated: AFTER,
      falsifier: "会照着项目里的旧写法继续写",
    });

    expect(entry.frontmatter.falsifier).toBe("会照着项目里的旧写法继续写");
    expect(falsifierRequired(entry, ctx)).toHaveLength(0);
  });

  it("空串 / 纯空白视为没填 → 报（空串是「看起来填了、其实没填」）", () => {
    for (const blank of ["", "   "]) {
      const entry = makeEntry({
        id: "S12",
        type: "Skill",
        path: "skills/S12.md",
        created: AFTER,
        updated: AFTER,
        falsifier: blank,
      });

      expect(falsifierRequired(entry, ctx)).toHaveLength(1);
    }
  });

  it("生效日之后创建、**缺** falsifier → 报", () => {
    const entry = makeEntry({
      id: "S12",
      type: "Skill",
      path: "skills/S12.md",
      created: AFTER,
      updated: AFTER,
    });

    const issues = falsifierRequired(entry, ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(IssueCodeValues.FalsifierRequired);
    expect(issues[0]?.path).toBe("skills/S12.md");
    expect(issues[0]?.message).toContain("S12");
  });

  it("draft → 豁免（脚手架不是入库；那一刻还答不出「不读它会错什么」）", () => {
    // 实测教训：第一版对**所有**路由中条目生效，于是 `collab new` 造出的
    // 空条目立刻让 validate 变红 —— 13 个 "new → index → validate" 链路测试失败。
    // 门槛错位到"创建"而不是"入库"，就会把判断提前到还无法回答它的时刻。
    const entry = makeEntry({
      id: "S12",
      type: "Skill",
      path: "skills/S12.md",
      created: AFTER,
      updated: AFTER,
      status: "Draft",
    });

    expect(falsifierRequired(entry, ctx)).toHaveLength(0);
  });

  it("accepted（ADR 的入库态）→ 生效", () => {
    const entry = makeEntry({
      id: "ADR-0099",
      type: "Adr",
      path: "meta/decision-records/ADR-0099.md",
      created: AFTER,
      updated: AFTER,
      status: "Accepted",
    });

    expect(falsifierRequired(entry, ctx)).toHaveLength(1);
  });

  it("生效日**之前**创建 → 豁免（存量不该被追溯）", () => {
    const entry = makeEntry({
      id: "S12",
      type: "Skill",
      path: "skills/S12.md",
      created: BEFORE,
      updated: BEFORE,
    });

    expect(falsifierRequired(entry, ctx)).toHaveLength(0);
  });

  it("已毕业的条目 → 豁免（不需要再被读，门槛对它没意义）", () => {
    const entry = makeEntry({
      id: "S13",
      type: "Skill",
      path: "skills/S13.md",
      created: AFTER,
      updated: AFTER,
      enforced: "evolutionary:backend/.../StationTest.java",
    });

    expect(falsifierRequired(entry, ctx)).toHaveLength(0);
  });

  it("dormant 的条目 → 豁免", () => {
    const entry = makeEntry({
      id: "S12",
      type: "Skill",
      path: "skills/S12.md",
      created: AFTER,
      updated: AFTER,
      status: "Dormant",
    });

    expect(falsifierRequired(entry, ctx)).toHaveLength(0);
  });

  it("日期比较是**字符串**比较（ISODate 是 YYYY-MM-DD 品牌类型）", () => {
    // 这条守着实现的正确性：一旦有人把日期改成 Date 对象或改了格式，
    // "2026-09-19" < "2026-09-19" 这类边界就会静默错位。
    expect("2026-09-18" < FALSIFIER_REQUIRED_SINCE).toBe(true);
    expect("2026-09-19" < FALSIFIER_REQUIRED_SINCE).toBe(false);
    expect("2026-09-20" < FALSIFIER_REQUIRED_SINCE).toBe(false);
  });
});
