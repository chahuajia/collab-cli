import { describe, expect, it } from "vitest";
import { normalizeBundlePath } from "@/domain/apply/BundlePath";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

function valueOf(result: Result<string, Issue>): string {
  if (!result.ok) throw new Error(`expected Ok, got: ${result.error.format()}`);
  return result.value;
}

function codeOf(result: Result<string, Issue>): string {
  if (result.ok) throw new Error(`expected Err, got: ${result.value}`);
  return result.error.code;
}

describe("normalizeBundlePath", () => {
  describe("接受的路径", () => {
    it.each([
      ["skills/S36-xxx.md"],
      ["agreements/A20-x.md"],
      ["workflows/W11-x.md"],
      ["patterns/some-pattern.md"],
      ["meta/decision-records/ADR-0005.md"],
      ["meta/evolution-log.md"],
      ["domains/frontend/x.md"],
      ["inbox/scratch.md"],
    ])("accepts %s", (path) => {
      expect(valueOf(normalizeBundlePath(path))).toBe(path);
    });

    it("strips a COLLABORATION/ prefix (E6)", () => {
      expect(valueOf(normalizeBundlePath("COLLABORATION/skills/S36-x.md"))).toBe(
        "skills/S36-x.md",
      );
    });

    it("strips a leading ./", () => {
      expect(valueOf(normalizeBundlePath("./skills/S36-x.md"))).toBe(
        "skills/S36-x.md",
      );
    });

    it("strips repeated prefixes", () => {
      expect(
        valueOf(normalizeBundlePath("./COLLABORATION/skills/S36-x.md")),
      ).toBe("skills/S36-x.md");
    });

    it("normalizes Windows separators", () => {
      expect(valueOf(normalizeBundlePath("skills\\S36-x.md"))).toBe(
        "skills/S36-x.md",
      );
    });
  });

  describe("拒绝的路径", () => {
    it("rejects a parent traversal (E4)", () => {
      const result = normalizeBundlePath("../evil.md");
      expect(codeOf(result)).toBe(IssueCodeValues.BundlePathInvalid);
    });

    it("rejects an embedded traversal (E5)", () => {
      expect(codeOf(normalizeBundlePath("agreements/../../evil.md"))).toBe(
        IssueCodeValues.BundlePathInvalid,
      );
    });

    it("rejects a traversal behind a COLLABORATION/ prefix", () => {
      expect(codeOf(normalizeBundlePath("COLLABORATION/../evil.md"))).toBe(
        IssueCodeValues.BundlePathInvalid,
      );
    });

    it("rejects a Windows-style traversal", () => {
      expect(codeOf(normalizeBundlePath("..\\evil.md"))).toBe(
        IssueCodeValues.BundlePathInvalid,
      );
    });

    it.each([["/etc/passwd"], ["/COLLABORATION/skills/x.md"], ["C:/tmp/x.md"], ["C:\\tmp\\x.md"]])(
      "rejects the absolute path %s",
      (path) => {
        expect(codeOf(normalizeBundlePath(path))).toBe(
          IssueCodeValues.BundlePathInvalid,
        );
      },
    );

    it.each([["scripts/x.md"], ["src/x.md"], ["docs/x.md"], ["COLLABORATION"]])(
      "rejects the out-of-allowlist path %s",
      (path) => {
        expect(codeOf(normalizeBundlePath(path))).toBe(
          IssueCodeValues.BundlePathInvalid,
        );
      },
    );

    it("rejects an empty path", () => {
      expect(codeOf(normalizeBundlePath(""))).toBe(
        IssueCodeValues.BundlePathInvalid,
      );
    });

    it("rejects a directory-only path", () => {
      expect(codeOf(normalizeBundlePath("skills"))).toBe(
        IssueCodeValues.BundlePathInvalid,
      );
    });

    it("rejects an empty segment", () => {
      expect(codeOf(normalizeBundlePath("skills//S1.md"))).toBe(
        IssueCodeValues.BundlePathInvalid,
      );
    });

    it("rejects a dot segment", () => {
      expect(codeOf(normalizeBundlePath("skills/./S1.md"))).toBe(
        IssueCodeValues.BundlePathInvalid,
      );
    });
  });

  describe("Issue 内容", () => {
    it("names the allowed directories when the path is out of allowlist", () => {
      const result = normalizeBundlePath("scripts/x.md");
      if (result.ok) throw new Error("expected Err");
      expect(result.error.suggestion).toContain("skills");
      expect(result.error.suggestion).toContain("inbox");
    });

    it("keeps the raw path for diagnosis", () => {
      const result = normalizeBundlePath("../evil.md");
      if (result.ok) throw new Error("expected Err");
      expect(result.error.path).toBe("../evil.md");
    });
  });
});
