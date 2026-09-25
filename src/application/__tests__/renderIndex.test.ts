import { describe, it, expect } from "vitest";
import { parseIndex } from "@/application/parseIndex";
import { renderIndex } from "@/application/renderIndex";
import { EntryKindValues } from "@/domain/entry/types";
import type { IndexEntry } from "@/application/extractIndexEntries";

/**
 * 构造索引条目。
 *
 * @remarks
 * `fileName` 默认与 `id` 相同（最简情形）。
 * "文件名与 id 不同"（如 `S1-h2-output` + `id: S1`）由专门的用例覆盖。
 */
function entries(...ids: string[]): IndexEntry[] {
  return ids.map((id) => ({ id, fileName: id }));
}

describe("renderIndex", () => {
  // ─────────────────────────────────────────────
  // 生成新 index
  // ─────────────────────────────────────────────
  describe("生成新 index", () => {
    it("creates skill index with standard header", () => {
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing: null,
        actualEntries: entries("S1", "S2", "S3"),
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
        actualEntries: entries("rooted-graph", "pattern-language"),
      });
      expect(result.content).toContain("[[patterns/rooted-graph]]");
      expect(result.content).toContain("[[patterns/pattern-language]]");
    });

    it("creates empty index for empty directory", () => {
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing: null,
        actualEntries: entries(),
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
        actualEntries: entries("S10", "S2", "S1", "S20", "S3"),
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
        actualEntries: entries("zebra", "alpha", "middle"),
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
        actualEntries: entries("S2", "S1", "misc"),
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
        actualEntries: entries("S1", "S2"),
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
        actualEntries: entries("S1"),
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
        actualEntries: entries("S1"),
      });
      expect(result.content).toContain("H2 输出");
    });

    // ─────────────────────────────────────────────
    // 回归：文件名式引用（2026-09-16 实测事故）
    // ─────────────────────────────────────────────
    it("normalizes file-name anchors to id while preserving manual columns", () => {
      const existing = parseIndex(
        "| ID | 名称 | 领域 | 状态 |\n| :-- | :-- | :-- | :-- |\n| [[S1-h2-output]] | H2 输出 | meta | active |",
      );
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing,
        actualEntries: [{ id: "S1", fileName: "S1-h2-output" }],
      });

      expect(result.removed).toBe(0);
      expect(result.added).toBe(0);
      expect(result.normalized).toBe(1);
      expect(result.content).toContain("[[S1]]");
      expect(result.content).not.toContain("[[S1-h2-output]]");
      expect(result.content).toContain("H2 输出");
      expect(result.content).toContain("meta");
      expect(result.content).toContain("active");
    });

    it("still removes a row whose ref matches nothing", () => {
      const existing = parseIndex(
        "| ID |\n| :-- |\n| [[S1-h2-output]] | x |\n| [[S99-gone]] | x |",
      );
      const result = renderIndex({
        kind: EntryKindValues.Skill,
        existing,
        actualEntries: [{ id: "S1", fileName: "S1-h2-output" }],
      });

      expect(result.removed).toBe(1);
      expect(result.content).toContain("[[S1]]");
      expect(result.content).not.toContain("[[S99-gone]]");
    });

    it("preserves extra content after the table", () => {
      const existing = parseIndex(
        "| ID |\n| :-- |\n| [[A1]] | x |\n\n## 变更规则\n\n承重墙。",
      );
      const result = renderIndex({
        kind: EntryKindValues.Agreement,
        existing,
        actualEntries: entries("A1"),
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
        actualEntries: entries("S1"),
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
        actualEntries: entries("S1"),
      });
      expect(result.added).toBe(0);
      expect(result.removed).toBe(0);
      // 无变更时 content 应保持等价（允许格式规范化）
      expect(result.content).toContain("[[S1]]");
      expect(result.content).toContain("H2 输出");
    });
  });
});
