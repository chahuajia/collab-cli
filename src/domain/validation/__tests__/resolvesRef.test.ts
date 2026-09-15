import { describe, it, expect } from "vitest";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { refersTo, resolvesRef } from "@/domain/validation/resolvesRef";
import type { RuleContext } from "@/domain/validation/Rule";



function ctx(
  input: {
    entryIds?: readonly string[];
    markdownPaths?: readonly string[];
  } = {},
): RuleContext {
  return {
    allEntries: [],
    allEntryIds: new Set(input.entryIds ?? []),
    indexFiles: new Map(),
    allMarkdownPaths: new Set(input.markdownPaths ?? []),
  };
}

describe("resolvesRef", () => {
  // ─────────────────────────────────────────────
  // 匹配 1：短 id
  // ─────────────────────────────────────────────
  describe("短 id 匹配", () => {
    it("matches exact id [[A1]]", () => {
      expect(resolvesRef("A1", ctx({ entryIds: ["A1"] }))).toBe(true);
    });

    it("misses when id not in allEntryIds", () => {
      expect(resolvesRef("A1", ctx({ entryIds: ["A2"] }))).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // 匹配 2：完整路径
  // ─────────────────────────────────────────────
  describe("完整路径匹配", () => {
    it("matches exact markdown path", () => {
      expect(
        resolvesRef(
          "agreements/A1-output-format",
          ctx({
            markdownPaths: ["agreements/A1-output-format"],
          }),
        ),
      ).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 匹配 3：末段短 id（带目录前缀）
  // ─────────────────────────────────────────────
  describe("末段短 id", () => {
    it("matches [[patterns/rooted-graph]] against id rooted-graph", () => {
      expect(
        resolvesRef(
          "patterns/rooted-graph",
          ctx({ entryIds: ["rooted-graph"] }),
        ),
      ).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 匹配 4：文件名匹配（长链接的核心）
  // ─────────────────────────────────────────────
  describe("文件名匹配", () => {
    it("matches [[A1-output-format]] when path ends with same segment", () => {
      expect(
        resolvesRef(
          "A1-output-format",
          ctx({
            markdownPaths: ["agreements/A1-output-format"],
          }),
        ),
      ).toBe(true);
    });

    it("matches [[W5-update-collaboration]] when path ends with same segment", () => {
      expect(
        resolvesRef(
          "W5-update-collaboration",
          ctx({
            markdownPaths: ["workflows/W5-update-collaboration"],
          }),
        ),
      ).toBe(true);
    });

    it("does not match when segment differs", () => {
      expect(
        resolvesRef(
          "A1-wrong-name",
          ctx({
            markdownPaths: ["agreements/A1-output-format"],
          }),
        ),
      ).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // 边界：都没匹配上
  // ─────────────────────────────────────────────
  describe("miss 场景", () => {
    it("returns false when nothing matches", () => {
      expect(resolvesRef("S99", ctx())).toBe(false);
    });

    it("returns false when similar prefix but different suffix", () => {
      expect(
        resolvesRef(
          "A1",
          ctx({
            markdownPaths: ["agreements/A10-review"],
          }),
        ),
      ).toBe(false);
    });
  });
});

describe("refersTo", () => {
  it("matches short id", () => {
    const entry = makeEntry({
      id: "A1",
      type: "Agreement",
      path: "agreements/A1-output-format.md",
    });
    expect(refersTo("A1", entry)).toBe(true);
  });

  it("matches file name", () => {
    const entry = makeEntry({
      id: "A1",
      type: "Agreement",
      path: "agreements/A1-output-format.md",
    });
    expect(refersTo("A1-output-format", entry)).toBe(true);
  });

  it("matches full path form", () => {
    const entry = makeEntry({
      id: "A1",
      type: "Agreement",
      path: "agreements/A1-output-format.md",
    });
    expect(refersTo("agreements/A1-output-format", entry)).toBe(true);
  });

  it("does not match different id", () => {
    const entry = makeEntry({
      id: "A1",
      type: "Agreement",
      path: "agreements/A1-output-format.md",
    });
    expect(refersTo("A2", entry)).toBe(false);
  });
});
