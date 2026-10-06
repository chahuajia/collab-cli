import { parseArgs } from "node:util";
import { commitWorkspace, resolveAgentId } from "@/application/CommitUseCase";
import { findCollabRoot } from "@/infrastructure/fs/findCollabRoot";

/**
 * `collab commit -m "<message>" [--no-validate] [--agent <id>]`
 *
 * 校验（可选）+ git add COLLABORATION/ + git commit。
 *
 * @remarks
 * 决策落地（**核心在 `application/CommitUseCase.ts`** —— CLI 与 MCP 共用一份；
 * 这里只负责命令行表面：解析、打印、退出码）：
 * - D1：`-m` 必填且非空。
 * - D2：无变更时报错（与 git 一致）。
 * - D3：只 `git add COLLABORATION/`。
 * - D4：validate 失败时阻止提交；`--no-validate` 可跳过（**会出声**）。
 * - D5：`--no-validate` 时打印 `⚠ validate skipped`。
 * - D6：成功后提示下一步 `collab push`。
 * - D7：push 由独立命令负责，本命令不涉及。
 * - D8：`--agent <id>`（或 `COLLAB_AGENT_ID`）存在时，提交信息自动追加
 *   `Generated-by: <id>` trailer —— **AI 的提交要能在 `git log` 里认出来**，
 *   否则"让 agent commit 有利于观察历史"会反过来变成"历史里全是无法归因的提交"。
 */
export async function cmdCommit(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      message: { type: "string", short: "m" },
      "no-validate": { type: "boolean", default: false },
      agent: { type: "string" },
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

  // 3. 校验（D4 / D5）
  const skipValidate = values["no-validate"] === true;
  if (skipValidate) {
    console.log("⚠ validate skipped (--no-validate)");
  }

  // 4. 干（validate → add → commit），核心在 use case
  const outcome = commitWorkspace({
    gitRoot,
    collabDir,
    message,
    agentId: resolveAgentId(values.agent),
    validate: !skipValidate,
  });

  switch (outcome.kind) {
    case "validate-failed":
      console.log(
        `✖ validate failed: ${outcome.issues} issues (${outcome.errors} errors)`,
      );
      console.log("");
      console.log("Run `collab validate` for details. Aborting commit.");
      return process.exit(1);
    case "nothing-to-commit":
      throw new Error("nothing to commit (COLLABORATION has no changes)");
    case "ok":
      if (!skipValidate) {
        console.log(`✔ validate passed (${outcome.entries} entries, 0 issues)`);
      }
      console.log(`✔ committed: "${message}"`);
      if (outcome.agentId !== null) console.log(`  署名：Generated-by: ${outcome.agentId}`);
      console.log("");
      console.log("Next: run `collab push` to push to remote."); // D6
  }
}
