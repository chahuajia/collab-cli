import { parseArgs } from "node:util";
import {
  ValidateUseCase,
  standardRules,
} from "@/application/ValidateUseCase";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import { gitRun } from "@/infrastructure/git/gitRunner";
import { findCollabRoot } from "../lib/findCollabRoot.js";

const MAX_COMMITS_SHOWN = 5;

/**
 * `collab push [--dry-run] [--remote <r>] [--branch <b>]`
 *
 * 校验 + git push。
 *
 * @remarks
 * 决策落地：
 * - D1：推送前跑 validate（阻断性 Issue 存在则终止）。
 * - D2：默认 `origin`，可用 `--remote` 覆盖。
 * - D3：默认当前分支，可用 `--branch` 覆盖。
 * - D4：远程有新 commit 时**不自动 pull**——报错 + 提示。
 * - D5：无新 commit 时**成功退出**（`✔ up-to-date`）。
 * - D6：`--dry-run` 显示待推送内容，不实际推送。
 * - D7：成功后显示最近 ≤5 个 commit 的 subject。
 * - 额外：分支未关联时**自动 `--set-upstream`**。
 */
export async function cmdPush(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      "dry-run": { type: "boolean", default: false },
      remote: { type: "string" },
      branch: { type: "string" },
    },
    strict: false,
  })

  const { collabDir, gitRoot } = findCollabRoot(process.cwd());

  // 1. 解析 remote（D2）
  const remote =
    typeof values.remote === "string" && values.remote.length > 0
      ? values.remote
      : "origin";

  if (!remoteExists(gitRoot, remote)) {
    throw new Error(`remote "${remote}" not found`);
  }

  // 2. 解析 branch（D3）
  const branch =
    typeof values.branch === "string" && values.branch.length > 0
      ? values.branch
      : currentBranch(gitRoot);

  // 3. validate（D1）
  const loader = new FileWorkspaceLoader(collabDir);
  const useCase = new ValidateUseCase(loader, standardRules);
  const { entries, report } = useCase.execute();

  if (report.hasBlocking()) {
    console.log(
      `✖ validate failed: ${report.count()} issues (${report.errors().length} errors)`,
    );
    console.log("");
    console.log("Run `collab validate` for details. Aborting push.");
    process.exit(1);
  }
  console.log(`✔ validate passed (${entries.length} entries, 0 issues)`);

  // 4. 判断 upstream
  const hasUpstream = branchHasUpstream(gitRoot, branch);
  const upstreamRef = `${remote}/${branch}`;

  // 5. 计算待推送 commit
  let pending: readonly string[];
  if (hasUpstream) {
    pending = logRange(gitRoot, `${upstreamRef}..HEAD`);
  } else {
    // 无 upstream：当前分支所有 commit 都待推送
    pending = logRange(gitRoot, branch);
  }

  // 6. 无新 commit（D5）
  if (hasUpstream && pending.length === 0) {
    console.log("✔ everything up-to-date (nothing to push)");
    return;
  }

  // 7. dry-run（D6 / D7）
  if (values["dry-run"]) {
    console.log("");
    console.log(
      `(dry-run) would push ${pending.length} commit(s) to ${upstreamRef}`,
    );
    printCommits(pending);
    return;
  }

  // 8. push
  try {
    const pushArgs = ["push"];
    if (!hasUpstream) pushArgs.push("--set-upstream");
    pushArgs.push(remote, branch);
    gitRun(pushArgs, gitRoot);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/rejected|non-fast-forward|fetch first|diverged/i.test(msg)) {
      console.log("✖ push rejected: remote has new commits");
      console.log("");
      console.log("  Run `git pull` first, then retry `collab push`.");
      process.exit(1);
    }
    throw new Error(`git push failed: ${msg}`);
  }

  // 9. 报告（D7）
  console.log("");
  console.log(`✔ pushed ${pending.length} commit(s) to ${upstreamRef}`);
  printCommits(pending);
}

// ─────────────────────────────────────────────
// git helpers
// ─────────────────────────────────────────────

/** 检查 remote 是否存在。 */
function remoteExists(cwd: string, remote: string): boolean {
  try {
    const out = gitRun(["remote"], cwd);
    return out
      .split("\n")
      .map((s) => s.trim())
      .includes(remote);
  } catch {
    return false;
  }
}

/** 当前分支名。 */
function currentBranch(cwd: string): string {
  return gitRun(["rev-parse", "--abbrev-ref", "HEAD"], cwd).trim();
}

/** 分支是否关联了 upstream。 */
function branchHasUpstream(cwd: string, branch: string): boolean {
  try {
    gitRun(
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${branch}@{u}`],
      cwd,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取指定 range 内的 commit，按"最新在前"排序。
 *
 * @returns 形如 `["abc1234 subject", ...]`
 */
function logRange(cwd: string, range: string): readonly string[] {
  try {
    const out = gitRun(["log", "--pretty=format:%h %s", range], cwd);
    return out.split("\n").filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/** 打印 commit 列表（最多 5 个 + "and N more"）。 */
function printCommits(commits: readonly string[]): void {
  const shown = commits.slice(0, MAX_COMMITS_SHOWN);
  for (const c of shown) {
    console.log("  " + c);
  }
  if (commits.length > MAX_COMMITS_SHOWN) {
    console.log(`  ... and ${commits.length - MAX_COMMITS_SHOWN} more`);
  }
}
