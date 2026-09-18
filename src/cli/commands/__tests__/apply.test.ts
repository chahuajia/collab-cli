import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import {
  minimalEntryContent,
  toFail,
  toSucceed,
  useTestWorkspace,
  writeIndex,
  writeSkill,
} from "@/cli/commands/__tests__/testHelpers";
import { EntryKindValues } from "@/domain/entry/types";

const ctx = useTestWorkspace();

/**
 * 测试自己算哈希 —— **不复用生产的 `sha256Hex`**。
 *
 * @remarks
 * 否则"生产实现算错了"会与"测试期望算错了"同错（W8 的"同错"陷阱）。
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

type SpecAction = "create" | "replace" | "delete";

interface BundleFileSpec {
  readonly path: string;
  readonly action: SpecAction;
  readonly content?: string;
  readonly sha256?: string | null;
  readonly base_sha256?: string | null;
}

function create(relPath: string, content: string): BundleFileSpec {
  return { path: relPath, action: "create", content, sha256: sha256(content) };
}

function replace(
  relPath: string,
  content: string,
  baseSha256: string,
): BundleFileSpec {
  return {
    path: relPath,
    action: "replace",
    content,
    sha256: sha256(content),
    base_sha256: baseSha256,
  };
}

function remove(relPath: string): BundleFileSpec {
  return { path: relPath, action: "delete" };
}

/** 把 bundle 写到工作区根目录，返回相对路径。 */
async function writeBundle(
  files: readonly BundleFileSpec[],
  name = "bundle.json",
): Promise<string> {
  await writeFile(
    path.join(ctx().root, name),
    JSON.stringify(
      {
        version: 1,
        generated_at: "2026-09-16T10:00:00Z",
        generated_by: "AI",
        base_commit: null,
        files,
      },
      null,
      2,
    ),
    "utf8",
  );
  return name;
}

/** 一条合法 skill 的内容（可附加额外 body）。 */
function skillContent(id: string, extra = ""): string {
  return (
    minimalEntryContent({ id, kind: EntryKindValues.Skill }) + extra
  );
}

function abs(relPath: string): string {
  return path.join(ctx().collabDir, relPath);
}

async function read(relPath: string): Promise<string> {
  return readFile(abs(relPath), "utf8");
}

async function git(args: readonly string[]): Promise<string> {
  const result = await execa("git", [...args], {
    cwd: ctx().root,
    env: { ...process.env, ...ctx().envOverrides },
  });
  return result.stdout;
}

describe("collab apply", () => {
  // ─────────────────────────────────────────────
  // E1：正常落盘
  // ─────────────────────────────────────────────
  describe("落盘（E1）", () => {
    it("writes every file of a valid bundle", async () => {
      const files = [
        create("skills/S31.md", skillContent("S31")),
        create("skills/S32.md", skillContent("S32")),
        create("skills/S33.md", skillContent("S33")),
      ];
      await writeBundle(files);

      const result = await toSucceed(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      for (const file of files) {
        expect(existsSync(abs(file.path))).toBe(true);
        expect(await read(file.path)).toBe(file.content);
      }
      expect(result.stdout).toContain("applied 3 file(s)");
    });

    it("reports the plan before validating", async () => {
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);
      const result = await toSucceed(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(result.stdout).toContain("+ skills/S31.md");
      expect(result.stdout).toContain("validate passed");
    });
  });

  // ─────────────────────────────────────────────
  // E2 / E3 / E13：预检拒绝 —— 一个文件都不写
  // ─────────────────────────────────────────────
  describe("全有或全无（E2 / E3 / E13）", () => {
    async function expectNothingWritten(result: { stdout: string }) {
      expect(existsSync(abs("skills/S31.md"))).toBe(false);
      expect(existsSync(abs("skills/S32.md"))).toBe(false);
      expect(existsSync(abs("skills/S33.md"))).toBe(false);
      expect(result.stdout).toContain("no files were written");
    }

    it("writes nothing when one content is empty (E2)", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31")),
        create("skills/S32.md", ""),
        create("skills/S33.md", skillContent("S33")),
      ]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      await expectNothingWritten(result);
      expect(result.stdout).toContain("skills/S32.md");
      expect(result.stdout).toContain("BUNDLE_EMPTY_CONTENT");
    });

    it("writes nothing when one content is whitespace only (E3)", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31")),
        create("skills/S32.md", "   \n\t\n  "),
      ]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(existsSync(abs("skills/S31.md"))).toBe(false);
      expect(result.stdout).toContain("BUNDLE_EMPTY_CONTENT");
    });

    it("writes nothing when sha256 disagrees with content (E13)", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31")),
        {
          path: "skills/S32.md",
          action: "create",
          content: skillContent("S32"),
          sha256: sha256("tampered"),
        },
      ]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(existsSync(abs("skills/S31.md"))).toBe(false);
      expect(result.stdout).toContain("BUNDLE_HASH_MISMATCH");
    });
  });

  // ─────────────────────────────────────────────
  // E4 / E5 / E6：路径
  // ─────────────────────────────────────────────
  describe("路径（E4 / E5 / E6）", () => {
    it("rejects a parent traversal (E4)", async () => {
      await writeBundle([create("../evil.md", "body")]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(result.stdout).toContain("BUNDLE_PATH_INVALID");
      expect(existsSync(path.join(path.dirname(ctx().root), "evil.md"))).toBe(
        false,
      );
    });

    it("rejects an embedded traversal (E5)", async () => {
      await writeBundle([create("agreements/../../evil.md", "body")]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(result.stdout).toContain("BUNDLE_PATH_INVALID");
      expect(existsSync(path.join(path.dirname(ctx().root), "evil.md"))).toBe(
        false,
      );
    });

    it("strips a COLLABORATION/ prefix (E6)", async () => {
      await writeBundle([
        create("COLLABORATION/skills/S36-x.md", skillContent("S36")),
      ]);

      const result = await toSucceed(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(existsSync(abs("skills/S36-x.md"))).toBe(true);
      expect(result.stdout).toContain("+ skills/S36-x.md");
    });

    it("rejects a path outside the allowlist", async () => {
      await writeBundle([create("scripts/evil.md", "body")]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(result.stdout).toContain("BUNDLE_PATH_INVALID");
      expect(existsSync(path.join(ctx().collabDir, "scripts/evil.md"))).toBe(
        false,
      );
    });
  });

  // ─────────────────────────────────────────────
  // E7 / E8 / E9 / E10：冲突
  // ─────────────────────────────────────────────
  describe("冲突（E7 / E8 / E9 / E10）", () => {
    it("refuses to overwrite on create (E7)", async () => {
      await writeSkill("skills/S30.md", "S30", ctx().collabDir);
      const original = await read("skills/S30.md");
      await writeBundle([create("skills/S30.md", skillContent("S30"))]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(await read("skills/S30.md")).toBe(original);
      expect(result.stdout).toContain("BUNDLE_CONFLICT");
      expect(result.stdout).toContain("already exists");
    });

    it("refuses a replace whose base_sha256 is stale (E8)", async () => {
      await writeSkill("skills/S30.md", "S30", ctx().collabDir);
      const original = await read("skills/S30.md");
      await writeBundle([
        replace("skills/S30.md", skillContent("S30", "updated\n"), sha256("stale")),
      ]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(await read("skills/S30.md")).toBe(original);
      expect(result.stdout).toContain("modified externally");
    });

    it("replaces when base_sha256 matches (E9)", async () => {
      await writeSkill("skills/S30.md", "S30", ctx().collabDir);
      const updated = skillContent("S30", "updated\n");
      await writeBundle([
        replace("skills/S30.md", updated, sha256(await read("skills/S30.md"))),
      ]);

      await toSucceed(["apply", "bundle.json"], ctx().root, ctx().envOverrides);

      expect(await read("skills/S30.md")).toBe(updated);
    });

    it("deletes the file (E10)", async () => {
      await writeSkill("skills/S30.md", "S30", ctx().collabDir);
      await writeBundle([remove("skills/S30.md")]);

      await toSucceed(["apply", "bundle.json"], ctx().root, ctx().envOverrides);

      expect(existsSync(abs("skills/S30.md"))).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // E11：--dry-run
  // ─────────────────────────────────────────────
  describe("--dry-run（E11）", () => {
    it("prints the plan and writes nothing", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31")),
        create("skills/S32.md", skillContent("S32")),
      ]);

      const result = await toSucceed(
        ["apply", "bundle.json", "--dry-run"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(result.stdout).toContain("plan: 2 file(s)");
      expect(result.stdout).toContain("+ skills/S31.md");
      expect(result.stdout).toContain("no files were written");
      expect(existsSync(abs("skills/S31.md"))).toBe(false);
      expect(existsSync(abs("skills/S32.md"))).toBe(false);
    });

    it("still rejects a broken bundle without writing", async () => {
      await writeBundle([create("skills/S31.md", "")]);

      const result = await toFail(
        ["apply", "bundle.json", "--dry-run"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(result.stdout).toContain("BUNDLE_EMPTY_CONTENT");
      expect(existsSync(abs("skills/S31.md"))).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // E12：落盘后 validate 失败 —— 不回滚
  // ─────────────────────────────────────────────
  describe("validate 门禁（E12）", () => {
    it("keeps the files when validate fails", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31", "\n[[S999]]\n")),
      ]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(existsSync(abs("skills/S31.md"))).toBe(true);
      expect(result.stdout).toContain("validate failed");
      expect(result.stdout).toContain("DEAD_LINK");
    });

    it("does not run validate on --dry-run", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31", "\n[[S999]]\n")),
      ]);

      await toSucceed(
        ["apply", "bundle.json", "--dry-run"],
        ctx().root,
        ctx().envOverrides,
      );
    });
  });

  // ─────────────────────────────────────────────
  // --index / --commit
  // ─────────────────────────────────────────────
  describe("--index", () => {
    it("refreshes the affected _index.md", async () => {
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);

      await toSucceed(
        ["apply", "bundle.json", "--index"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(await read("skills/_index.md")).toContain("[[S31]]");
    });
  });

  describe("派生链（base-contract）", () => {
    it("refreshes catalog but not _index.md without --index", async () => {
      await writeIndex(ctx().collabDir, "skills", []);
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);

      await toSucceed(["apply", "bundle.json"], ctx().root, ctx().envOverrides);

      const catalog = JSON.parse(await read("catalog.json"));
      expect(catalog.entries.some((e: { id: string }) => e.id === "S31")).toBe(
        true,
      );
      expect(await read("skills/_index.md")).not.toContain("[[S31]]");
    });

    it("passes apply content gate then fails full validate (MISSING_FROM_INDEX)", async () => {
      await writeIndex(ctx().collabDir, "skills", []);
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);

      await toSucceed(["apply", "bundle.json"], ctx().root, ctx().envOverrides);

      const result = await toFail(
        ["validate"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(result.stdout).toContain("MISSING_FROM_INDEX");
    });

    it("blocks --commit when index is stale (needs --index first)", async () => {
      await writeIndex(ctx().collabDir, "skills", []);
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);

      const result = await toFail(
        ["apply", "bundle.json", "--commit"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(existsSync(abs("skills/S31.md"))).toBe(true);
      expect(result.stdout).toContain("validate passed (1 entries, 0 issues)");
      expect(result.stdout).toContain("validate failed");
      expect(result.stdout).toContain("Aborting commit");
      await expect(git(["log", "-1"])).rejects.toThrow();

      const detail = await toFail(
        ["validate"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(detail.stdout).toContain("MISSING_FROM_INDEX");
    });
  });

  describe("派生产物", () => {
    it("refreshes catalog.json after writing (so the next validate passes)", async () => {
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);

      await toSucceed(["apply", "bundle.json"], ctx().root, ctx().envOverrides);

      // 落盘后 catalog 必须是新的 —— 否则 validate 会报 CATALOG_STALE
      const catalog = JSON.parse(await read("catalog.json"));
      expect(catalog.summary.total).toBe(1);
      expect(catalog.entries[0].id).toBe("S31");
    });

    it("keeps validate green after apply --index", async () => {
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);
      // `--index` 负责刷新 `_index.md`；catalog 由 apply 自己刷新
      await toSucceed(
        ["apply", "bundle.json", "--index"],
        ctx().root,
        ctx().envOverrides,
      );

      await toSucceed(["validate"], ctx().root, ctx().envOverrides);
    });

    it("does not touch catalog.json on --dry-run", async () => {
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);

      await toSucceed(
        ["apply", "bundle.json", "--dry-run"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(existsSync(abs("catalog.json"))).toBe(false);
    });
  });

  describe("--commit", () => {
    it("commits after validate passes", async () => {
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);

      await toSucceed(
        ["apply", "bundle.json", "--index", "--commit"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(await git(["log", "-1", "--pretty=%s"])).toContain(
        "apply bundle.json",
      );
    });

    it("does not commit by default", async () => {
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);

      await toSucceed(["apply", "bundle.json"], ctx().root, ctx().envOverrides);

      await expect(git(["log", "-1"])).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // --json
  // ─────────────────────────────────────────────
  describe("--json", () => {
    it("reports a rejection as JSON", async () => {
      await writeBundle([create("skills/S31.md", "")]);

      const result = await toFail(
        ["apply", "bundle.json", "--json"],
        ctx().root,
        ctx().envOverrides,
      );

      const payload = JSON.parse(result.stdout);
      expect(payload.status).toBe("rejected");
      expect(payload.issues).toHaveLength(1);
      expect(payload.issues[0].code).toBe("BUNDLE_EMPTY_CONTENT");
      expect(payload.summary).toEqual({ create: 0, replace: 0, delete: 0 });
    });

    it("reports an applied plan as JSON", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31")),
        create("skills/S32.md", skillContent("S32")),
      ]);

      const result = await toSucceed(
        ["apply", "bundle.json", "--json"],
        ctx().root,
        ctx().envOverrides,
      );

      const payload = JSON.parse(result.stdout);
      expect(payload.status).toBe("applied");
      expect(payload.summary).toEqual({ create: 2, replace: 0, delete: 0 });
      expect(payload.operations).toEqual([
        { action: "create", path: "skills/S31.md" },
        { action: "create", path: "skills/S32.md" },
      ]);
    });

    it("reports a dry-run as JSON without writing", async () => {
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);

      const result = await toSucceed(
        ["apply", "bundle.json", "--dry-run", "--json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(JSON.parse(result.stdout).status).toBe("dry-run");
      expect(existsSync(abs("skills/S31.md"))).toBe(false);
    });
  });

  describe("apply --json validate-failed（round-16）", () => {
    function jsonObjects(stdout: string): unknown[] {
      const objects: unknown[] = [];
      let depth = 0;
      let start = -1;
      for (let i = 0; i < stdout.length; i++) {
        const ch = stdout[i];
        if (ch === "{") {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0 && start >= 0) {
            objects.push(JSON.parse(stdout.slice(start, i + 1)));
            start = -1;
          }
        }
      }
      return objects;
    }

    function validateFailedPayload(stdout: string): Record<string, unknown> {
      const payloads = jsonObjects(stdout)
        .filter((value): value is Record<string, unknown> => {
          return typeof value === "object" && value !== null;
        })
        .map((value) => Object.fromEntries(Object.entries(value)));
      const failed = payloads.find((p) => p.status === "validate-failed");
      if (failed === undefined) {
        throw new Error("expected validate-failed JSON payload");
      }
      return failed;
    }

    it("C1: emits validate-failed JSON after writing", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31", "\n[[S999]]\n")),
      ]);

      const result = await toFail(
        ["apply", "bundle.json", "--json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(validateFailedPayload(result.stdout).status).toBe("validate-failed");
      expect(jsonObjects(result.stdout)).toHaveLength(1);
      expect(() => JSON.parse(result.stdout.trim())).not.toThrow();
    });

    it("C2: JSON issues include DEAD_LINK", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31", "\n[[S999]]\n")),
      ]);

      const result = await toFail(
        ["apply", "bundle.json", "--json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(JSON.stringify(validateFailedPayload(result.stdout).issues)).toContain(
        "DEAD_LINK",
      );
    });

    it("C3: keeps files on disk (same as E12)", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31", "\n[[S999]]\n")),
      ]);

      await toFail(["apply", "bundle.json", "--json"], ctx().root, ctx().envOverrides);
      expect(existsSync(abs("skills/S31.md"))).toBe(true);
    });

    it("C4: follow-up validate --json still reports errors", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31", "\n[[S999]]\n")),
      ]);

      await toFail(["apply", "bundle.json", "--json"], ctx().root, ctx().envOverrides);

      const validate = await toFail(
        ["validate", "--json"],
        ctx().root,
        ctx().envOverrides,
      );
      const parsed: unknown = JSON.parse(validate.stdout);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("expected validate JSON");
      }
      const summary = Object.fromEntries(Object.entries(parsed)).summary;
      expect(summary).toMatchObject({ errors: expect.any(Number) });
      expect(JSON.stringify(parsed)).toContain("DEAD_LINK");
    });
  });

  describe("apply --json single payload（round-17）", () => {
    function jsonObjects(stdout: string): unknown[] {
      const objects: unknown[] = [];
      let depth = 0;
      let start = -1;
      for (let i = 0; i < stdout.length; i++) {
        const ch = stdout[i];
        if (ch === "{") {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0 && start >= 0) {
            objects.push(JSON.parse(stdout.slice(start, i + 1)));
            start = -1;
          }
        }
      }
      return objects;
    }

    it("C3: human mode still prints applied before validate errors", async () => {
      await writeBundle([
        create("skills/S31.md", skillContent("S31", "\n[[S999]]\n")),
      ]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(result.stdout).toContain("applied 1 file");
      expect(result.stdout).toContain("validate failed");
    });

    it("C4: success path emits single applied JSON", async () => {
      await writeBundle([create("skills/S31.md", skillContent("S31"))]);

      const result = await toSucceed(
        ["apply", "bundle.json", "--json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(jsonObjects(result.stdout)).toHaveLength(1);
      expect(JSON.parse(result.stdout.trim()).status).toBe("applied");
    });
  });

  // ─────────────────────────────────────────────
  // 边界：参数与文件
  // ─────────────────────────────────────────────
  describe("边界", () => {
    it("errors when the bundle argument is missing", async () => {
      const result = await toFail(["apply"], ctx().root, ctx().envOverrides);
      expect(result.stderr).toContain("bundle.json");
    });

    it("errors when the bundle file does not exist", async () => {
      const result = await toFail(
        ["apply", "nope.json"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(result.stdout).toContain("not found");
    });

    it("errors when the bundle is not valid JSON", async () => {
      await writeFile(path.join(ctx().root, "bad.json"), "{ nope", "utf8");

      const result = await toFail(
        ["apply", "bad.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(result.stdout).toContain("not valid JSON");
    });

    it("errors when the version is unsupported", async () => {
      await writeFile(
        path.join(ctx().root, "v2.json"),
        JSON.stringify({ version: 2, files: [] }),
        "utf8",
      );

      const result = await toFail(
        ["apply", "v2.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(result.stdout).toContain("BUNDLE_INVALID");
    });

    it("errors when files is empty", async () => {
      await writeBundle([]);

      const result = await toFail(
        ["apply", "bundle.json"],
        ctx().root,
        ctx().envOverrides,
      );

      expect(result.stdout).toContain("no files");
    });
  });
});
