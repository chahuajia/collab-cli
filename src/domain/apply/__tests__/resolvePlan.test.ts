import { describe, expect, it } from "vitest";
import {
  createFile,
  deleteFile,
  factsOf,
  hashOf,
  replaceFile,
  validated,
} from "@/domain/apply/__tests__/testHelpers";
import { BundleActionValues } from "@/domain/apply/BundleAction";
import { resolvePlan } from "@/domain/apply/resolvePlan";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import type { ApplyPlan } from "@/domain/apply/ApplyPlan";
import type { WorkspaceFacts } from "@/domain/apply/ApplyWorkspace";
import type { BundleFileInput } from "@/domain/apply/BundleInput";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

const EXISTING = "existing content";

/** 目标已存在时的工作区事实。 */
function existingWorkspace(): WorkspaceFacts {
  return factsOf({ "skills/S1.md": hashOf(EXISTING) });
}

function planOf(
  files: readonly BundleFileInput[],
  facts: WorkspaceFacts,
): ApplyPlan {
  const result = resolvePlan(validated(files), facts);
  if (!result.ok) {
    throw new Error(
      `expected Ok, got: ${result.error.map((i) => i.format()).join(" | ")}`,
    );
  }
  return result.value;
}

function issuesOf(
  files: readonly BundleFileInput[],
  facts: WorkspaceFacts,
): readonly Issue[] {
  const result: Result<ApplyPlan, readonly Issue[]> = resolvePlan(
    validated(files),
    facts,
  );
  if (result.ok) throw new Error("expected Err");
  return result.error;
}

const EMPTY: WorkspaceFacts = factsOf({});

describe("resolvePlan", () => {
  describe("create", () => {
    it("plans a create when the target is missing", () => {
      const plan = planOf([createFile("skills/S1.md", "hello")], EMPTY);
      expect(plan.operations).toEqual([
        { kind: BundleActionValues.Create, path: "skills/S1.md", content: "hello" },
      ]);
    });

    it("rejects a create when the target exists (E7)", () => {
      const issues = issuesOf(
        [createFile("skills/S1.md", "hello")],
        existingWorkspace(),
      );
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleConflict,
      ]);
      expect(issues[0]?.message).toContain("already exists");
      expect(issues[0]?.suggestion).toContain("replace");
    });
  });

  describe("replace（E8 / E9）", () => {
    it("plans a replace when base_sha256 matches", () => {
      const plan = planOf(
        [replaceFile("skills/S1.md", "new content", hashOf(EXISTING))],
        existingWorkspace(),
      );
      expect(plan.operations).toEqual([
        {
          kind: BundleActionValues.Replace,
          path: "skills/S1.md",
          content: "new content",
        },
      ]);
    });

    it("rejects a replace when base_sha256 does not match", () => {
      const issues = issuesOf(
        [replaceFile("skills/S1.md", "new content", hashOf("stale"))],
        existingWorkspace(),
      );
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleConflict,
      ]);
      expect(issues[0]?.message).toContain("modified externally");
    });

    it("rejects a replace without base_sha256", () => {
      const issues = issuesOf(
        [
          {
            ...createFile("skills/S1.md", "new content"),
            action: BundleActionValues.Replace,
          },
        ],
        existingWorkspace(),
      );
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleConflict,
      ]);
    });

    it("rejects a replace when the target is missing", () => {
      const issues = issuesOf(
        [replaceFile("skills/S1.md", "new content", hashOf(EXISTING))],
        EMPTY,
      );
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleConflict,
      ]);
      expect(issues[0]?.suggestion).toContain("create");
    });
  });

  describe("delete（E10）", () => {
    it("plans a delete when the target exists", () => {
      const plan = planOf([deleteFile("skills/S1.md")], existingWorkspace());
      expect(plan.operations).toEqual([
        { kind: BundleActionValues.Delete, path: "skills/S1.md" },
      ]);
    });

    it("rejects a delete when the target is missing", () => {
      const issues = issuesOf([deleteFile("skills/S1.md")], EMPTY);
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleConflict,
      ]);
    });
  });

  describe("计划的性质", () => {
    it("keeps the bundle order", () => {
      const plan = planOf(
        [
          createFile("skills/S2.md", "two"),
          createFile("skills/S1.md", "one"),
          createFile("skills/S3.md", "three"),
        ],
        EMPTY,
      );
      expect(plan.operations.map((op) => op.path)).toEqual([
        "skills/S2.md",
        "skills/S1.md",
        "skills/S3.md",
      ]);
    });

    it("counts operations by kind", () => {
      const plan = planOf(
        [
          createFile("skills/S2.md", "two"),
          replaceFile("skills/S1.md", "new", hashOf(EXISTING)),
        ],
        existingWorkspace(),
      );
      expect(plan.count()).toBe(2);
      expect(plan.countOf(BundleActionValues.Create)).toBe(1);
      expect(plan.countOf(BundleActionValues.Replace)).toBe(1);
      expect(plan.countOf(BundleActionValues.Delete)).toBe(0);
    });

    it("reports every conflict, not just the first", () => {
      const issues = issuesOf(
        [createFile("skills/S1.md", "hello"), deleteFile("skills/S9.md")],
        existingWorkspace(),
      );
      expect(issues).toHaveLength(2);
    });
  });
});
