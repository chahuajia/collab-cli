import { describe, expect, it } from "vitest";
import { BundleActionValues } from "@/domain/apply/BundleAction";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { SupportedBundleVersion, parseBundle } from "@/infrastructure/parsing/BundleParser";
import type { BundleInput } from "@/domain/apply/BundleInput";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

function valuesOf(
  result: Result<BundleInput, readonly Issue[]>,
): BundleInput {
  if (!result.ok) {
    throw new Error(
      `expected Ok, got: ${result.error.map((i) => i.format()).join(" | ")}`,
    );
  }
  return result.value;
}

function issuesOf(
  result: Result<BundleInput, readonly Issue[]>,
): readonly Issue[] {
  if (result.ok) throw new Error("expected Err");
  return result.error;
}

const MINIMAL_FILE = {
  path: "skills/S36-x.md",
  action: "create",
  content: "---\nid: S36\n---\n",
  sha256: "abc",
  base_sha256: null,
};

describe("parseBundle", () => {
  describe("接受的情形", () => {
    it("parses a minimal bundle", () => {
      const bundle = valuesOf(
        parseBundle({ version: 1, files: [MINIMAL_FILE] }),
      );
      expect(bundle.version).toBe(SupportedBundleVersion);
      expect(bundle.files).toHaveLength(1);
    });

    it("maps snake_case metadata to camelCase", () => {
      const bundle = valuesOf(
        parseBundle({
          version: 1,
          generated_at: "2026-09-16T10:00:00Z",
          generated_by: "AI",
          base_commit: "1ae6a33",
          files: [],
        }),
      );
      expect(bundle.generatedAt).toBe("2026-09-16T10:00:00Z");
      expect(bundle.generatedBy).toBe("AI");
      expect(bundle.baseCommit).toBe("1ae6a33");
    });

    it("defaults absent optional fields to null", () => {
      const bundle = valuesOf(
        parseBundle({
          version: 1,
          files: [{ path: "skills/S1.md", action: "delete" }],
        }),
      );
      const file = bundle.files[0];
      expect(file?.content).toBeNull();
      expect(file?.sha256).toBeNull();
      expect(file?.baseSha256).toBeNull();
      expect(bundle.generatedAt).toBeNull();
      expect(bundle.baseCommit).toBeNull();
    });

    it("accepts an empty files list (rejected later, by the domain)", () => {
      const bundle = valuesOf(parseBundle({ version: 1, files: [] }));
      expect(bundle.files).toEqual([]);
    });

    it("accepts all three actions", () => {
      const bundle = valuesOf(
        parseBundle({
          version: 1,
          files: [
            { path: "skills/S1.md", action: "create" },
            { path: "skills/S2.md", action: "replace" },
            { path: "skills/S3.md", action: "delete" },
          ],
        }),
      );
      expect(bundle.files.map((f) => f.action)).toEqual([
        BundleActionValues.Create,
        BundleActionValues.Replace,
        BundleActionValues.Delete,
      ]);
    });
  });

  describe("拒绝的情形", () => {
    it("rejects a non-object", () => {
      const issues = issuesOf(parseBundle("not a bundle"));
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleInvalid,
      ]);
    });

    it("rejects a missing version", () => {
      expect(issuesOf(parseBundle({ files: [] }))).not.toEqual([]);
    });

    it("rejects an unsupported version", () => {
      const issues = issuesOf(parseBundle({ version: 2, files: [] }));
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleInvalid,
      ]);
    });

    it("rejects a missing files array", () => {
      expect(issuesOf(parseBundle({ version: 1 }))).not.toEqual([]);
    });

    it("rejects an unknown action", () => {
      const issues = issuesOf(
        parseBundle({
          version: 1,
          files: [{ path: "skills/S1.md", action: "upsert" }],
        }),
      );
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleInvalid,
      ]);
    });

    it("rejects a non-string content", () => {
      const issues = issuesOf(
        parseBundle({
          version: 1,
          files: [{ path: "skills/S1.md", action: "create", content: 42 }],
        }),
      );
      expect(issues.map((i) => i.code)).toEqual([
        IssueCodeValues.BundleInvalid,
      ]);
    });
  });
});
