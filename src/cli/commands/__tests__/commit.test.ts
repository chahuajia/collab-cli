import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CLI_ENTRY, writeEntry } from "./testHelpers.js";

let testRoot: string;
let collabDir: string;
let envOverrides: Record<string, string>;

async function runCli(args: string[], cwd: string) {
  return execa("node", [CLI_ENTRY, ...args], {
    cwd,
    reject: false,
    env: { ...process.env, ...envOverrides },
  });
}

async function git(args: string[], cwd: string) {
  return execa("git", args, {
    cwd,
    reject: false,
    env: { ...process.env, ...envOverrides },
  });
}

/** 写入一个最小 index。 */
async function writeIndex(relDir: string, ids: string[]): Promise<void> {
  const header = "| ID | 名称 | 领域 | 状态 |\n| :-- | :-- | :-- | :-- |\n";
  const rows = ids.map((id) => `| [[${id}]] | x | | |`).join("\n");
  await writeFile(
    path.join(collabDir, relDir, "_index.md"),
    header + rows + "\n",
    "utf8",
  );
}

async function setupWorkspace(): Promise<void> {
  testRoot = await mkdtemp(path.join(tmpdir(), "collab-commit-"));
  collabDir = path.join(testRoot, "COLLABORATION");

  const emptyGitConfig = path.join(testRoot, ".empty-gitconfig");
  await writeFile(emptyGitConfig, "");
  envOverrides = {
    GIT_CONFIG_GLOBAL: emptyGitConfig,
    GIT_CONFIG_SYSTEM: emptyGitConfig,
  };

  await git(["init", "-q"], testRoot);
  await git(["config", "--local", "user.email", "test@example.com"], testRoot);
  await git(["config", "--local", "user.name", "Test"], testRoot);

  for (const sub of [
    "skills",
    "agreements",
    "patterns",
    "workflows",
    "meta/decision-records",
  ]) {
    await mkdir(path.join(collabDir, sub), { recursive: true });
  }
}

/** 创建一个 baseline commit——让后续变更都能被"检测到"。 */
async function createBaseline(): Promise<void> {
  await writeFile(path.join(testRoot, "README.md"), "baseline\n", "utf8");
  await git(["add", "."], testRoot);
  await git(["commit", "-q", "-m", "baseline"], testRoot);
}

/** 读取 git log 的 commit 主题列表。 */
async function getCommitSubjects(): Promise<string[]> {
  const result = await git(["log", "--pretty=format:%s"], testRoot);
  if (result.exitCode !== 0) return [];
  return result.stdout.split("\n").filter((s) => s.length > 0);
}

afterEach(async () => {
  if (testRoot) await rm(testRoot, { recursive: true, force: true });
});

describe("collab commit", () => {
  // ─────────────────────────────────────────────
  // E1: 成功提交
  // ─────────────────────────────────────────────
  describe("E1: 成功提交", () => {
    beforeEach(async () => {
      await setupWorkspace();
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeIndex("skills", ["S1"]);
    });

    it("commits COLLABORATION changes when validation passes", async () => {
      const result = await runCli(["commit", "-m", "feat: add S1"], testRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("committed");

      const subjects = await getCommitSubjects();
      expect(subjects).toContain("feat: add S1");
    });

    it("suggests push as next step", async () => {
      const result = await runCli(["commit", "-m", "feat: add S1"], testRoot);
      expect(result.stdout).toContain("push");
    });
  });

  // ─────────────────────────────────────────────
  // E2: validate 失败
  // ─────────────────────────────────────────────
  describe("E2: validate 失败", () => {
    beforeEach(async () => {
      await setupWorkspace();
      // 故意制造问题：有条目但无 index
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });

    });

    it("aborts when validation fails", async () => {
      const result = await runCli(
        ["commit", "-m", "should not commit"],
        testRoot,
      );
      expect(result.exitCode).not.toBe(0);
    });

    it("does not create a commit when validation fails", async () => {
      await runCli(["commit", "-m", "should not commit"], testRoot);
      const subjects = await getCommitSubjects();
      expect(subjects).not.toContain("should not commit");
    });
  });

  // ─────────────────────────────────────────────
  // E3: 无变更
  // ─────────────────────────────────────────────
  describe("E3: 无变更", () => {
    beforeEach(async () => {
      await setupWorkspace();
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeIndex("skills", ["S1"]);
      // 先做一次 baseline commit 让 COLLABORATION 已被跟踪
      await git(["add", "COLLABORATION"], testRoot);
      await git(["commit", "-q", "-m", "baseline"], testRoot);
    });

    it("errors when nothing to commit", async () => {
      const result = await runCli(["commit", "-m", "nothing"], testRoot);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toLowerCase() + result.stdout.toLowerCase()).toMatch(
        /nothing to commit|no changes/,
      );
    });
  });

  // ─────────────────────────────────────────────
  // E4: 缺 -m
  // ─────────────────────────────────────────────
  describe("E4: 缺 -m", () => {
    beforeEach(async () => {
      await setupWorkspace();
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeIndex("skills", ["S1"]);
    });

    it("errors when -m is missing", async () => {
      const result = await runCli(["commit"], testRoot);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/message/i);
    });

    it("errors when -m is empty string", async () => {
      const result = await runCli(["commit", "-m", ""], testRoot);
      expect(result.exitCode).not.toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // E5: --no-validate
  // ─────────────────────────────────────────────
  describe("E5: --no-validate", () => {
    beforeEach(async () => {
      await setupWorkspace();
      // 故意制造 validate 会失败的状态
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
    });

    it("skips validation and commits", async () => {
      const result = await runCli(
        ["commit", "-m", "bypass", "--no-validate"],
        testRoot,
      );
      expect(result.exitCode).toBe(0);

      const subjects = await getCommitSubjects();
      expect(subjects).toContain("bypass");
    });

    it("shows warning when skipping validation", async () => {
      const result = await runCli(
        ["commit", "-m", "bypass", "--no-validate"],
        testRoot,
      );
      expect(result.stdout.toLowerCase()).toMatch(/skip|warning|⚠/);
    });
  });

  // ─────────────────────────────────────────────
  // E6: --no-validate + 无变更
  // ─────────────────────────────────────────────
  describe("E6: --no-validate + 无变更", () => {
    beforeEach(async () => {
      await setupWorkspace();
       await writeEntry({
         relPath: "skills/S1.md",
         id: "S1",
         kind: "skill",
         collabDir,
       });
      await writeIndex("skills", ["S1"]);
      await git(["add", "COLLABORATION"], testRoot);
      await git(["commit", "-q", "-m", "baseline"], testRoot);
    });

    it("still errors on nothing to commit", async () => {
      const result = await runCli(
        ["commit", "-m", "nothing", "--no-validate"],
        testRoot,
      );
      expect(result.exitCode).not.toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // E8: 非 git 仓库
  // ─────────────────────────────────────────────
  describe("E8: 非 git 仓库", () => {
    it("errors when not in a git repo", async () => {
      testRoot = await mkdtemp(path.join(tmpdir(), "collab-nogit-"));
      collabDir = path.join(testRoot, "COLLABORATION");
      await mkdir(collabDir, { recursive: true });
      await writeFile(path.join(testRoot, ".empty-gitconfig"), "");
      envOverrides = {
        GIT_CONFIG_GLOBAL: path.join(testRoot, ".empty-gitconfig"),
        GIT_CONFIG_SYSTEM: path.join(testRoot, ".empty-gitconfig"),
      };

      const result = await runCli(["commit", "-m", "x"], testRoot);
      expect(result.exitCode).not.toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // E11: git log 可查
  // ─────────────────────────────────────────────
  describe("E11: git log 可查", () => {
    beforeEach(async () => {
      await setupWorkspace();
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeIndex("skills", ["S1"]);
    });

    it("commit subject matches -m argument", async () => {
      const message = "feat(collab): add S1 skill entry";
      await runCli(["commit", "-m", message], testRoot);
      const subjects = await getCommitSubjects();
      expect(subjects[0]).toBe(message);
    });
  });

  // ─────────────────────────────────────────────
  // E12: 只提交 COLLABORATION
  // ─────────────────────────────────────────────
  describe("E12: 只提交 COLLABORATION", () => {
    beforeEach(async () => {
      await setupWorkspace();
      await createBaseline();
      // 在 COLLABORATION 里加新条目
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeIndex("skills", ["S1"]);
      // 在仓库根加一个"非 COLLABORATION"的变更
      await writeFile(path.join(testRoot, "README.md"), "changed\n", "utf8");
    });

    it("does not include changes outside COLLABORATION", async () => {
      const result = await runCli(["commit", "-m", "feat: S1"], testRoot);
      expect(result.exitCode).toBe(0);

      // 检查 README.md 是否仍在未暂存/未提交状态
      const status = await git(
        ["status", "--porcelain", "README.md"],
        testRoot,
      );
      expect(status.stdout.trim().length).toBeGreaterThan(0);
    });
  });
});
