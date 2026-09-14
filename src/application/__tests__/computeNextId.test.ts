import { describe, it, expect } from "vitest";
import { computeNextId } from "@/application/computeNextId";
import { EntryKindValues } from "@/domain/entry/types";

describe("computeNextId", () => {
  // ─────────────────────────────────────────────
  // 基础：空列表
  // ─────────────────────────────────────────────
  describe("空列表", () => {
    it("returns S1 for empty skill list", () => {
      expect(computeNextId([], EntryKindValues.Skill)).toBe("S1");
    });

    it("returns A1 for empty agreement list", () => {
      expect(computeNextId([], EntryKindValues.Agreement)).toBe("A1");
    });

    it("returns W1 for empty workflow list", () => {
      expect(computeNextId([], EntryKindValues.Workflow)).toBe("W1");
    });

    it("returns ADR-0001 for empty adr list", () => {
      expect(computeNextId([], EntryKindValues.Adr)).toBe("ADR-0001");
    });
  });

  // ─────────────────────────────────────────────
  // 基础：顺序 id
  // ─────────────────────────────────────────────
  describe("顺序 id", () => {
    it("returns S4 for [S1, S2, S3]", () => {
      expect(computeNextId(["S1", "S2", "S3"], EntryKindValues.Skill)).toBe(
        "S4",
      );
    });

    it("returns S2 for [S1]", () => {
      expect(computeNextId(["S1"], EntryKindValues.Skill)).toBe("S2");
    });

    it("returns A2 for [A1]", () => {
      expect(computeNextId(["A1"], EntryKindValues.Agreement)).toBe("A2");
    });
  });

  // ─────────────────────────────────────────────
  // 数值序，不是字典序
  // ─────────────────────────────────────────────
  describe("数值序（不是字典序）", () => {
    it("returns S11 for [S1, S10]", () => {
      expect(computeNextId(["S1", "S10"], EntryKindValues.Skill)).toBe("S11");
    });

    it("returns S101 for [S1, S100, S99]", () => {
      expect(computeNextId(["S1", "S100", "S99"], EntryKindValues.Skill)).toBe(
        "S101",
      );
    });

    it("handles unordered input", () => {
      expect(computeNextId(["S5", "S3", "S1"], EntryKindValues.Skill)).toBe(
        "S6",
      );
    });
  });

  // ─────────────────────────────────────────────
  // 忽略不匹配的 id
  // ─────────────────────────────────────────────
  describe("忽略不匹配的 id", () => {
    it("ignores ids with wrong prefix", () => {
      expect(computeNextId(["S1", "X2", "A3"], EntryKindValues.Skill)).toBe(
        "S2",
      );
    });

    it("ignores malformed ids (non-numeric suffix)", () => {
      expect(computeNextId(["S1", "Sabc", "S"], EntryKindValues.Skill)).toBe(
        "S2",
      );
    });

    it("ignores empty ids", () => {
      expect(computeNextId(["S1", ""], EntryKindValues.Skill)).toBe("S2");
    });

    it("ignores ids with only prefix", () => {
      expect(computeNextId(["S1", "S"], EntryKindValues.Skill)).toBe("S2");
    });

    it("returns S1 when all ids are ignored", () => {
      expect(computeNextId(["X1", "Y2"], EntryKindValues.Skill)).toBe("S1");
    });
  });

  // ─────────────────────────────────────────────
  // ADR 的 4 位补零
  // ─────────────────────────────────────────────
  describe("ADR 补零", () => {
    it("returns ADR-0002 for [ADR-0001]", () => {
      expect(computeNextId(["ADR-0001"], EntryKindValues.Adr)).toBe("ADR-0002");
    });

    it("returns ADR-0010 for [ADR-0009]", () => {
      expect(computeNextId(["ADR-0009"], EntryKindValues.Adr)).toBe("ADR-0010");
    });

    it("returns ADR-0100 for [ADR-0099]", () => {
      expect(computeNextId(["ADR-0099"], EntryKindValues.Adr)).toBe("ADR-0100");
    });

    it("handles crossing 4 digits (no padding needed)", () => {
      expect(computeNextId(["ADR-0999"], EntryKindValues.Adr)).toBe("ADR-1000");
    });

    it("accepts non-padded ADR ids in input", () => {
      // 如果旧数据里有 ADR-1（不补零），也能识别
      expect(computeNextId(["ADR-1"], EntryKindValues.Adr)).toBe("ADR-0002");
    });
  });

  // ─────────────────────────────────────────────
  // Pattern 抛错
  // ─────────────────────────────────────────────
  describe("Pattern 抛错", () => {
    it("throws because pattern ids are manual", () => {
      expect(() => computeNextId([], EntryKindValues.Pattern)).toThrow();
    });

    it("throws with helpful message", () => {
      expect(() => computeNextId([], EntryKindValues.Pattern)).toThrow(
        /pattern|manual/i,
      );
    });
  });

  // ─────────────────────────────────────────────
  // 大数字
  // ─────────────────────────────────────────────
  describe("大数字", () => {
    it("handles S999 -> S1000", () => {
      expect(computeNextId(["S999"], EntryKindValues.Skill)).toBe("S1000");
    });

    it("handles S9999 -> S10000", () => {
      expect(computeNextId(["S9999"], EntryKindValues.Skill)).toBe("S10000");
    });
  });
});
