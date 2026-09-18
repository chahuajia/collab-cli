import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CLI_ENTRY, writeEntry } from "./testHelpers.js";   // ← 复用已修好的路径

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
  testRoot = await mkdtemp(path.join(tmpdir(), "collab-validate-"));
  collabDir = path.join(testRoot, "COLLABORATION");

  const emptyGitConfig = path.join(testRoot, ".empty-gitconfig");
  await writeFile(emptyGitConfig, "");
  envOverrides = {
    GIT_CONFIG_GLOBAL: emptyGitConfig,
    GIT_CONFIG_SYSTEM: emptyGitConfig,
  };

  await execa("git", ["init", "-q"], {
    cwd: testRoot,
    env: { ...process.env, ...envOverrides },
  });
  await execa("git", ["config", "--local", "user.email", "test@example.com"], {
    cwd: testRoot,
    env: { ...process.env, ...envOverrides },
  });
  await execa("git", ["config", "--local", "user.name", "Test"], {
    cwd: testRoot,
    env: { ...process.env, ...envOverrides },
  });

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

afterEach(async () => {
  if (testRoot) await rm(testRoot, { recursive: true, force: true });
});

describe("collab validate", () => {
  // ─────────────────────────────────────────────
  // E1: 空 COLLABORATION
  // ─────────────────────────────────────────────
  describe("空 workspace (E1)", () => {
    beforeEach(() => setupWorkspace());

    it("succeeds with 0 entries and 0 issues", async () => {
      const result = await runCli(["validate"], testRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("0 entries");
      expect(result.stdout).toContain("0 issues");
    });
  });

  // ─────────────────────────────────────────────
  // E2: 无 Issue
  // ─────────────────────────────────────────────
  describe("无 Issue (E2)", () => {
    beforeEach(() => setupWorkspace());

    it("succeeds when all entries are valid", async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });

      await writeIndex("skills", ["S1"]);

      const result = await runCli(["validate"], testRoot);
      // 👇 临时加这两行
      console.log("STDOUT:", result.stdout);
      console.log("STDERR:", result.stderr);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("1 entries");
      expect(result.stdout).toContain("0 issues");
    })
  });

  // ─────────────────────────────────────────────
  // E3: 有 error → exit 1
  // ─────────────────────────────────────────────
  describe("有 error (E3)", () => {
    beforeEach(() => setupWorkspace());

    it("exits with code 1 when there are errors", async () => {
      // 写一个有错误的条目：没有 index → MissingFromIndex
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });

      // 不写 index，checkIndexExists 会报错

      const result = await runCli(["validate"], testRoot);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("✖");
    });

    it("shows issue details in output", async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });

      const result = await runCli(["validate"], testRoot);
      expect(result.stdout).toContain("MISSING_INDEX");
    });
  });

  // ─────────────────────────────────────────────
  // E4: 只有 warning → exit 0
  // ─────────────────────────────────────────────
  describe("只有 warning (E4)", () => {
    beforeEach(() => setupWorkspace());

    it("exits with code 0 when only warnings", async () => {
      await writeEntry({
        relPath: "skills/S1-h2-output.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeFile(
        path.join(collabDir, "skills/_index.md"),
        "| ID | 名称 | 领域 | 状态 |\n| :-- | :-- | :-- | :-- |\n| [[S1-h2-output]] | H2 | meta | active |\n",
        "utf8",
      );

      const result = await runCli(["validate"], testRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("INDEX_REF_PREFER_ID");
    });
  });

  // ─────────────────────────────────────────────
  // E9: --json
  // ─────────────────────────────────────────────
  describe("--json (E9)", () => {
    beforeEach(() => setupWorkspace());

    it("outputs valid JSON", async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeIndex("skills", ["S1"]);

      const result = await runCli(["validate", "--json"], testRoot);
      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.entries).toBe(1);
      expect(parsed.issues).toEqual([]);
      expect(parsed.summary.errors).toBe(0);
    });

    it("outputs issues array when there are errors", async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      // 不写 index

      const result = await runCli(["validate", "--json"], testRoot);
      expect(result.exitCode).toBe(1);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.issues.length).toBeGreaterThan(0);
      expect(parsed.summary.errors).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────
  // E11 / E12: 环境错误
  // ─────────────────────────────────────────────
  describe("环境错误 (E11 / E12)", () => {
    it("errors when not in git repo (E11)", async () => {
      testRoot = await mkdtemp(path.join(tmpdir(), "collab-no-git-"));
      collabDir = path.join(testRoot, "COLLABORATION");
      await mkdir(collabDir, { recursive: true });
      await writeFile(path.join(testRoot, ".empty-gitconfig"), "");

      const result = await runCli(["validate"], testRoot);
      expect(result.exitCode).not.toBe(0);
    });

    it("errors when COLLABORATION dir does not exist (E12)", async () => {
      testRoot = await mkdtemp(path.join(tmpdir(), "collab-no-collab-"));
      await writeFile(path.join(testRoot, ".empty-gitconfig"), "");
      await execa("git", ["init", "-q"], { cwd: testRoot });
      await execa(
        "git",
        ["config", "--local", "user.email", "test@example.com"],
        {
          cwd: testRoot,
        },
      );
      await execa("git", ["config", "--local", "user.name", "Test"], {
        cwd: testRoot,
      });

      const result = await runCli(["validate"], testRoot);
      expect(result.exitCode).not.toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // E14: 非 TTY 无颜色
  // ─────────────────────────────────────────────
  describe("颜色 (E14)", () => {
    beforeEach(() => setupWorkspace());

    it("does not emit ANSI when stdout is not a TTY", async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeIndex("skills", ["S1"]);

      const result = await runCli(["validate"], testRoot);
      expect(result.stdout).not.toContain("\x1b[");
    });
  });
});
