import path from "node:path";
import { ValidateUseCase, standardRules } from "@/application/ValidateUseCase";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import { gitRun } from "@/infrastructure/git/gitRunner";

/**
 * 提交知识库改动 —— **CLI 与 MCP 共用这一份**。
 *
 * @remarks
 * 抽出来的理由：CLI 的 `collab commit` 与 MCP 的 `collab_commit` **做的是同一件事**
 * （validate → `git add` → `git commit` ＋ 署名 trailer）。两份必然漂移，
 * 而"CLI 允许、MCP 拒绝"这种漂移最坏 —— 调用者根本不知道哪份是对的。
 *
 * 这里只做**判定与动作**，不打印、不 `process.exit`（那两个是 CLI 的事）：
 * MCP 服务器往 stdout 写任何非协议内容都会破坏协议流。
 */

export interface CommitInput {
  readonly gitRoot: string;
  readonly collabDir: string;
  readonly message: string;
  /** 署名标识；`null` = 不加 trailer（不编一个）。 */
  readonly agentId: string | null;
  /** `false` = 跳过校验（CLI 的 `--no-validate`；危险，调用方负责出声）。 */
  readonly validate: boolean;
}

export type CommitOutcome =
  | {
      readonly kind: "ok";
      readonly entries: number;
      /** 真正写进 git 的提交信息（可能比入参多了 trailer）。 */
      readonly message: string;
      readonly agentId: string | null;
    }
  | { readonly kind: "validate-failed"; readonly issues: number; readonly errors: number }
  | { readonly kind: "nothing-to-commit" };

/**
 * 执行提交。
 *
 * @throws 当 `git add` / `git commit` 本身失败（调用方按自己的方式报错）
 */
export function commitWorkspace(input: CommitInput): CommitOutcome {
  const { gitRoot, collabDir, message, agentId, validate } = input;

  // 1. 校验（可跳过）
  let entries = 0;
  if (validate) {
    const loader = new FileWorkspaceLoader(collabDir);
    const { entries: parsed, report } = new ValidateUseCase(loader, standardRules).execute();
    if (report.hasBlocking()) {
      return { kind: "validate-failed", issues: report.count(), errors: report.errors().length };
    }
    entries = parsed.length;
  }

  // 2. `git add` —— 只加知识库那部分
  const rawRelPath = path.relative(gitRoot, collabDir);
  const relCollabDir = rawRelPath === "" ? "." : rawRelPath;
  gitRun(["add", relCollabDir], gitRoot);

  // 3. 没有 staged 变更就没什么可提交的
  if (!hasStagedChanges(gitRoot, relCollabDir)) {
    return { kind: "nothing-to-commit" };
  }

  // 4. commit（带署名 trailer）
  const fullMessage =
    agentId === null ? message : `${message}\n\nGenerated-by: ${agentId}`;
  gitRun(["commit", "-m", fullMessage], gitRoot);

  return { kind: "ok", entries, message: fullMessage, agentId };
}

/**
 * 解析署名标识：显式给的值优先，其次 `COLLAB_AGENT_ID`；都没有 → `null`。
 *
 * @remarks
 * 优先级链与 `new` 的 `--author` / `GIT_AUTHOR_*` 同形（"用户已经会的那条链"）。
 * 都没有就**不加 trailer**，也不编一个。
 */
export function resolveAgentId(explicit: unknown): string | null {
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return explicit.trim();
  }
  const fromEnv = (process.env["COLLAB_AGENT_ID"] ?? "").trim();
  return fromEnv.length > 0 ? fromEnv : null;
}

/**
 * 指定路径是否有 staged 变更。
 *
 * @remarks
 * `git diff --cached --quiet` 的退出码：0 = 无差异、1 = 有差异。
 * 用 `-- <path>` 限定范围，不影响其他目录的 staged 状态。
 */
function hasStagedChanges(cwd: string, relPath: string): boolean {
  try {
    gitRun(["diff", "--cached", "--quiet", "--", relPath], cwd);
    return false;
  } catch {
    return true;
  }
}
