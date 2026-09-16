import { describe, expect, it } from "vitest";
import {
  bundleInput,
  createFile,
  deleteFile,
  hashOf,
} from "@/domain/apply/__tests__/testHelpers";
import { BundleActionValues } from "@/domain/apply/BundleAction";
import { validateBundle } from "@/domain/apply/validateBundle";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import type { BundleFileInput } from "@/domain/apply/BundleInput";
import type { ValidatedFile } from "@/domain/apply/validateBundle";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

function run(
  files: readonly BundleFileInput[],
): Result<readonly ValidatedFile[], readonly Issue[]> {
  return validateBundle(bundleInput(files), hashOf);
}

function issuesOf(
  result: Result<readonly ValidatedFile[], readonly Issue[]>,
): readonly Issue[] {
  if (result.ok) throw new Error("expected Err");
  return result.error;
}

function valuesOf(
  result: Result<readonly ValidatedFile[], readonly Issue[]>,
): readonly ValidatedFile[] {
  if (!result.ok) {
    throw new Error(
      `expected Ok, got: ${result.error.map((i) => i.format()).join(" | ")}`,
    );
  }
  return result.value;
}

describe("validateBundle", () => {
  describe("通过的情形", () => {
    it("accepts a self-consistent create", () => {
      const files = valuesOf(run([createFile("skills/S1.md", "# S1\nbody")]));
      expect(files).toHaveLength(1);
      expect(files[0]?.path).toBe("skills/S1.md");
    });

    it("normalizes the path it hands downstream", () => {
      const files = valuesOf(
        run([createFile("COLLABORATION/skills/S1.md", "body")]),
      );
      expect(files[0]?.path).toBe("skills/S1.md");
    });

    it("accepts a delete without content or sha256", () => {
      const files = valuesOf(run([deleteFile("skills/S1.md")]));
      expect(files[0]?.action).toBe(BundleActionValues.Delete);
    });
  });

  describe("空内容（E2 / E3）", () => {
    it("rejects empty content", () => {
      const issues = issuesOf(run([createFile("skills/S1.md", "")]));
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleEmptyContent,
      ]);
    });

    it("rejects whitespace-only content", () => {
      const issues = issuesOf(run([createFile("skills/S1.md", "  \n\n\t ")]));
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleEmptyContent,
      ]);
    });

    it("rejects a missing content field", () => {
      const issues = issuesOf(
        run([
          {
            path: "skills/S1.md",
            action: BundleActionValues.Create,
            content: null,
            sha256: null,
            baseSha256: null,
          },
        ]),
      );
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleEmptyContent,
      ]);
    });

    it("reports the offending path", () => {
      const issues = issuesOf(run([createFile("skills/S1.md", "")]));
      expect(issues[0]?.path).toBe("skills/S1.md");
    });
  });

  describe("哈希一致（E13）", () => {
    it("rejects a sha256 that does not match the content", () => {
      const file: BundleFileInput = {
        ...createFile("skills/S1.md", "real content"),
        sha256: hashOf("different content"),
      };
      const issues = issuesOf(run([file]));
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleHashMismatch,
      ]);
    });

    it("rejects a missing sha256", () => {
      const file: BundleFileInput = {
        ...createFile("skills/S1.md", "real content"),
        sha256: null,
      };
      const issues = issuesOf(run([file]));
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleHashMismatch,
      ]);
    });

    it("does not hash delete entries", () => {
      const files = valuesOf(run([deleteFile("skills/S1.md")]));
      expect(files).toHaveLength(1);
    });
  });

  describe("路径（E4 / E5 / E6）", () => {
    it("rejects an unsafe path", () => {
      const issues = issuesOf(run([createFile("../evil.md", "body")]));
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundlePathInvalid,
      ]);
    });
  });

  describe("收集所有问题", () => {
    it("rejects an empty files list", () => {
      const issues = issuesOf(run([]));
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleInvalid,
      ]);
    });

    it("reports every broken file, not just the first", () => {
      const issues = issuesOf(
        run([
          createFile("skills/S1.md", ""),
          createFile("skills/S2.md", "ok"),
          { ...createFile("skills/S3.md", "body"), sha256: "nope" },
          createFile("../evil.md", "body"),
        ]),
      );
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleEmptyContent,
        IssueCodeValues.BundleHashMismatch,
        IssueCodeValues.BundlePathInvalid,
      ]);
    });
  });
});
