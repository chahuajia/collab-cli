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
  // 匹配 1：id（前提是已登记为 alias —— 见 idIsAlias 规则）
  // ─────────────────────────────────────────────
  describe("按 id 匹配", () => {
    it("resolves a bare id (renderer does this via aliases)", () => {
      expect(
        resolvesRef(
          "A1",
          ctx({
            entryIds: ["A1"],
            markdownPaths: ["agreements/A1-output-format"],
          }),
        ),
      ).toBe(true);
    });

    it("also resolves the same entry by its file name", () => {
      expect(
        resolvesRef(
          "A1-output-format",
          ctx({
            entryIds: ["A1"],
            markdownPaths: ["agreements/A1-output-format"],
          }),
        ),
      ).toBe(true);
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
  // 匹配 3：带目录前缀（末段 = 文件名）
  // ─────────────────────────────────────────────
  describe("末段 = 文件名", () => {
    it("matches [[patterns/rooted-graph]] against path patterns/rooted-graph", () => {
      expect(
        resolvesRef(
          "patterns/rooted-graph",
          ctx({ markdownPaths: ["patterns/rooted-graph"] }),
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
  it("matches a bare id (id is the stable anchor)", () => {
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

// ─────────────────────────────────────────────
// `.md` 后缀：两种写法等价（2026-10-06 修的 bug）
// ─────────────────────────────────────────────
describe("resolvesRef —— `.md` 后缀", () => {
  /**
   * 最小复现（真跑过）：`[[patterns/alpha.md]]`，而 `patterns/alpha.md` **确实存在** ——
   * 修之前报 `DEAD_LINK`。根因：`allMarkdownPaths` 与 `fileNameOf` 都是**不带扩展名**的口径，
   * 而第 1 步的完整路径匹配拿原文去比 → 带 `.md` 的引用永远匹配不上。
   */
  it("带 .md 的完整路径能解析（修之前会误报 DEAD_LINK）", () => {
    expect(
      resolvesRef(
        "patterns/alpha.md",
        ctx({ markdownPaths: ["patterns/alpha"] }),
      ),
    ).toBe(true);
  });

  it("不带 .md 的写法仍然解析（没退化）", () => {
    expect(
      resolvesRef("patterns/alpha", ctx({ markdownPaths: ["patterns/alpha"] })),
    ).toBe(true);
  });

  it("带 .md 的文件名末段也能解析", () => {
    expect(
      resolvesRef(
        "alpha.md",
        ctx({ entryIds: ["alpha"], markdownPaths: ["patterns/alpha"] }),
      ),
    ).toBe(true);
  });

  it("不存在的路径带 .md 仍然解析失败（别把宽容做成假绿）", () => {
    expect(
      resolvesRef("patterns/nope.md", ctx({ markdownPaths: ["patterns/alpha"] })),
    ).toBe(false);
  });
});
