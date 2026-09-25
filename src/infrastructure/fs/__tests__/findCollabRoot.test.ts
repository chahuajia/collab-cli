import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { findCollabRoot } from "../findCollabRoot.js";

let testRoot: string;
let savedCollabDir: string | undefined;

beforeEach(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), "collab-find-"));
  savedCollabDir = process.env.COLLAB_DIR;
  delete process.env.COLLAB_DIR;
});

afterEach(async () => {
  if (testRoot) {
    await rm(testRoot, { recursive: true, force: true });
  }
  if (savedCollabDir !== undefined) {
    process.env.COLLAB_DIR = savedCollabDir;
  } else {
    delete process.env.COLLAB_DIR;
  }
});

/** 创建 git 仓库骨架（空 .git 目录即可）。 */
async function makeGitRepo(dir: string): Promise<void> {
  await mkdir(path.join(dir, ".git"), { recursive: true });
}

describe("findCollabRoot", () => {
  // ─────────────────────────────────────────────
  // 环境变量（`COLLAB_DIR`）
  // ─────────────────────────────────────────────
  describe("COLLAB_DIR 环境变量", () => {
    it("resolves layout A (repo with COLLABORATION/ subdir)", async () => {
      const repo = path.join(testRoot, "repoA");
      await makeGitRepo(repo);
      await mkdir(path.join(repo, "COLLABORATION", "agreements"), {
        recursive: true,
      });
      process.env.COLLAB_DIR = repo;

      const result = findCollabRoot(testRoot);
      expect(result.collabDir).toBe(path.join(repo, "COLLABORATION"));
      expect(result.gitRoot).toBe(repo);
    });

    it("resolves layout B (repo root is workspace)", async () => {
      const repo = path.join(testRoot, "repoB");
      await makeGitRepo(repo);
      await mkdir(path.join(repo, "agreements"), { recursive: true });
      process.env.COLLAB_DIR = repo;

      const result = findCollabRoot(testRoot);
      expect(result.collabDir).toBe(repo);
      expect(result.gitRoot).toBe(repo);
    });

    it("throws when COLLAB_DIR does not exist", () => {
      process.env.COLLAB_DIR = path.join(testRoot, "does-not-exist");
      expect(() => findCollabRoot(testRoot)).toThrow(/does not exist/i);
    });

    it("throws when COLLAB_DIR is a file (not directory)", async () => {
      const filePath = path.join(testRoot, "afile");
      await mkdir(testRoot, { recursive: true });
      const { writeFile } = await import("node:fs/promises");
      await writeFile(filePath, "x");
      process.env.COLLAB_DIR = filePath;

      expect(() => findCollabRoot(testRoot)).toThrow(/not a directory/i);
    });
  });

  // ─────────────────────────────────────────────
  // 向上找 .git
  // ─────────────────────────────────────────────
  describe("向上找 .git", () => {
    it("finds layout A from nested cwd", async () => {
      const repo = path.join(testRoot, "repo");
      await makeGitRepo(repo);
      await mkdir(path.join(repo, "COLLABORATION", "agreements"), {
        recursive: true,
      });
      const deep = path.join(repo, "COLLABORATION", "agreements");
      await mkdir(deep, { recursive: true });

      const result = findCollabRoot(deep);
      expect(result.collabDir).toBe(path.join(repo, "COLLABORATION"));
      expect(result.gitRoot).toBe(repo);
    });

    it("finds layout B from nested cwd", async () => {
      const repo = path.join(testRoot, "repo");
      await makeGitRepo(repo);
      const deep = path.join(repo, "agreements", "sub");
      await mkdir(deep, { recursive: true });

      const result = findCollabRoot(deep);
      expect(result.collabDir).toBe(repo);
      expect(result.gitRoot).toBe(repo);
    });

    it("throws when no .git found up the tree", async () => {
      const lonely = path.join(testRoot, "lonely");
      await mkdir(lonely, { recursive: true });

      expect(() => findCollabRoot(lonely)).toThrow(
        /not inside a git repository/i,
      );
    });

    it("throws when .git exists but neither layout matches", async () => {
      const repo = path.join(testRoot, "repo");
      await makeGitRepo(repo);

      expect(() => findCollabRoot(repo)).toThrow(/no COLLABORATION workspace/i);
    });

    it("layout A wins over layout B when both exist", async () => {
      const repo = path.join(testRoot, "repo");
      await makeGitRepo(repo);
      await mkdir(path.join(repo, "COLLABORATION", "agreements"), {
        recursive: true,
      });
      await mkdir(path.join(repo, "agreements"), { recursive: true });

      const result = findCollabRoot(repo);
      expect(result.collabDir).toBe(path.join(repo, "COLLABORATION"));
    });

    it("meta/ alone does not trigger layout B", async () => {
      const repo = path.join(testRoot, "repo");
      await makeGitRepo(repo);
      await mkdir(path.join(repo, "meta"), { recursive: true });

      expect(() => findCollabRoot(repo)).toThrow(/no COLLABORATION workspace/i);
    });
  });
});
