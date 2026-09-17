import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  cleanupWorkspace,
  CLI_ENTRY,
  createWorkspace,
  type WorkspaceContext,
  writeEntry,
  writeIndex,
} from "./testHelpers.js";

let testRoot: string;
let remoteDir: string;
let localDir: string;
let collabDir: string;
let envOverrides: Record<string, string>;

/**
 * 创建一个本地裸仓库作为"远程"。
 *
 * @remarks
 * push 测试的特定 Arrange —— 保留在 push.test.ts 内。
 * 其他测试不需要 remote，所以不抽到 testHelpers。
 */
async function createRemote(root: string): Promise<string> {
  const remoteDir = path.join(root, 'remote.git');
  await mkdir(remoteDir);
  await execa('git', ['init', '--bare', '-q', '-b', 'main'], {
    cwd: remoteDir,
    env: { ...process.env, ...envOverrides },
  });
  return remoteDir;
}

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
interface SetupOptions {
  skipRemote?: boolean;
  skipInitialPush?: boolean;
}

async function setupWorkspace(opts: SetupOptions = {}): Promise<void> {
  testRoot = await mkdtemp(path.join(tmpdir(), "collab-push-"));
  remoteDir = path.join(testRoot, "remote.git");
  localDir = path.join(testRoot, "local");
  collabDir = path.join(localDir, "COLLABORATION");

  const emptyGitConfig = path.join(testRoot, ".empty-gitconfig");
  await writeFile(emptyGitConfig, "");
  envOverrides = {
    GIT_CONFIG_GLOBAL: emptyGitConfig,
    GIT_CONFIG_SYSTEM: emptyGitConfig,
  };

  // 1. 创建远程裸仓库
  if (!opts.skipRemote) {
    await mkdir(remoteDir);
    await git(["init", "--bare", "-q", "-b", "main"], remoteDir);
  }

  // 2. 创建本地仓库
  await mkdir(localDir);
  await git(["init", "-q", "-b", "main"], localDir);
  await git(["config", "--local", "user.email", "test@example.com"], localDir);
  await git(["config", "--local", "user.name", "Test"], localDir);

  // 3. 关联远程
  if (!opts.skipRemote) {
    await git(["remote", "add", "origin", remoteDir], localDir);
  }

  // 4. 创建 COLLABORATION 骨架
  for (const sub of [
    "skills",
    "agreements",
    "patterns",
    "workflows",
    "meta/decision-records",
  ]) {
    await mkdir(path.join(collabDir, sub), { recursive: true });
  }

  // 5. 初始提交 + 首次 push（建立 upstream）
  if (!opts.skipRemote && !opts.skipInitialPush) {
    await writeFile(path.join(localDir, "README.md"), "baseline\n", "utf8");
    await git(["add", "."], localDir);
    await git(["commit", "-q", "-m", "initial"], localDir);
    await git(["push", "-u", "origin", "main"], localDir);
  }
}

/** 在 local 里添加一个 commit（不 push）。 */
async function addCommit(message: string, fileName = "x.txt"): Promise<void> {
  await writeFile(path.join(localDir, fileName), message + "\n", "utf8");
  await git(["add", "."], localDir);
  await git(["commit", "-q", "-m", message], localDir);
}

/** 从 remote clone 出第二个仓库，模拟"别人"。 */
async function cloneSecond(): Promise<string> {
  const cloneDir = path.join(testRoot, "clone2");
  await git(["clone", "-q", remoteDir, cloneDir], testRoot);
  await git(["config", "--local", "user.email", "other@example.com"], cloneDir);
  await git(["config", "--local", "user.name", "Other"], cloneDir);
  return cloneDir;
}

afterEach(async () => {
  if (testRoot) await rm(testRoot, { recursive: true, force: true });
});

describe("collab push", () => {
  let ctx: WorkspaceContext;

  beforeEach(async () => {
    ctx = await createWorkspace();
    // 额外：创建 remote
    await createRemote(ctx.root);
  });

  afterEach(async () => {
    await cleanupWorkspace(ctx.root);
  });
  // ─────────────────────────────────────────────
  // E1: 正常推送
  // ─────────────────────────────────────────────
  describe("E1: 正常推送", () => {
    beforeEach(() => setupWorkspace());

    it("pushes commits to remote", async () => {
      await addCommit("feat: add a");

      const result = await runCli(["push"], localDir);
      expect(result.exitCode).toBe(0);

      // 验证远程已收到
      const log = await git(["log", "--oneline", "main"], remoteDir);
      expect(log.stdout).toContain("feat: add a");
    });
  });

  // ─────────────────────────────────────────────
  // E2: 无新 commit
  // ─────────────────────────────────────────────
  describe("E2: 无新 commit", () => {
    beforeEach(() => setupWorkspace());

    it("reports up-to-date when nothing to push", async () => {
      const result = await runCli(["push"], localDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/up-to-date|nothing to push/);
    });
  });

  // ─────────────────────────────────────────────
  // E3: 远程有新 commit
  // ─────────────────────────────────────────────
  describe("E3: 远程有新 commit", () => {
    beforeEach(() => setupWorkspace());

    it("rejects when remote has diverged", async () => {
      // local 先加一个 commit（不 push）
      await addCommit("local-change", "local.txt");

      // 别人推了一个 commit
      const clone2 = await cloneSecond();
      await writeFile(path.join(clone2, "other.txt"), "other\n", "utf8");
      await git(["add", "."], clone2);
      await git(["commit", "-q", "-m", "other-change"], clone2);
      await git(["push"], clone2);

      // local push → rejected
      const result = await runCli(["push"], localDir);
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(
        /rejected|non-fast-forward|fetch first|diverged/i,
      );
    });
  });

  // ─────────────────────────────────────────────
  // E4: 无远程配置
  // ─────────────────────────────────────────────
  describe("E4: 无远程", () => {
    it("errors when no remote is configured", async () => {
      await setupWorkspace({ skipRemote: true });

      const result = await runCli(["push"], localDir);
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(/remote|origin/i);
    });
  });

  // ─────────────────────────────────────────────
  // E5: --dry-run
  // ─────────────────────────────────────────────
  describe("E5: --dry-run", () => {
    beforeEach(() => setupWorkspace());

    it("shows commits without pushing", async () => {
      await addCommit("dry-run-test");

      const before = await git(["rev-parse", "origin/main"], localDir);
      const result = await runCli(["push", "--dry-run"], localDir);
      const after = await git(["rev-parse", "origin/main"], localDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("dry-run-test");
      expect(after.stdout).toBe(before.stdout); // 远程未变
    });
  });

  // ─────────────────────────────────────────────
  // E6: --dry-run + 无新 commit
  // ─────────────────────────────────────────────
  describe("E6: --dry-run 无新 commit", () => {
    beforeEach(() => setupWorkspace());

    it("reports nothing to push", async () => {
      const result = await runCli(["push", "--dry-run"], localDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/up-to-date|nothing to push/);
    });
  });

  // ─────────────────────────────────────────────
  // E7: --remote origin 显式指定
  // ─────────────────────────────────────────────
  describe("E7: --remote 指定", () => {
    beforeEach(() => setupWorkspace());

    it("pushes to explicitly named remote", async () => {
      await addCommit("explicit-remote");

      const result = await runCli(["push", "--remote", "origin"], localDir);
      expect(result.exitCode).toBe(0);

      const log = await git(["log", "--oneline", "main"], remoteDir);
      expect(log.stdout).toContain("explicit-remote");
    });
  });

  // ─────────────────────────────────────────────
  // E8: --remote 不存在
  // ─────────────────────────────────────────────
  describe("E8: --remote 不存在", () => {
    beforeEach(() => setupWorkspace());

    it("errors when remote does not exist", async () => {
      const result = await runCli(
        ["push", "--remote", "nonexistent"],
        localDir,
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(/nonexistent|not found/i);
    });
  });

  // ─────────────────────────────────────────────
  // E9: validate 失败
  // ─────────────────────────────────────────────
  describe("E9: validate 失败", () => {
    beforeEach(() => setupWorkspace());

    it("aborts push when validation fails", async () => {
      // 制造 validate 失败：条目有但无 index
      await writeEntry({
        relPath: "skills/S1.md",
        id: "S1",
        kind: "skill",
        collabDir,
      })

      await git(["add", "."], localDir);
      await git(["commit", "-q", "-m", "bad-entry"], localDir);

      const before = await git(["rev-parse", "origin/main"], localDir);
      const result = await runCli(["push"], localDir);
      const after = await git(["rev-parse", "origin/main"], localDir);

      expect(result.exitCode).not.toBe(0);
      expect(after.stdout).toBe(before.stdout); // 未推送
    });
  });

  // ─────────────────────────────────────────────
  // E10: 非 git 仓库
  // ─────────────────────────────────────────────
  describe("E10: 非 git 仓库", () => {
    it("errors when not in a git repo", async () => {
      testRoot = await mkdtemp(path.join(tmpdir(), "collab-nogit-"));
      localDir = testRoot;
      collabDir = path.join(testRoot, "COLLABORATION");
      await mkdir(collabDir, { recursive: true });
      const emptyGitConfig = path.join(testRoot, ".empty-gitconfig");
      await writeFile(emptyGitConfig, "");
      envOverrides = {
        GIT_CONFIG_GLOBAL: emptyGitConfig,
        GIT_CONFIG_SYSTEM: emptyGitConfig,
      };

      const result = await runCli(["push"], localDir);
      expect(result.exitCode).not.toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // E11: 分支未关联（自动 --set-upstream）
  // ─────────────────────────────────────────────
  describe("E11: 分支未关联", () => {
    it("auto sets upstream when branch is not tracked", async () => {
      // 不建立 upstream：跳过了 initialPush
      await setupWorkspace({ skipInitialPush: true });

      await writeFile(path.join(localDir, "README.md"), "first\n", "utf8");
      await git(["add", "."], localDir);
      await git(["commit", "-q", "-m", "first-commit"], localDir);

      const result = await runCli(["push"], localDir);
      expect(result.exitCode).toBe(0);

      // 验证远程有 main 分支
      const log = await git(["log", "--oneline", "main"], remoteDir);
      expect(log.stdout).toContain("first-commit");
    });
  });

  // ─────────────────────────────────────────────
  // E12: 显示 commit 列表
  // ─────────────────────────────────────────────
  describe("E12: 显示 commit 列表", () => {
    beforeEach(() => setupWorkspace());

    it("lists commit subjects after push", async () => {
      await addCommit("feat: commit-one", "one.txt");
      await addCommit("feat: commit-two", "two.txt");

      const result = await runCli(["push"], localDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("commit-one");
      expect(result.stdout).toContain("commit-two");
    });

    it("limits listing to 5 commits", async () => {
      for (let i = 1; i <= 7; i++) {
        await addCommit("commit-" + i, "file-" + i + ".txt");
      }

      const result = await runCli(["push"], localDir);
      expect(result.exitCode).toBe(0);
      // 至少显示 5 个
      expect(result.stdout).toContain("commit-7");
      // 提示还有更多
      expect(result.stdout.toLowerCase()).toMatch(/more|…|\.\.\./);
    });
  });

  describe("发布链（round-8）", () => {
    beforeEach(() => setupWorkspace());

    async function publishNewSkill(id: string, message: string): Promise<void> {
      await writeIndex(collabDir, "skills", []);
      expect((await runCli(["new", "skill", id], localDir)).exitCode).toBe(0);
      expect((await runCli(["index", "skills"], localDir)).exitCode).toBe(0);
      expect(
        (await runCli(["commit", "-m", message], localDir)).exitCode,
      ).toBe(0);
    }

    it("C1: new → index → commit → push --dry-run previews without pushing", async () => {
      await publishNewSkill("S30", "feat: add S30");

      const result = await runCli(["push", "--dry-run"], localDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("feat: add S30");

      const remoteLog = await git(["log", "--oneline", "main"], remoteDir);
      expect(remoteLog.stdout).not.toContain("feat: add S30");
    });

    it("C2: full chain reaches remote", async () => {
      await publishNewSkill("S30", "feat: add S30");

      const result = await runCli(["push"], localDir);
      expect(result.exitCode).toBe(0);

      const remoteLog = await git(["log", "--oneline", "main"], remoteDir);
      expect(remoteLog.stdout).toContain("feat: add S30");
    });

    it("C3: bad commit via --no-validate → push blocked", async () => {
      await writeIndex(collabDir, "skills", []);
      await runCli(["new", "skill", "S30"], localDir);
      await runCli(["commit", "-m", "bad", "--no-validate"], localDir);

      const before = await git(["rev-parse", "origin/main"], localDir);
      const result = await runCli(["push"], localDir);
      const after = await git(["rev-parse", "origin/main"], localDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain("validate failed");
      expect(after.stdout).toBe(before.stdout);
    });

    it("C4: push after publish reports up-to-date on second run", async () => {
      await publishNewSkill("S30", "feat: add S30");
      await runCli(["push"], localDir);

      const again = await runCli(["push"], localDir);
      expect(again.exitCode).toBe(0);
      expect(again.stdout.toLowerCase()).toMatch(/up-to-date|nothing to push/);
    });
  });
});
