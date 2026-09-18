import { describe, expect, it } from "vitest";
import { parseCollabText } from "@/domain/parse/parseCollabText";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import type { ParsedFile } from "@/domain/parse/parseCollabText";
import type { Issue } from "@/domain/validation/Issue";
import type { Result } from "@/shared/Result";

const OK = (path: string, body: string): string =>
  `===== FILE: ${path} =====\n${body}\n===== END FILE =====`;

function files(r: Result<readonly ParsedFile[], readonly Issue[]>): readonly ParsedFile[] {
  if (!r.ok) throw new Error(r.error.map((i) => i.format()).join(" | "));
  return r.value;
}

function issues(r: Result<readonly ParsedFile[], readonly Issue[]>): readonly Issue[] {
  if (r.ok) throw new Error("expected Err");
  return r.error;
}

describe("parseCollabText", () => {
  it("splits blocks and keeps content byte-for-byte", () => {
    const parsed = files(parseCollabText(OK("skills/S1-a.md", "# S1\n---\nbody")));
    expect(parsed).toEqual([
      { path: "skills/S1-a.md", content: "# S1\n---\nbody" },
    ]);
  });

  it("parses several blocks in order", () => {
    const text = [OK("a/1.md", "one"), OK("b/2.md", "two")].join("\n");
    expect(files(parseCollabText(text)).map((f) => f.path)).toEqual([
      "a/1.md",
      "b/2.md",
    ]);
  });

  it("tolerates any number of = in the markers (D5)", () => {
    // A17 文档里两处结束标记的 = 数量就不一致
    const text = "== FILE: x.md ==\nbody\n== END FILE ==";
    expect(files(parseCollabText(text))[0]?.content).toBe("body");
  });

  it("keeps the raw path (normalization is apply's job)", () => {
    const text = OK("COLLABORATION/skills/S1-a.md", "body");
    expect(files(parseCollabText(text))[0]?.path).toBe("COLLABORATION/skills/S1-a.md");
  });

  describe("拒绝", () => {
    it("rejects content outside any block (wrong paste range)", () => {
      const text = `开场白\n${OK("a.md", "body")}`;
      const found = issues(parseCollabText(text));
      expect(found.map((i) => i.code)).toEqual([IssueCodeValues.ParseInvalid]);
      expect(found[0]?.message).toContain("content outside any block");
    });

    it("rejects an unclosed block", () => {
      const found = issues(parseCollabText("===== FILE: a.md =====\nbody\n"));
      expect(found[0]?.message).toContain("never closed");
    });

    it("rejects an empty block (truncated paste)", () => {
      const found = issues(parseCollabText(OK("a.md", "   ")));
      expect(found.map((i) => i.code)).toEqual([IssueCodeValues.ParseEmptyBlock]);
      expect(found[0]?.path).toBe("a.md");
    });

    it("rejects a duplicate path", () => {
      const text = [OK("a.md", "one"), OK("a.md", "two")].join("\n");
      const found = issues(parseCollabText(text));
      expect(found.map((i) => i.code)).toEqual([IssueCodeValues.ParseDuplicatePath]);
    });

    it("rejects an empty path", () => {
      expect(
        issues(parseCollabText("===== FILE:  =====\nbody\n===== END FILE =====")).length,
      ).toBeGreaterThan(0);
    });

    it("rejects plain prose (reported as content outside a block)", () => {
      const found = issues(parseCollabText("就是一段普通文字"));
      expect(found[0]?.message).toContain("content outside any block");
    });

    it("rejects whitespace-only input as having no blocks", () => {
      const found = issues(parseCollabText("   \n\n "));
      expect(found[0]?.message).toContain("no FILE blocks");
    });
  });
});
