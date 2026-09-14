import { execFileSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  ValidateUseCase,
  standardRules,
} from "@/application/ValidateUseCase";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";

/**
 * `collab commit -m "<message>" [--no-validate]`
 *
 * 校验（可选）+ git add COLLABORATION/ + git commit。
 *
 * @remarks
 * 决策落地：
 * - D1：`-m` 必填且非空。
 * - D2：无变更时报错（与 git 一致）。
 * - D3：只 `git add COLLABORATION/`。
 * - D4：validate 失败时阻止提交；`--no-validate` 可跳过。
 * - D5：`--no-validate` 时打印 `⚠ validate skipped`。
 * - D6：成功后提示下一步 `collab push`。
 * - D7：push 由独立命令负责，本命令不涉及。
 */
export async function cmdCommit(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      message: { type: "string", short: "m" },
      "no-validate": { type: "boolean", default: false },
    },
    strict: false,
  });

  // 1. message 必填（D1）
  const message = values.message;
  if (typeof message !== "string" || message.length === 0) {
    throw new Error(
      'missing commit message. Usage: collab commit -m "<message>"',
    );
  }

  // 2. 定位 COLLABORATION
  const { collabDir, gitRoot } = findCollabRoot(process.cwd());
  const relCollabDir = path.relative(gitRoot, collabDir);

  // 3. 校验（D4 / D5）
  if (values["no-validate"]) {
    console.log("⚠ validate skipped (--no-validate)");
  } else {
    const loader = new FileWorkspaceLoader(collabDir);
    const useCase = new ValidateUseCase(loader, standardRules);
    const { entries, report } = useCase.execute();

    if (report.hasBlocking()) {
      console.log(
        `✖ validate failed: ${report.count()} issues (${report.errors().length} errors)`,
      );
      console.log("");
      console.log("Run `collab validate` for details. Aborting commit.");
      process.exit(1);
    }

    console.log(`✔ validate passed (${entries.length} entries, 0 issues)`);
  }

  // 4. git add COLLABORATION（D3）
  gitRun(["add", relCollabDir], gitRoot, "git add");

  // 5. 检查是否有 staged 变更（D2）
  if (!hasStagedChanges(gitRoot, relCollabDir)) {
    throw new Error("nothing to commit (COLLABORATION has no changes)");
  }

  // 6. git commit
  gitRun(["commit", "-m", message], gitRoot, "git commit");

  console.log(`✔ committed: "${message}"`);
  console.log("");
  console.log("Next: run `collab push` to push to remote."); // D6
}

/**
 * 运行 git 命令，失败时抛出带操作名的错误。
 *
 * @remarks
 * 用 `stdio: ['ignore', 'pipe', 'pipe']`——不污染终端输出，
 * 由调用方决定是否/如何打印。
 */
function gitRun(args: string[], cwd: string, op: string): void {
  try {
    execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${op} failed: ${msg}`);
  }
}

/**
 * 检查指定路径是否有 staged 变更。
 *
 * @remarks
 * `git diff --cached --quiet` 的退出码语义：
 * - 0 → 无差异
 * - 1 → 有差异
 *
 * 用 `-- <path>` 限定范围——只关心 COLLABORATION 下的变更，
 * 不影响其他目录的 staged 状态。
 */
function hasStagedChanges(cwd: string, relPath: string): boolean {
  try {
    execFileSync("git", ["diff", "--cached", "--quiet", "--", relPath], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return false; // exit 0 = 无差异
  } catch {
    return true; // exit 1 = 有差异
  }
}
