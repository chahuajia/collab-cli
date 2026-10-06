import { parseArgs } from "node:util";
import {
  ValidateUseCase,
  standardRules,
} from "@/application/ValidateUseCase";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import { findCollabRoot } from "@/infrastructure/fs/findCollabRoot";
import { gitRun } from "@/infrastructure/git/gitRunner";

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
 * - D8：**默认拒绝推送** —— 需 `--allow-push` 或 `COLLAB_ALLOW_PUSH=1` 显式授权。
 *   （`--dry-run` 是只读的，不需要授权。）
 * - 额外：分支未关联时**自动 `--set-upstream`**。
 */
export async function cmdPush(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      "dry-run": { type: "boolean", default: false },
      remote: { type: "string" },
      branch: { type: "string" },
      "allow-push": { type: "boolean", default: false },
    },
    strict: false,
  })

  // 0. 授权门（D8）—— **在 validate 之前**：未授权就没必要往下算
  if (values["dry-run"] !== true) {
    assertPushAllowed(values["allow-push"] === true);
  }

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

/**
 * 推送授权：**默认拒绝**，要 `--allow-push` 或 `COLLAB_ALLOW_PUSH=1`。
 *
 * @remarks
 * 边界写在这里：KB `integrations/cli-agent-boundaries.md` —— **AI 可以 commit，但不 push**
 * （主干与远端归人）。CLI **分不清调用者是人还是 agent**，所以把它做成**显式授权**：
 * 人要么这一次打 `--allow-push`，要么在 shell 里设一次 `COLLAB_ALLOW_PUSH=1`。
 *
 * 为什么以前没有这道门：这条规则原来只写在散文里，而 `collab push` 谁都能跑 ——
 * 2026-10-06 实测的"承诺 vs 现实"。**能装成门禁的边界，别只写在文档里。**
 *
 * 刻意**不加**"主干分支黑名单"：那会让正常的人肉 push 多一道手续，
 * 而"多一道手续"的典型结局是绕过 CLI 直接 `git push`（仪器被无视）。
 * 主干归人这条留在 KB 的边界表里，由人和 review 流程承担。
 */
function assertPushAllowed(allowFlag: boolean): void {
  const fromEnv = (process.env["COLLAB_ALLOW_PUSH"] ?? "").trim();
  if (allowFlag || fromEnv.length > 0) return;

  console.error("✖ 拒绝推送：**没有显式授权**。");
  console.error("");
  console.error("  边界（KB integrations/cli-agent-boundaries）：AI 可 commit，**不 push** —— 远端归人。");
  console.error("  CLI 分不清调用者，所以要求显式授权：");
  console.error("    1) 这一次：  collab push --allow-push");
  console.error("    2) 长期：    $env:COLLAB_ALLOW_PUSH = \"1\"   （PowerShell；bash: export COLLAB_ALLOW_PUSH=1）");
  console.error("    3) 只想看：  collab push --dry-run   （只读，不需要授权）");
  process.exit(1);
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
