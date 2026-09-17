import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CLI_ENTRY,
  toFail,
  toSucceed,
  useTestWorkspace,
  writeIndex,
} from "@/cli/commands/__tests__/testHelpers";

const ctx = useTestWorkspace();

function abs(rel: string): string {
  return path.join(ctx().collabDir, rel);
}

async function createBaselineCommit(): Promise<void> {
  await writeFile(path.join(ctx().root, "README.md"), "baseline\n", "utf8");
  await execa("git", ["add", "."], {
    cwd: ctx().root,
    env: { ...process.env, ...ctx().envOverrides },
  });
  await execa("git", ["commit", "-q", "-m", "baseline"], {
    cwd: ctx().root,
    env: { ...process.env, ...ctx().envOverrides },
  });
}

async function seedStaleCatalog(): Promise<string> {
  await toSucceed(["catalog"], ctx().root, ctx().envOverrides);
  const catalogPath = abs("catalog.json");
  const before = await readFile(catalogPath, "utf8");
  await writeIndex(ctx().collabDir, "skills", []);
  await toSucceed(["new", "skill", "S30"], ctx().root, ctx().envOverrides);
  await toSucceed(["index", "skills"], ctx().root, ctx().envOverrides);
  return before;
}

describe("collab catalog", () => {
  it("writes catalog.json for an empty workspace", async () => {
    await toSucceed(["catalog"], ctx().root, ctx().envOverrides);

    expect(existsSync(abs("catalog.json"))).toBe(true);
    const catalog = JSON.parse(await readFile(abs("catalog.json"), "utf8"));
    expect(catalog.summary.total).toBe(0);
  });

  describe("catalog freshness chain (round-9)", () => {
    it("C1: new + index after baseline catalog → CATALOG_STALE", async () => {
      await seedStaleCatalog();

      const result = await toFail(["validate"], ctx().root, ctx().envOverrides);
      expect(result.stdout).toContain("CATALOG_STALE");
    });

    it("C2: collab catalog clears CATALOG_STALE", async () => {
      await seedStaleCatalog();
      await toFail(["validate"], ctx().root, ctx().envOverrides);

      await toSucceed(["catalog"], ctx().root, ctx().envOverrides);

      const after = await toSucceed(
        ["validate"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(after.stdout).toContain("1 entries");
      expect(after.stdout).toContain("0 issues");
    });

    it("C3: --stdout previews without fixing validate", async () => {
      const before = await seedStaleCatalog();
      await toFail(["validate"], ctx().root, ctx().envOverrides);

      const preview = await toSucceed(
        ["catalog", "--stdout"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(JSON.parse(preview.stdout).summary.total).toBe(1);
      expect(await readFile(abs("catalog.json"), "utf8")).toBe(before);

      await toFail(["validate"], ctx().root, ctx().envOverrides);
    });

    it("C4: commit blocked while catalog is stale", async () => {
      await createBaselineCommit();
      await seedStaleCatalog();

      const result = await toFail(
        ["commit", "-m", "should not land"],
        ctx().root,
        ctx().envOverrides,
      );
      expect(result.stdout).toContain("validate failed");
      expect(result.stdout).toContain("Aborting commit");
    });
  });

  describe("publish chain with catalog (round-11)", () => {
    let gitRoot: string;
    let collabDir: string;
    let remoteDir: string;
    let envOverrides: Record<string, string>;

    beforeEach(async () => {
      gitRoot = await mkdtemp(path.join(tmpdir(), "collab-catalog-r11-"));
      collabDir = path.join(gitRoot, "COLLABORATION");
      remoteDir = path.join(gitRoot, "remote.git");

      const emptyGitConfig = path.join(gitRoot, ".empty-gitconfig");
      await writeFile(emptyGitConfig, "");
      envOverrides = {
        GIT_CONFIG_GLOBAL: emptyGitConfig,
        GIT_CONFIG_SYSTEM: emptyGitConfig,
      };

      await mkdir(remoteDir);
      await execa("git", ["init", "--bare", "-q", "-b", "main"], {
        cwd: remoteDir,
        env: { ...process.env, ...envOverrides },
      });
      await execa("git", ["init", "-q", "-b", "main"], {
        cwd: gitRoot,
        env: { ...process.env, ...envOverrides },
      });
      await execa(
        "git",
        ["config", "--local", "user.email", "test@example.com"],
        { cwd: gitRoot, env: { ...process.env, ...envOverrides } },
      );
      await execa("git", ["config", "--local", "user.name", "Test"], {
        cwd: gitRoot,
        env: { ...process.env, ...envOverrides },
      });
      await execa("git", ["remote", "add", "origin", remoteDir], {
        cwd: gitRoot,
        env: { ...process.env, ...envOverrides },
      });

      for (const sub of ["skills", "agreements", "patterns", "workflows", "meta/decision-records"]) {
        await mkdir(path.join(collabDir, sub), { recursive: true });
      }

      await writeFile(path.join(gitRoot, "README.md"), "baseline\n", "utf8");
      await execa("git", ["add", "."], {
        cwd: gitRoot,
        env: { ...process.env, ...envOverrides },
      });
      await execa("git", ["commit", "-q", "-m", "initial"], {
        cwd: gitRoot,
        env: { ...process.env, ...envOverrides },
      });
      await execa("git", ["push", "-u", "origin", "main"], {
        cwd: gitRoot,
        env: { ...process.env, ...envOverrides },
      });
      await execa("node", [CLI_ENTRY, "catalog"], {
        cwd: gitRoot,
        env: { ...process.env, ...envOverrides },
      });
    });

    afterEach(async () => {
      await rm(gitRoot, { recursive: true, force: true });
    });

    async function cli(args: string[]) {
      return execa("node", [CLI_ENTRY, ...args], {
        cwd: gitRoot,
        reject: false,
        env: { ...process.env, ...envOverrides },
      });
    }

    it("C1: new + index + commit blocked without catalog refresh", async () => {
      await writeIndex(collabDir, "skills", []);
      expect((await cli(["new", "skill", "S30"])).exitCode).toBe(0);
      expect((await cli(["index", "skills"])).exitCode).toBe(0);

      const commit = await cli(["commit", "-m", "feat: add S30"]);
      expect(commit.exitCode).not.toBe(0);
      expect(commit.stdout).toContain("validate failed");
    });

    it("C2: catalog refresh clears validate", async () => {
      await writeIndex(collabDir, "skills", []);
      await cli(["new", "skill", "S30"]);
      await cli(["index", "skills"]);
      await cli(["catalog"]);

      const validate = await cli(["validate"]);
      expect(validate.exitCode).toBe(0);
      expect(validate.stdout).toContain("0 issues");
    });

    it("C3: commit succeeds after catalog", async () => {
      await writeIndex(collabDir, "skills", []);
      await cli(["new", "skill", "S30"]);
      await cli(["index", "skills"]);
      await cli(["catalog"]);

      const commit = await cli(["commit", "-m", "feat: add S30"]);
      expect(commit.exitCode).toBe(0);
      expect(commit.stdout).toContain("committed");
    });

    it("C4: push --dry-run after full chain", async () => {
      await writeIndex(collabDir, "skills", []);
      await cli(["new", "skill", "S30"]);
      await cli(["index", "skills"]);
      await cli(["catalog"]);
      await cli(["commit", "-m", "feat: add S30"]);

      const push = await cli(["push", "--dry-run"]);
      expect(push.exitCode).toBe(0);
      expect(push.stdout).toContain("feat: add S30");
    });
  });
});
