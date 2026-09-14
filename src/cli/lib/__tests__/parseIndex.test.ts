import { describe, it, expect } from "vitest";
import { parseIndex } from "../parseIndex.js";

describe("parseIndex", () => {
  // ─────────────────────────────────────────────
  // 标准格式
  // ─────────────────────────────────────────────
  describe("标准格式", () => {
    it("parses title, header, and data rows", () => {
      const content = [
        "# 技能索引",
        "",
        "| ID | 名称 | 领域 | 状态 |",
        "| :----- | :- | :- | :--- |",
        "| [[S1]] | H2 输出 | meta | active |",
        "| [[S2]] | CSP 报告配置 | security | active |",
      ].join("\n");

      const parsed = parseIndex(content);
      expect(parsed.title).toBe("技能索引");
      expect(parsed.headerLines).toHaveLength(2);
      expect(parsed.dataRows).toHaveLength(2);
      expect(parsed.dataRows[0]?.ref).toBe("S1");
      expect(parsed.dataRows[1]?.ref).toBe("S2");
    });

    it("preserves raw rows unchanged", () => {
      const content = [
        "# 技能索引",
        "",
        "| ID | 名称 |",
        "| :----- | :- |",
        "| [[S1]] | H2 输出 |",
      ].join("\n");

      const parsed = parseIndex(content);
      expect(parsed.dataRows[0]?.raw).toBe("| [[S1]] | H2 输出 |");
    });
  });

  // ─────────────────────────────────────────────
  // 长短引用
  // ─────────────────────────────────────────────
  describe("引用形式", () => {
    it("extracts short ref [[S1]]", () => {
      const content = "| [[S1]] |\n| :-- |\n| [[S1]] | x |";
      const parsed = parseIndex(content);
      expect(parsed.dataRows[0]?.ref).toBe("S1");
    });

    it("extracts long ref [[patterns/rooted-graph]]", () => {
      const content = [
        "| 模式 | 来源 |",
        "| :-- | :-- |",
        "| [[patterns/rooted-graph]] | 图论 |",
      ].join("\n");
      const parsed = parseIndex(content);
      expect(parsed.dataRows[0]?.ref).toBe("patterns/rooted-graph");
    });

    it("returns null ref for rows without links", () => {
      const content = "| ID |\n| :-- |\n| no link here |";
      const parsed = parseIndex(content);
      expect(parsed.dataRows[0]?.ref).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // 额外内容（D7）
  // ─────────────────────────────────────────────
  describe("额外内容", () => {
    it("preserves content after the table", () => {
      const content = [
        "# 约定索引",
        "",
        "| ID | 名称 |",
        "| :-- | :-- |",
        "| [[A1]] | 输出从 H2 开始 |",
        "",
        "## 变更规则",
        "",
        "约定是承重墙。",
      ].join("\n");

      const parsed = parseIndex(content);
      expect(parsed.extraContent).toContain("## 变更规则");
      expect(parsed.extraContent).toContain("约定是承重墙");
    });

    it("returns empty extraContent when no extra", () => {
      const content = "| ID |\n| :-- |\n| [[S1]] |";
      const parsed = parseIndex(content);
      expect(parsed.extraContent).toBe("");
    });

    it("preserves abnormal rows (D7=A)", () => {
      const content = [
        "| ID | 名称 |",
        "| :-- | :-- |",
        "| [[S1]] | ok |",
        "this is a broken row",
        "| [[S2]] | also ok |",
      ].join("\n");

      const parsed = parseIndex(content);
      // 异常行按 raw 保留
      expect(parsed.dataRows).toHaveLength(3);
      expect(parsed.dataRows[1]?.ref).toBeNull();
      expect(parsed.dataRows[1]?.raw).toBe("this is a broken row");
    });
  });

  // ─────────────────────────────────────────────
  // 空 / 边界
  // ─────────────────────────────────────────────
  describe("边界", () => {
    it("handles empty content", () => {
      const parsed = parseIndex("");
      expect(parsed.title).toBe("");
      expect(parsed.dataRows).toHaveLength(0);
    });

    it("handles content without title", () => {
      const content = "| ID |\n| :-- |\n| [[S1]] |";
      const parsed = parseIndex(content);
      expect(parsed.title).toBe("");
      expect(parsed.dataRows).toHaveLength(1);
    });

    it("handles Windows line endings", () => {
      const content = "# 技能索引\r\n\r\n| ID |\r\n| :-- |\r\n| [[S1]] | x |";
      const parsed = parseIndex(content);
      expect(parsed.title).toBe("技能索引");
      expect(parsed.dataRows[0]?.ref).toBe("S1");
    });
  });
});
