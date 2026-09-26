import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { beforeEach, afterEach } from "vitest";
import {
  DefaultStatusFor,
  type EntryKind,
  EntryKindDir,
  EntryKindValues,
} from "@/domain/entry/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("project root not found");
    dir = parent;
  }
}
const PROJECT_ROOT = findProjectRoot(__dirname);
export const CLI_ENTRY = path.join(PROJECT_ROOT, "dist/cli/index.js");

/**
 * 运行 CLI，**不预设成功或失败**。
 *
 * @remarks
 * 内部使用。外部测试优先用 `runCliSuccess` 或 `runCliFailure`——
 * 它们会校验退出码，让测试意图更清晰。
 */
async function runCli(
  args: string[],
  cwd: string,
  envOverrides: Record<string, string> = {},
) {
  return execa("node", [CLI_ENTRY, ...args], {
    cwd,
    reject: false,
    env: { ...process.env, ...envOverrides },
  });
}

/**
 * 运行 CLI 并**期望成功**（exitCode === 0）。
 * 非 0 时抛出带 stderr 的错误，便于诊断。
 */
export async function toSucceed(
  args: string[],
  cwd: string,
  envOverrides: Record<string, string> = {},
) {
  const result = await runCli(args, cwd, envOverrides);
  if (result.exitCode !== 0) {
    throw new Error(
      `CLI exited with code ${result.exitCode}\n` +
        `STDOUT: ${result.stdout}\n` +
        `STDERR: ${result.stderr}`,
    );
  }
  return result;
}

/**
 * 运行 CLI 并**期望失败**（exitCode !== 0）。
 * 成功时抛出错误，说明测试期望未被满足。
 */
export async function toFail(
  args: string[],
  cwd: string,
  envOverrides: Record<string, string> = {},
) {
  const result = await runCli(args, cwd, envOverrides);
  if (result.exitCode === 0) {
    throw new Error(
      `Expected CLI to fail, but it succeeded\n` +
        `STDOUT: ${result.stdout}\n` +
        `STDERR: ${result.stderr}`,
    );
  }
  return result;
}

/**
 * 构造条目内容所需的信息。
 */
export interface EntryContentOptions {
  /** 条目 id（frontmatter.id） */
  readonly id: string;
  /** 条目类型 */
  readonly kind: EntryKind;
  /** 覆盖默认 status */
  readonly status?: string;
  /** 覆盖默认 author */
  readonly author?: string;
  /** 覆盖默认 created */
  readonly created?: string;
  /** 覆盖默认 updated */
  readonly updated?: string;
}

export interface WriteEntryOptions extends EntryContentOptions {
  /** 相对 COLLABORATION 的路径，如 `skills/S1.md` */
  readonly relPath: string;
  /** COLLABORATION 目录的绝对路径 */
  readonly collabDir: string;
}

/**
 * 构造一条最小合法条目的内容（不落盘）。
 *
 * @remarks
 * fixture 必须"通过生产校验"——**默认值按 kind 选择**：
 * - ADR → `status: proposed`
 * - 其他 → `status: draft`
 *
 * 这是"测试 DDD"的落地：**fixture 用生产的"领域规则"，不用"测试捷径"**。
 *
 * 与 `writeEntry` 分开的理由：bundle 类测试需要"内容"而不是"文件"
 * （内容要先算 sha256 再进 bundle）。**内容的构造只此一处**。
 */
export function minimalEntryContent(opts: EntryContentOptions): string {
  const {
    id,
    kind,
    author = "test@example.com",
    created = "2026-09-14",
    updated = "2026-09-14",
  } = opts;

  const status = opts.status ?? defaultStatusFor(kind);

  return [
    "---",
    `id: ${id}`,
    `type: ${kind}`,
    `status: ${status}`,
    `created: ${created}`,
    `updated: ${updated}`,
    `author: ${author}`,
    // id 必须登记为 alias —— 渲染层靠 alias 解析 id 形式的链接
    "aliases:",
    `  - ${id}`,
    "---",
    "",
    "## 上下文",
    "",
    "## 问题",
    "",
    "## 方案",
    "",
    "## 反面",
    "",
    "## 关联",
    "",
  ].join("\n");
}

/**
 * 写入一条最小合法条目。
 */
export async function writeEntry(opts: WriteEntryOptions): Promise<void> {
  const { relPath, collabDir } = opts;
  const content = minimalEntryContent(opts);

  const full = path.join(collabDir, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
}

/** 按 kind 选默认 status。 */
function defaultStatusFor(kind: EntryKind): string {
  return DefaultStatusFor[kind];
}

/**
 * 具名工厂：写一条 skill。
 *
 * @remarks
 * 让测试的意图显式 —— `writeSkill('skills/S30.md', 'S30', ctx().collabDir)`。
 */
export async function writeSkill(
  relPath: string,
  id: string,
  collabDir: string,
): Promise<void> {
  await writeEntry({ relPath, id, kind: EntryKindValues.Skill, collabDir });
}

export async function writeAgreement(
  relPath: string,
  id: string,
  collabDir: string,
): Promise<void> {
  await writeEntry({ relPath, id, kind: EntryKindValues.Agreement, collabDir });
}

export async function writeWorkflow(
  relPath: string,
  id: string,
  collabDir: string,
): Promise<void> {
  await writeEntry({ relPath, id, kind: EntryKindValues.Workflow, collabDir });
}

export async function writePattern(
  relPath: string,
  id: string,
  collabDir: string,
): Promise<void> {
  await writeEntry({ relPath, id, kind: EntryKindValues.Pattern, collabDir });
}

export async function writeAdr(
  relPath: string,
  id: string,
  collabDir: string,
): Promise<void> {
  await writeEntry({ relPath, id, kind: EntryKindValues.Adr, collabDir });
}

/**
 * 写入一个 `_index.md`（简单表格）。
 *
 * @remarks
 * 只用于测试——不做复杂格式。
 * 已有的 `_index.md` 手工构造的仍用 `writeFile`。
 */
export async function writeIndex(
  collabDir: string,
  relDir: string,
  ids: readonly string[],
): Promise<void> {
  const header = "| ID | 名称 | 领域 | 状态 |\n| :-- | :-- | :-- | :-- |\n";
  const rows = ids.map((id) => `| [[${id}]] | x | | |`).join("\n");
  await writeFile(
    path.join(collabDir, relDir, "_index.md"),
    header + rows + "\n",
    "utf8",
  );
}

/**
 * 测试工作区的上下文。
 */
export interface WorkspaceContext {
  readonly root: string;
  readonly collabDir: string;
  readonly envOverrides: Record<string, string>;
}

export interface UseTestWorkspaceOptions {
  readonly git?: boolean;
  readonly collab?: boolean;
  readonly dirs?: readonly string[];

  /**
   * 通用创建工作区之后、测试体之前执行。
   *
   * @remarks
   * 用于"特定 Arrange" —— 如创建 baseline commit、写入 fixture。
   * 在 `beforeEach` 里执行 —— 每个测试都会跑。
   */
  readonly before?: (ctx: WorkspaceContext) => Promise<void>;

  /**
   * 测试体之后、通用清理之前执行。
   *
   * @remarks
   * 用于"特定 Teardown" —— 如清理副作用、归档状态。
   * 在 `afterEach` 里执行 —— 每个测试都会跑。
   */
  readonly after?: (ctx: WorkspaceContext) => Promise<void>;
}

const DEFAULT_DIRS = Object.values(EntryKindDir);

/**
 * 创建测试工作区（不依赖 vitest 钩子）。
 *
 * @remarks
 * 用于"非标准生命周期"的场景（如 `push` 测试需要"创建后手动配置 remote"）。
 */
export async function createWorkspace(
  opts: UseTestWorkspaceOptions = {},
): Promise<WorkspaceContext> {
  const useGit = opts.git ?? true;
  const useCollab = opts.collab ?? true;
  const dirs = opts.dirs ?? DEFAULT_DIRS;

  const root = await mkdtemp(path.join(tmpdir(), "collab-test-"));
  const collabDir = path.join(root, "COLLABORATION");

  const emptyGitConfig = path.join(root, ".empty-gitconfig");
  await writeFile(emptyGitConfig, "");
  const envOverrides = {
    GIT_CONFIG_GLOBAL: emptyGitConfig,
    GIT_CONFIG_SYSTEM: emptyGitConfig,
    // ── 仓位置也钉死在临时目录里（默认 = "三个仓都不存在"）──────────────────
    //
    // 为什么必须钉：不钉的话，测试会**悄悄依赖"作者本机恰好有那三个仓"**。
    // 2026-09-26 CI 实测：GitHub runner 上 `evolutionary` 不可达 →
    // `retire --enforced` 走"无法判定 → 警告放行"（exit 0）→ R10 断言"应当失败"落空，
    // 而本地一直绿（本地那份绝对路径真实存在）。**本地绿 ≠ CI 绿。**
    //
    // 需要某个仓的测试**自己**把它指到一个临时目录（见 R10 / validate F1、F2）。
    // 逐仓变量显式置空：否则开发机/CI 的环境变量会漏进来，把"钉死"变成"看运气"。
    COLLAB_PROJECTS_DIR: path.join(root, "no-such-projects"),
    COLLAB_CLI_DIR: "",
    COLLAB_KB_DIR: "",
    EVOLUTIONARY_DIR: "",
  };

  if (useGit) {
    await execa("git", ["init", "-q"], {
      cwd: root,
      env: { ...process.env, ...envOverrides },
    });
    await execa(
      "git",
      ["config", "--local", "user.email", "test@example.com"],
      {
        cwd: root,
        env: { ...process.env, ...envOverrides },
      },
    );
    await execa("git", ["config", "--local", "user.name", "Test"], {
      cwd: root,
      env: { ...process.env, ...envOverrides },
    });
  }

  if (useCollab) {
    for (const sub of dirs) {
      await mkdir(path.join(collabDir, sub), { recursive: true });
    }
  }

  return { root, collabDir, envOverrides };
}

/**
 * 清理测试工作区（删除临时目录）。
 *
 * @remarks
 * 用于"手动生命周期"的测试 —— 它们不能用 `useTestWorkspace`（因为需要
 * 特殊的 beforeEach 逻辑），但清理逻辑应和 `useTestWorkspace` 一致。
 *
 * **统一"清理"这个 How** —— 避免两处不同的清理方式。
 */
export async function cleanupWorkspace(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

export function useTestWorkspace(
  opts: UseTestWorkspaceOptions = {},
): () => WorkspaceContext {
  let current: WorkspaceContext;

  beforeEach(async () => {
    current = await createWorkspace(opts);
    if (opts.before) {
      await opts.before(current);
    }
  });

  afterEach(async () => {
    if (current) {
      if (opts.after) {
        await opts.after(current);
      }
      await cleanupWorkspace(current.root);
    }
  });

  return () => current;
}
