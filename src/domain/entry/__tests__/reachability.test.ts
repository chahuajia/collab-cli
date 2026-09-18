import { describe, it, expect } from "vitest";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { findUnreachable } from "@/domain/entry/reachability";

/** 造一条带正文的条目（正文里的 [[…]] 就是图的边）。 */
function entry(id: string, body: string, created = "2026-01-01") {
  return makeEntry({
    id,
    type: "Skill",
    path: `skills/${id}.md`,
    body,
    created,
    updated: created,
  });
}

const ROOT = new Map([["ROOT.md", "[[S1]]"]]);

describe("findUnreachable（标记-清除）", () => {
  it("被根文档直接引用 → 可达", () => {
    const e = entry("S1", "无出边");
    expect(findUnreachable([e], ROOT)).toHaveLength(0);
  });

  it("间接可达（根 → A → B）→ B 不算孤岛", () => {
    const a = entry("S1", "[[S2]]");
    const b = entry("S2", "无出边");
    expect(findUnreachable([a, b], ROOT)).toHaveLength(0);
  });

  it("**无向**：只被孤岛指向的也算连通", () => {
    // 根 → S1，S1 ← S2（S2 指向 S1）。无向图里 S2 与 S1 连通 → 不算孤岛。
    // 这是刻意的：政策要抓的是"没人指向、也没指向谁"的**孤立分量**，
    // 不是"根文档没直接引用"。
    const a = entry("S1", "无出边");
    const b = entry("S2", "[[S1]]");
    expect(findUnreachable([a, b], ROOT)).toHaveLength(0);
  });

  it("完全孤立（没人指向、也不指向谁）→ 报，且入度出度都是 0", () => {
    const island = entry("S9", "跟谁都没关系");
    const rooted = entry("S1", "无出边");

    const out = findUnreachable([island, rooted], ROOT);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("S9");
    expect(out[0]?.inbound).toBe(0);
    expect(out[0]?.outbound).toBe(0);
  });

  it("引用可以是**文件名**形式（复用唯一的匹配规则）", () => {
    // 根文档用文件名形式引用 —— 必须解析得到
    const e = makeEntry({
      id: "S1",
      type: "Skill",
      path: "skills/S1-h2-output.md",
      body: "x",
    });
    const root = new Map([["ROOT.md", "[[S1-h2-output]]"]]);
    expect(findUnreachable([e], root)).toHaveLength(0);
  });

  it("宽限期：太新的孤岛不算候选（新条目还没轮到被引用）", () => {
    const fresh = entry("S9", "孤岛", "2026-09-18");
    const out = findUnreachable([fresh], ROOT, {
      now: "2026-09-19",
      graceDays: 30,
    });
    expect(out).toHaveLength(0);
  });

  it("宽限期外 → 仍报", () => {
    const old = entry("S9", "孤岛", "2026-01-01");
    const out = findUnreachable([old], ROOT, {
      now: "2026-09-19",
      graceDays: 30,
    });
    expect(out).toHaveLength(1);
  });

  it("按孤立程度排序（最孤立的在前）", () => {
    const a = entry("S8", "[[S7]]");
    const b = entry("S7", "[[S8]] [[S6]]");
    const c = entry("S6", "[[S7]]");

    const out = findUnreachable([a, b, c], ROOT, {
      now: "2026-09-19",
      graceDays: 0,
    });
    // 三条互连成一个分量、都与根不连通 → 全报
    expect(out).toHaveLength(3);
    // S7 度数最高（入 2 出 2），应排最后
    expect(out.at(-1)?.id).toBe("S7");
  });

  it("根文档本身不作为候选（它是种子，不是条目）", () => {
    const out = findUnreachable([], ROOT);
    expect(out).toHaveLength(0);
  });

  it("**已毕业的条目必须在图上**（否则指向它的条目会变成假阳性）", () => {
    // 实测踩到：第一版把 isRouted 的过滤放在建图之前，S13 不在图上，
    // 于是 S20/S24/S25/S28 全都指向一个悬空节点 → 被误报成孤岛。
    // 退出路由索引 ≠ 从图上消失。
    const graduated = makeEntry({
      id: "S13",
      type: "Skill",
      path: "skills/S13.md",
      body: "无出边",
      enforced: "evolutionary:backend/.../StationTest.java",
    });
    const pointing = entry("S20", "[[S13]]");
    const root = new Map([["ROOT.md", "[[S13]]"]]);

    // S13 毕业了 → 不作为候选；但 S20 通过 S13 与根连通 → 也不是候选
    const out = findUnreachable([graduated, pointing], root);
    expect(out).toHaveLength(0);
  });

  it("已退役（dormant）的条目不作为候选，但在图上", () => {
    const dormant = makeEntry({
      id: "S5",
      type: "Skill",
      path: "skills/S5-sentinel.md",
      body: "无出边",
      status: "Dormant",
    });
    const pointing = entry("S20", "[[S5]]");
    const root = new Map([["ROOT.md", "[[S5]]"]]);

    expect(findUnreachable([dormant, pointing], root)).toHaveLength(0);
  });
});
