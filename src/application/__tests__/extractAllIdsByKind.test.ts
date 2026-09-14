import { describe, it, expect } from "vitest";
import { makeEntry } from "@/domain/entry/__tests__/testHelpers";
import { EntryKindDir, EntryKindValues } from "@/domain/entry/types";
import { extractAllIdsByKind } from "../extractAllIdsByKind.js";
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
 *
 * 测试数据的构造需要"合法的 entry"，而合法 entry 需要"正确的 type"。
 * 从 path 推断让测试数据只需"写 path 和 id"。
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
 * - **可显式覆盖 type**（用于测试特殊场景）。
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
  };
}

describe("extractAllIdsByKind", () => {
  // ─────────────────────────────────────────────
  // 空 workspace
  // ─────────────────────────────────────────────
  describe("空 workspace", () => {
    it("returns empty array for every kind", () => {
      const workspace = makeWorkspace([]);
      const result = extractAllIdsByKind(workspace);

      expect(result.get(EntryKindValues.Skill)).toEqual([]);
      expect(result.get(EntryKindValues.Agreement)).toEqual([]);
      expect(result.get(EntryKindValues.Workflow)).toEqual([]);
      expect(result.get(EntryKindValues.Pattern)).toEqual([]);
      expect(result.get(EntryKindValues.Adr)).toEqual([]);
    });

    it("has entries for all 5 kinds", () => {
      const result = extractAllIdsByKind(makeWorkspace([]));
      expect(result.size).toBe(5);
    });
  });

  // ─────────────────────────────────────────────
  // 单个 kind
  // ─────────────────────────────────────────────
  describe("单个 kind", () => {
    it("extracts a single skill", () => {
      const workspace = makeWorkspace([{ path: "skills/S1.md", id: "S1" }]);
      const result = extractAllIdsByKind(workspace);
      expect(result.get(EntryKindValues.Skill)).toEqual(["S1"]);
    });

    it("extracts multiple skills", () => {
      const workspace = makeWorkspace([
        { path: "skills/S1.md", id: "S1" },
        { path: "skills/S2.md", id: "S2" },
        { path: "skills/S3.md", id: "S3" },
      ]);
      const result = extractAllIdsByKind(workspace);
      expect(result.get(EntryKindValues.Skill)).toEqual(["S1", "S2", "S3"]);
    });

    it("extracts an ADR with nested path", () => {
      const workspace = makeWorkspace([
        { path: "meta/decision-records/ADR-0001.md", id: "ADR-0001" },
      ]);
      const result = extractAllIdsByKind(workspace);
      expect(result.get(EntryKindValues.Adr)).toEqual(["ADR-0001"]);
    });
  });

  // ─────────────────────────────────────────────
  // 多 kind 混合
  // ─────────────────────────────────────────────
  describe("多 kind 混合", () => {
    it("groups entries by kind", () => {
      const workspace = makeWorkspace([
        { path: "skills/S1.md", id: "S1" },
        { path: "agreements/A1.md", id: "A1" },
        { path: "workflows/W1.md", id: "W1" },
        { path: "patterns/rooted-graph.md", id: "rooted-graph" },
        { path: "meta/decision-records/ADR-0001.md", id: "ADR-0001" },
      ]);
      const result = extractAllIdsByKind(workspace);
      expect(result.get(EntryKindValues.Skill)).toEqual(["S1"]);
      expect(result.get(EntryKindValues.Agreement)).toEqual(["A1"]);
      expect(result.get(EntryKindValues.Workflow)).toEqual(["W1"]);
      expect(result.get(EntryKindValues.Pattern)).toEqual(["rooted-graph"]);
      expect(result.get(EntryKindValues.Adr)).toEqual(["ADR-0001"]);
    });
  });

  // ─────────────────────────────────────────────
  // 嵌套目录
  // ─────────────────────────────────────────────
  describe("嵌套目录", () => {
    it("includes entries from nested subdirectories", () => {
      const workspace = makeWorkspace([
        { path: "skills/S1.md", id: "S1" },
        { path: "skills/advanced/S12.md", id: "S12" },
      ]);
      const result = extractAllIdsByKind(workspace);
      expect(result.get(EntryKindValues.Skill)).toEqual(["S1", "S12"]);
    });

    it("distinguishes meta/decision-records from other meta subdirs", () => {
      const workspace = makeWorkspace([
        { path: "meta/decision-records/ADR-0001.md", id: "ADR-0001" },
        { path: "meta/naming-conventions.md", id: "not-an-adr" },
      ]);
      const result = extractAllIdsByKind(workspace);
      expect(result.get(EntryKindValues.Adr)).toEqual(["ADR-0001"]);
    });
  });

  // ─────────────────────────────────────────────
  // 跳过解析失败的条目
  // ─────────────────────────────────────────────
  describe("跳过解析失败的条目", () => {
    it("skips entries with null entry", () => {
      const workspace = makeWorkspace([
        { path: "skills/S1.md", id: "S1" },
        { path: "skills/broken.md", id: null },
      ]);
      const result = extractAllIdsByKind(workspace);
      expect(result.get(EntryKindValues.Skill)).toEqual(["S1"]);
    });

    it("handles workspace with only broken entries", () => {
      const workspace = makeWorkspace([{ path: "skills/broken.md", id: null }]);
      const result = extractAllIdsByKind(workspace);
      expect(result.get(EntryKindValues.Skill)).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // 不在任何已知目录的条目
  // ─────────────────────────────────────────────
  describe("不在任何已知目录的条目", () => {
    it("ignores entries outside known directories", () => {
      const workspace = makeWorkspace([
        { path: "skills/S1.md", id: "S1" },
        { path: "drafts/D1.md", id: "D1" },
      ]);
      const result = extractAllIdsByKind(workspace);
      expect(result.get(EntryKindValues.Skill)).toEqual(["S1"]);
      // drafts/D1 不属于任何 kind
      const allIds = Array.from(result.values()).flat();
      expect(allIds).not.toContain("D1");
    });
  });

  // ─────────────────────────────────────────────
  // 前缀边界（重要）
  // ─────────────────────────────────────────────
  describe("前缀边界", () => {
    it("does not match similar directory names (skills-archive)", () => {
      const workspace = makeWorkspace([
        { path: "skills-archive/S1.md", id: "S1" },
      ]);
      const result = extractAllIdsByKind(workspace);
      // "skills-archive/S1.md" 不应匹配 "skills/"
      expect(result.get(EntryKindValues.Skill)).toEqual([]);
    });
  });
});
