import { describe, it, expect } from "vitest";
import { parseIndex } from "@/cli/lib/parseIndex";
import { renderIndex } from "@/cli/lib/renderIndex";
import { EntryKindValues } from "@/domain/entry/types";


describe("renderIndex", () => {
  // ─────────────────────────────────────────────
  // 生成新 index
  // ─────────────────────────────────────────────
  describe("生成新 index", () => {
    it("creates skill index with standard header", () => {
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing: null,
        actualEntries: ["S1", "S2", "S3"],
      });
      expect(result.content).toContain("# 技能索引");
      expect(result.content).toContain("| [[S1]] |");
      expect(result.content).toContain("| [[S2]] |");
      expect(result.content).toContain("| [[S3]] |");
      expect(result.added).toBe(3);
      expect(result.removed).toBe(0);
    });

    it("creates pattern index with long refs", () => {
      const result = renderIndex({
        kind: EntryKindValues.Pattern,
        existing: null,
        actualEntries: ["rooted-graph", "pattern-language"],
      });
      expect(result.content).toContain("[[patterns/rooted-graph]]");
      expect(result.content).toContain("[[patterns/pattern-language]]");
    });

    it("creates empty index for empty directory", () => {
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing: null,
        actualEntries: [],
      });
      expect(result.content).toContain("# 技能索引");
      expect(result.content).toContain("| ID");
      expect(result.added).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // 排序（D3=A）
  // ─────────────────────────────────────────────
  describe("排序", () => {
    it("sorts numeric ids numerically, not lexically", () => {
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing: null,
        actualEntries: ["S10", "S2", "S1", "S20", "S3"],
      });
      const lines = result.content
        .split("\n")
        .filter((l) => l.startsWith("| [["));
      expect(lines[0]).toContain("[[S1]]");
      expect(lines[1]).toContain("[[S2]]");
      expect(lines[2]).toContain("[[S3]]");
      expect(lines[3]).toContain("[[S10]]");
      expect(lines[4]).toContain("[[S20]]");
    });

    it("sorts non-numeric ids alphabetically", () => {
      const result = renderIndex({
        kind: EntryKindValues.Pattern,
        existing: null,
        actualEntries: ["zebra", "alpha", "middle"],
      });
      const lines = result.content
        .split("\n")
        .filter((l) => l.includes("[[patterns/"));
      expect(lines[0]).toContain("alpha");
      expect(lines[1]).toContain("middle");
      expect(lines[2]).toContain("zebra");
    });

    it("places non-numeric ids after numeric ids", () => {
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing: null,
        actualEntries: ["S2", "S1", "misc"],
      });
      const lines = result.content
        .split("\n")
        .filter((l) => l.startsWith("| [["));
      expect(lines[0]).toContain("[[S1]]");
      expect(lines[1]).toContain("[[S2]]");
      expect(lines[2]).toContain("[[misc]]");
    });
  });

  // ─────────────────────────────────────────────
  // 增量同步（D6）
  // ─────────────────────────────────────────────
  describe("增量同步", () => {
    it("adds new entries to existing index", () => {
      const existing = parseIndex(
        "| ID | 名称 |\n| :-- | :-- |\n| [[S1]] | H2 输出 |",
      );
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing,
        actualEntries: ["S1", "S2"],
      });
      expect(result.content).toContain("[[S1]]");
      expect(result.content).toContain("[[S2]]");
      expect(result.added).toBe(1);
      expect(result.removed).toBe(0);
    });

    it("removes entries not present in directory", () => {
      const existing = parseIndex(
        "| ID | 名称 |\n| :-- | :-- |\n| [[S1]] | H2 输出 |\n| [[S99]] | 悬空 |",
      );
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing,
        actualEntries: ["S1"],
      });
      expect(result.content).toContain("[[S1]]");
      expect(result.content).not.toContain("[[S99]]");
      expect(result.added).toBe(0);
      expect(result.removed).toBe(1);
    });

    it("preserves manual columns (name) for existing rows", () => {
      const existing = parseIndex(
        "| ID | 名称 |\n| :-- | :-- |\n| [[S1]] | H2 输出 |",
      );
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing,
        actualEntries: ["S1"],
      });
      expect(result.content).toContain("H2 输出");
    });

    it("preserves extra content after the table", () => {
      const existing = parseIndex(
        "| ID |\n| :-- |\n| [[A1]] | x |\n\n## 变更规则\n\n承重墙。",
      );
      const result = renderIndex({
        kind: EntryKindValues.Agreement,
        existing,
        actualEntries: ["A1"],
      });
      expect(result.content).toContain("## 变更规则");
      expect(result.content).toContain("承重墙");
    });

    it("preserves abnormal rows", () => {
      const existing = parseIndex(
        "| ID |\n| :-- |\n| [[S1]] | ok |\nthis is broken",
      );
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing,
        actualEntries: ["S1"],
      });
      expect(result.content).toContain("this is broken");
    });
  });

  // ─────────────────────────────────────────────
  // 无变更（D6=A）
  // ─────────────────────────────────────────────
  describe("无变更", () => {
    it("returns original content when nothing changed", () => {
      const original = "| ID | 名称 |\n| :-- | :-- |\n| [[S1]] | H2 输出 |";
      const existing = parseIndex(original);
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing,
        actualEntries: ["S1"],
      });
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
      // 无变更时 content 应保持等价（允许格式规范化）
      expect(result.content).toContain("[[S1]]");
      expect(result.content).toContain("H2 输出");
    });
  });
});
