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

  // ── --check-enforced：毕业条目的固化证据是否还在 ──────────
  //
  // 对照 OKF / Kage 的「来源漂移则**撤回**（withheld），而非静默返回过期内容」。
  // 我们的毕业条目此前**恰恰是静默的**：条目因"内容活在某个测试里"退出路由索引，
  // 而那个测试被删后 —— 条目既不在索引里、其固化也没了，**知识静默丢失**。

  describe("--check-enforced", () => {
    beforeEach(() => setupWorkspace());

    const GRAD = "grad-test";

    /** 写一条已毕业的条目，enforced 指向 <repo>:<relPath>。 */
    async function writeGraduated(enforcedValue: string): Promise<void> {
      const lines = [
        "---",
        `id: ${GRAD}`,
        "type: pattern",
        "status: active",
        "created: 2026-09-01",
        "updated: 2026-09-01",
        "author: test@example.com",
        `aliases: [${GRAD}]`,
        `enforced: ${enforcedValue}`,
        "---",
        "",
        "# Graduated",
        "",
        "## 上下文",
        "",
        "x",
        "",
        "## 问题",
        "",
        "y",
        "",
        "## 方案",
        "",
        "z",
        "",
        "## 反面",
        "",
        "w",
        "",
        "## 关联",
        "",
      ];
      await mkdir(path.join(collabDir, "patterns"), { recursive: true });
      await writeFile(
        path.join(collabDir, "patterns", `${GRAD}.md`),
        lines.join("\n"),
        "utf8",
      );
      await writeIndex("patterns", [GRAD]);
    }

    /**
     * 造一个临时"业务仓"，并把 `EVOLUTIONARY_DIR` 指过去。
     *
     * 注意：env 覆盖**只对已知仓名生效**（COLLAB_CLI_DIR / COLLAB_KB_DIR /
     * EVOLUTIONARY_DIR）—— 所以测试必须用 `evolutionary:` 而不是自造仓名。
     */
    async function fakeRepo(name: string, withFile: string | null): Promise<void> {
      const dir = path.join(testRoot, name);
      await mkdir(dir, { recursive: true });
      if (withFile !== null) {
        const abs = path.join(dir, withFile);
        await mkdir(path.dirname(abs), { recursive: true });
        await writeFile(abs, "// exists\n", "utf8");
      }
      envOverrides = { ...envOverrides, EVOLUTIONARY_DIR: dir };
    }

    it("F1: 目标不存在 → 报 ENFORCED_TARGET_MISSING", async () => {
      await fakeRepo("repo-missing", null);
      await writeGraduated("evolutionary:src/Gone.java");

      const result = await runCli(["validate", "--check-enforced"], testRoot);
      expect(result.exitCode).toBe(1);
      expect(result.stdout + result.stderr).toContain("ENFORCED_TARGET_MISSING");
    });

    it("F2: 目标存在 → 通过", async () => {
      await fakeRepo("repo-ok", "src/Real.java");
      await writeGraduated("evolutionary:src/Real.java");

      const result = await runCli(["validate", "--check-enforced"], testRoot);
      expect(result.exitCode).toBe(0);
    });

    it("F3: 默认 validate 不做跨仓检查（密闭性保住）", async () => {
      await fakeRepo("repo-default", null);
      await writeGraduated("evolutionary:src/Gone.java");

      const result = await runCli(["validate"], testRoot);
      expect(result.exitCode).toBe(0);
    });

    it("F4: 仓名不认识 → 不报（无法判定 ≠ 不存在）", async () => {
      // 把 EVOLUTIONARY_DIR 指到不存在的路径 → 不可达 → 无法判定
      envOverrides = {
        ...envOverrides,
        EVOLUTIONARY_DIR: path.join(testRoot, "no-such-repo-at-all"),
      };
      await writeGraduated("evolutionary:src/X.java");

      const result = await runCli(["validate", "--check-enforced"], testRoot);
      // 把"无法判定"当"不存在"会让拿不到仓的机器全红 → 检查被关掉 → 真漂移也没人看
      expect(result.exitCode).toBe(0);
    });
  });
});
