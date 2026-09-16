// src / cli / commands / __tests__ / index.test.ts;
import { existsSync } from 'node:fs';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  toFail,
  toSucceed,
  writeEntry,
} from "@/cli/commands/__tests__/testHelpers";


let testRoot: string;
let collabDir: string;
let envOverrides: Record<string, string>;
async function setupWorkspace(): Promise<void> {
  testRoot = await mkdtemp(path.join(tmpdir(), 'collab-index-'));
  collabDir = path.join(testRoot, 'COLLABORATION');

  const emptyGitConfig = path.join(testRoot, '.empty-gitconfig');
  await writeFile(emptyGitConfig, '');
  envOverrides = {
    GIT_CONFIG_GLOBAL: emptyGitConfig,
    GIT_CONFIG_SYSTEM: emptyGitConfig,
  };

  await execa('git', ['init', '-q'], { cwd: testRoot, env: { ...process.env, ...envOverrides } });
  await execa('git', ['config', '--local', 'user.email', 'test@example.com'], {
    cwd: testRoot,
    env: { ...process.env, ...envOverrides },
  });
  await execa('git', ['config', '--local', 'user.name', 'Test'], {
    cwd: testRoot,
    env: { ...process.env, ...envOverrides },
  });

  for (const sub of ['skills', 'agreements', 'patterns', 'workflows', 'meta/decision-records']) {
    await mkdir(path.join(collabDir, sub), { recursive: true });
  }
}

afterEach(async () => {
  if (testRoot) await rm(testRoot, { recursive: true, force: true });
});

describe('collab index', () => {
// ─────────────────────────────────────────────
// 生成（E3）
// ─────────────────────────────────────────────
  describe('生成新 index', () => {
    beforeEach(() => setupWorkspace());

    it('creates _index.md with standard header (E3)', async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });

      await writeEntry({
        relPath: "skills/S2.md",
        id: "S2",
        kind: "skill",
        collabDir,
      });
      await writeEntry({
        relPath: "skills/S3.md",
        id: "S3",
        kind: "skill",
        collabDir,
      });

      const result = await toSucceed(["index"], testRoot, envOverrides);

      console.log("STDOUT:", result.stdout);
      console.log("STDERR:", result.stderr);
      expect(result.exitCode).toBe(0);

      const indexFile = path.join(collabDir, 'skills/_index.md');
      expect(existsSync(indexFile)).toBe(true);

      const content = await readFile(indexFile, 'utf8');
      expect(content).toContain('# 技能索引');
      expect(content).toContain('[[S1]]');
      expect(content).toContain('[[S2]]');
      expect(content).toContain('[[S3]]');
    });

    it('creates pattern index with long refs', async () => {

      await writeEntry({
        relPath: "patterns/rooted-graph.md",
        id: "rooted-graph",
        kind: "pattern",
        collabDir,
      });

      await toSucceed(["index"], testRoot, envOverrides);

      const content = await readFile(path.join(collabDir, 'patterns/_index.md'), 'utf8');
      expect(content).toContain('[[patterns/rooted-graph]]');
    });
  });

// ─────────────────────────────────────────────
// 增量同步（E4, E5）
// ─────────────────────────────────────────────
  describe('增量同步', () => {
    beforeEach(() => setupWorkspace());

    it('adds new entries to existing index (E4)', async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeEntry({
        relPath: "skills/S2.md",
        id: "S2",
        kind: "skill",
        collabDir,
      });

      await writeFile(
        path.join(collabDir, 'skills/_index.md'),
        '| ID | 名称 | 领域 | 状态 |\n| :-- | :-- | :-- | :-- |\n| [[S1]] | H2 输出 | meta | active |\n',
        'utf8',
      );

      const result = await toSucceed(
        ["index", "skills"],
        testRoot,
        envOverrides,
      );
      expect(result.exitCode).toBe(0);

      const content = await readFile(path.join(collabDir, 'skills/_index.md'), 'utf8');
      expect(content).toContain('[[S1]]');
      expect(content).toContain('[[S2]]');
      expect(content).toContain('H2 输出'); // 保留人工列
    });

    it('removes dangling entries (E5)', async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });

      await writeFile(
        path.join(collabDir, 'skills/_index.md'),
        '| ID | 名称 | 领域 | 状态 |\n| :-- | :-- | :-- | :-- |\n| [[S1]] | H2 输出 | meta | active |\n| [[S99]] | 悬空 | | |\n',
        'utf8',
      );

      await toSucceed(["index", "skills"], testRoot, envOverrides);

      const content = await readFile(path.join(collabDir, 'skills/_index.md'), 'utf8');
      expect(content).toContain('[[S1]]');
      expect(content).not.toContain('[[S99]]');
    });

    it('preserves extra content after table (E6)', async () => {
      await writeEntry({
        relPath: "agreements/A1.md",
        id: "A1",
        kind: "agreement",
        collabDir,
      });


      await writeFile(
        path.join(collabDir, 'agreements/_index.md'),
        '# 约定索引\n\n| ID | 名称 | 状态 |\n| :-- | :-- | :-- |\n| [[A1]] | x | active |\n\n## 变更规则\n\n承重墙。\n',
        'utf8',
      );

      await toSucceed(["index", "agreements"], testRoot, envOverrides);

      const content = await readFile(path.join(collabDir, 'agreements/_index.md'), 'utf8');
      expect(content).toContain('## 变更规则');
      expect(content).toContain('承重墙');
    });
  });

// ─────────────────────────────────────────────
// 排序（D3=A）
// ─────────────────────────────────────────────
  describe('排序', () => {
    beforeEach(() => setupWorkspace());

    it('sorts numerically not lexically', async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeEntry({
        relPath: "skills/S2.md",
        id: "S2",
        kind: "skill",
        collabDir,
      });
      await writeEntry({
        relPath: "skills/S10.md",
        id: "S10",
        kind: "skill",
        collabDir,
      });

      await toSucceed(["index", "skills"], testRoot, envOverrides);

      const content = await readFile(path.join(collabDir, 'skills/_index.md'), 'utf8');
      const lines = content.split('\n').filter((l) => l.includes('[[S'));
      expect(lines[0]).toContain('[[S1]]');
      expect(lines[1]).toContain('[[S2]]');
      expect(lines[2]).toContain('[[S10]]');
    });
  });

// ─────────────────────────────────────────────
// 参数（D1, D2）
// ─────────────────────────────────────────────
  describe('参数', () => {
    beforeEach(() => setupWorkspace());

    it('only processes specified dir (E11)', async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeEntry({
        relPath: "agreements/A1.md",
        id: "A1",
        kind: "agreement",
        collabDir,
      });

      await toSucceed(["index", "skills"], testRoot, envOverrides);

      expect(existsSync(path.join(collabDir, 'skills/_index.md'))).toBe(true);
      expect(existsSync(path.join(collabDir, 'agreements/_index.md'))).toBe(false);
    });

    it('errors for nonexistent dir (E12)', async () => {
      await toFail(
        ["index", "nonexistent"],
        testRoot,
        envOverrides,
      );
    });
  });

// ─────────────────────────────────────────────
// 无变更（D6=A）
// ─────────────────────────────────────────────
  describe('无变更', () => {
    beforeEach(() => setupWorkspace());

    it("does not write when nothing changed (E13)", async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeFile(
        path.join(collabDir, "skills/_index.md"),
        "| ID | 名称 | 领域 | 状态 |\n| :-- | :-- | :-- | :-- |\n| [[S1]] | x | | |\n",
        "utf8",
      );

      const before = await readFile(
        path.join(collabDir, "skills/_index.md"),
        "utf8",
      );

      await toSucceed(["index", "skills"], testRoot, envOverrides);

      const after = await readFile(
        path.join(collabDir, "skills/_index.md"),
        "utf8",
      );

      expect(after).toBe(before); // 无变更 → 文件未修改
    });
  });

// ─────────────────────────────────────────────
// 与 validate 对齐
// ─────────────────────────────────────────────
  describe('与 validate 对齐', () => {
    beforeEach(() => setupWorkspace());

    it('output passes checkIndexForward and checkIndexDangling', async () => {
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeEntry({
        relPath: "skills/S2.md",
        id: "S2",
        kind: "skill",
        collabDir,
      });

      await toSucceed(["index", "skills"], testRoot, envOverrides);

// 直接跑 validate 的领域逻辑
      const { FileWorkspaceLoader } = await import(
        '../../../infrastructure/fs/FileWorkspaceLoader.js'
        );
      const { ValidateUseCase } = await import('../../../application/ValidateUseCase.js');
      const { checkIndexForward } = await import(
        '../../../domain/validation/rules/checkIndexForward.js'
        );
      const { checkIndexDangling } = await import(
        '../../../domain/validation/rules/checkIndexDangling.js'
        );

      const loader = new FileWorkspaceLoader(collabDir);
      const useCase = new ValidateUseCase(loader, {
        perEntry: [checkIndexForward],
        global: [checkIndexDangling],
      });
      const { report } = useCase.execute();

      expect(report.errors()).toEqual([]);
    });
  });

  describe("collab index — 文件名与 id 不一致（回归）", () => {
    beforeEach(() => setupWorkspace());

    // ─────────────────────────────────────────────
    // T1: 用 frontmatter.id，不是文件名
    // ─────────────────────────────────────────────
    it("uses the id when the file name has a slug", async () => {
      // 文件名带 name 后缀，id 是 S1
      await writeEntry({
        relPath: "skills/S1-h2-output.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });

      await toSucceed(["index", "skills"], testRoot, envOverrides);

      const content = await readFile(
        path.join(collabDir, "skills/_index.md"),
        "utf8",
      );
      // 用 id —— 它是不可变快照，改名不失效（ADR-0009）
      expect(content).toContain("[[S1]]");
      expect(content).not.toContain("[[S1-h2-output]]");
    });

    // ─────────────────────────────────────────────
    // T2: 保留已有 name 列
    // ─────────────────────────────────────────────
    it("preserves existing name column when id matches", async () => {
      // 文件名带 name 后缀
      await writeEntry({
        relPath: "skills/S1-h2-output.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });

      // 已有 index，有 name
      await writeFile(
        path.join(collabDir, "skills/_index.md"),
        "| ID | 名称 | 领域 | 状态 |\n| :-- | :-- | :-- | :-- |\n| [[S1-h2-output]] | H2 输出 | meta | active |\n",
        "utf8",
      );

      await toSucceed(["index", "skills"], testRoot, envOverrides);

      const content = await readFile(
        path.join(collabDir, "skills/_index.md"),
        "utf8",
      );
      // name 应保留
      expect(content).toContain("H2 输出");
      // 其他列也应保留
      expect(content).toContain("meta");
      expect(content).toContain("active");
    });

    // ─────────────────────────────────────────────
    // T3: ADR 长文件名
    // ─────────────────────────────────────────────
    it("uses the id for an ADR with a long file name", async () => {
      // ADR 文件名：id + 描述
      await writeEntry({
        relPath: "meta/decision-records/ADR-0001-adopt-v3-structure.md",
        id: "ADR-0001",
        kind: "adr",
        collabDir,
      });

      await writeEntry({
        relPath: "meta/decision-records/ADR-0001-adopt-v3-structure.md",
        id: "ADR-0001",
        kind: "adr",
        collabDir,
      });

      await toSucceed(
        ["index", "meta/decision-records"],
        testRoot,
        envOverrides,
      );

      const content = await readFile(
        path.join(collabDir, "meta/decision-records/_index.md"),
        "utf8",
      );
      expect(content).toContain("[[ADR-0001]]");
      expect(content).not.toContain("[[ADR-0001-adopt-v3-structure]]");
    });

    // ─────────────────────────────────────────────
    // T4: 无变更（关键回归）
    // ─────────────────────────────────────────────
    it('reports "no changes" when the file name is already in the index', async () => {
      // 文件名带 name 后缀
      await writeEntry({
        relPath: "skills/S1-h2-output.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });

      // index 里已经用 id
      await writeFile(
        path.join(collabDir, "skills/_index.md"),
        "| ID | 名称 | 领域 | 状态 |\n| :-- | :-- | :-- | :-- |\n| [[S1-h2-output]] | H2 输出 | meta | active |\n",
        "utf8",
      );

      const before = await readFile(
        path.join(collabDir, "skills/_index.md"),
        "utf8",
      );

      const result = await toSucceed(
        ["index", "skills"],
        testRoot,
        envOverrides,
      );

      const after = await readFile(
        path.join(collabDir, "skills/_index.md"),
        "utf8",
      );

      // 输出应为 "no changes"
      expect(result.stdout).toContain("no changes");
      // 文件字节级不变
      expect(after).toBe(before);
    });

    // ─────────────────────────────────────────────
    // T5（2026-09-16 真库实测事故的回归）
    // ─────────────────────────────────────────────
    it("does NOT wipe the index when rows use the file-name form", async () => {
      // 真库的写法：index 里是文件名式引用，且带人工维护的列。
      await writeEntry({
        relPath: "skills/S1-h2-output.md",
        id: "S1",
        kind: "skill",
        collabDir,
      });
      await writeFile(
        path.join(collabDir, "skills/_index.md"),
        "# 技能索引\n\n| ID | 名称 | 领域 | 状态 |\n| :-- | :-- | :-- | :-- |\n| [[S1-h2-output]] | H2 输出 | meta | active |\n",
        "utf8",
      );

      const before = await readFile(
        path.join(collabDir, "skills/_index.md"),
        "utf8",
      );

      const result = await toSucceed(
        ["index", "skills"],
        testRoot,
        envOverrides,
      );

      const after = await readFile(
        path.join(collabDir, "skills/_index.md"),
        "utf8",
      );

      // 旧实现会 "removed 1, added 1"，把人工列全丢掉
      expect(result.stdout).toContain("no changes");
      expect(after).toBe(before);
    });
  });
});
