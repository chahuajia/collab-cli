import { describe, it, expect } from "vitest";
import { extractAllIndexEntries } from "@/application/extractIndexEntries";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { EntryKindDir, EntryKindValues } from "@/domain/entry/types";
import type { IndexEntry } from "@/application/extractIndexEntries";
import type { Workspace } from "@/domain/entry/WorkspaceLoader";

type EntryTypeKey = keyof typeof EntryKindValues;

function isEntryKindKey(value: string): value is keyof typeof EntryKindValues {
  return value in EntryKindValues;
}

/**
 * 从 path 推断 EntryKind。
 *
 * @remarks
 * - 用 `EntryKindDir` 反查 —— 单一真相源。
 * - **不在已知目录** → fallback 到 `Pattern`（无前缀约束，最宽松）。
 */
function inferTypeFromPath(path: string): keyof typeof EntryKindValues {
  const normalized = path.replace(/\\/g, "/");
  for (const key of Object.keys(EntryKindValues)) {
    if (!isEntryKindKey(key)) continue;
    const dir = EntryKindDir[EntryKindValues[key]];
    if (normalized === dir || normalized.startsWith(dir + "/")) {
      return key;
    }
  }
  return "Pattern";
}

/**
 * 构造一个"极简 Workspace"。
 *
 * @remarks
 * - **用 `makeEntry` 工厂** —— 不绕断言。
 * - **type 从 path 推断** —— 测试数据只需写 `path` 和 `id`。
 * - **`id === null`** → `entry = null`（模拟解析失败）。
 */
function makeWorkspace(
  entries: readonly {
    path: string;
    id: string | null;
    type?: EntryTypeKey;
  }[],
): Workspace {
  return {
    entries: entries.map((e) => ({
      path: e.path,
      entry:
        e.id === null
          ? null
          : makeEntry({
              id: e.id,
              type: e.type ?? inferTypeFromPath(e.path),
              path: e.path,
            }),
      parseIssues: [],
    })),
    indexFiles: new Map(),
    allMarkdownPaths: new Set(entries.map((e) => e.path)),
  };
}

/** 投影成 id 列表 —— 大部分用例关心的是"哪些条目进了索引"。 */
function idsOf(entries: readonly IndexEntry[] | undefined): string[] {
  return (entries ?? []).map((entry) => entry.id);
}

describe("extractAllIndexEntries", () => {
  describe("空 workspace", () => {
    it("returns empty array for every kind", () => {
      const result = extractAllIndexEntries(makeWorkspace([]));

      expect(result.get(EntryKindValues.Skill)).toEqual([]);
      expect(result.get(EntryKindValues.Agreement)).toEqual([]);
      expect(result.get(EntryKindValues.Workflow)).toEqual([]);
      expect(result.get(EntryKindValues.Pattern)).toEqual([]);
      expect(result.get(EntryKindValues.Adr)).toEqual([]);
    });

    it("has entries for all 5 kinds", () => {
      expect(extractAllIndexEntries(makeWorkspace([])).size).toBe(5);
    });
  });

  describe("单个 kind", () => {
    it("extracts a single skill", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([{ path: "skills/S1.md", id: "S1" }]),
      );
      expect(idsOf(result.get(EntryKindValues.Skill))).toEqual(["S1"]);
    });

    it("extracts multiple skills", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([
          { path: "skills/S1.md", id: "S1" },
          { path: "skills/S2.md", id: "S2" },
          { path: "skills/S3.md", id: "S3" },
        ]),
      );
      expect(idsOf(result.get(EntryKindValues.Skill))).toEqual([
        "S1",
        "S2",
        "S3",
      ]);
    });

    it("extracts an ADR with nested path", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([
          { path: "meta/decision-records/ADR-0001.md", id: "ADR-0001" },
        ]),
      );
      expect(idsOf(result.get(EntryKindValues.Adr))).toEqual(["ADR-0001"]);
    });
  });

  // ─────────────────────────────────────────────
  // fileName —— 本次新增的字段
  // ─────────────────────────────────────────────
  describe("fileName", () => {
    it("strips the directory and the .md suffix", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([{ path: "skills/S1-h2-output.md", id: "S1" }]),
      );
      expect(result.get(EntryKindValues.Skill)).toEqual([
        { id: "S1", fileName: "S1-h2-output" },
      ]);
    });

    it("normalizes Windows separators", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([{ path: "skills\\S1-h2-output.md", id: "S1" }]),
      );
      expect(result.get(EntryKindValues.Skill)?.[0]?.fileName).toBe(
        "S1-h2-output",
      );
    });

    it("keeps a long file name intact for ADRs", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([
          {
            path: "meta/decision-records/ADR-0001-adopt-v3.md",
            id: "ADR-0001",
          },
        ]),
      );
      expect(result.get(EntryKindValues.Adr)?.[0]).toEqual({
        id: "ADR-0001",
        fileName: "ADR-0001-adopt-v3",
      });
    });
  });

  describe("多 kind 混合", () => {
    it("groups entries by kind", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([
          { path: "skills/S1.md", id: "S1" },
          { path: "agreements/A1.md", id: "A1" },
          { path: "workflows/W1.md", id: "W1" },
          { path: "patterns/rooted-graph.md", id: "rooted-graph" },
          { path: "meta/decision-records/ADR-0001.md", id: "ADR-0001" },
        ]),
      );
      expect(idsOf(result.get(EntryKindValues.Skill))).toEqual(["S1"]);
      expect(idsOf(result.get(EntryKindValues.Agreement))).toEqual(["A1"]);
      expect(idsOf(result.get(EntryKindValues.Workflow))).toEqual(["W1"]);
      expect(idsOf(result.get(EntryKindValues.Pattern))).toEqual([
        "rooted-graph",
      ]);
      expect(idsOf(result.get(EntryKindValues.Adr))).toEqual(["ADR-0001"]);
    });
  });

  describe("嵌套目录", () => {
    it("includes entries from nested subdirectories", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([
          { path: "skills/S1.md", id: "S1" },
          { path: "skills/advanced/S12.md", id: "S12" },
        ]),
      );
      expect(idsOf(result.get(EntryKindValues.Skill))).toEqual(["S1", "S12"]);
    });

    it("distinguishes meta/decision-records from other meta subdirs", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([
          { path: "meta/decision-records/ADR-0001.md", id: "ADR-0001" },
          { path: "meta/naming-conventions.md", id: "not-an-adr" },
        ]),
      );
      expect(idsOf(result.get(EntryKindValues.Adr))).toEqual(["ADR-0001"]);
    });
  });

  describe("跳过解析失败的条目", () => {
    it("skips entries with null entry", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([
          { path: "skills/S1.md", id: "S1" },
          { path: "skills/broken.md", id: null },
        ]),
      );
      expect(idsOf(result.get(EntryKindValues.Skill))).toEqual(["S1"]);
    });

    it("handles workspace with only broken entries", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([{ path: "skills/broken.md", id: null }]),
      );
      expect(result.get(EntryKindValues.Skill)).toEqual([]);
    });
  });

  describe("不在任何已知目录的条目", () => {
    it("ignores entries outside known directories", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([
          { path: "skills/S1.md", id: "S1" },
          { path: "drafts/D1.md", id: "D1" },
        ]),
      );
      expect(idsOf(result.get(EntryKindValues.Skill))).toEqual(["S1"]);
      const allIds = Array.from(result.values()).flatMap(idsOf);
      expect(allIds).not.toContain("D1");
    });
  });

  describe("前缀边界", () => {
    it("does not match similar directory names (skills-archive)", () => {
      const result = extractAllIndexEntries(
        makeWorkspace([{ path: "skills-archive/S1.md", id: "S1" }]),
      );
      expect(result.get(EntryKindValues.Skill)).toEqual([]);
    });
  });
});
