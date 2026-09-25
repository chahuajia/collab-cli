// src/infrastructure/git/gitIdentity.ts
import { execFileSync } from "node:child_process";

/**
 * 作者标识的**第二、三级来源**：环境 → git 配置。
 *
 * @remarks
 * 优先级链与 **git 自己**一致（这是"最小惊奇"的依据 —— 用户已经知道 git 怎么定作者）：
 *
 * ```
 * --author <name>                      ← 第一级，由用例先看（本函数看不到）
 * GIT_AUTHOR_NAME / GIT_AUTHOR_EMAIL   ← 环境（CI 常在这里给身份）
 * git config user.name / user.email    ← 配置（本仓或全局）
 * ```
 *
 * 每一级内部再按"人 → 邮箱"取：`author` 的语义是**人**（条目里写的是 `heiniao`
 * 这样的名字，不是邮箱），邮箱只作兜底。
 *
 * @param env - 注入环境（默认 `process.env`）—— 让"环境那一级"能被测
 * @returns 作者标识；都没给或命令失败时 `undefined`（**不抛** —— 缺身份由用例决定怎么办）
 */
export function readGitAuthor(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const fromEnv = firstNonEmpty(env["GIT_AUTHOR_NAME"], env["GIT_AUTHOR_EMAIL"]);
  if (fromEnv !== undefined) return fromEnv;
  return firstNonEmpty(readGitConfig(cwd, "user.name"), readGitConfig(cwd, "user.email"));
}

/** 第一个非空白值；全空返回 `undefined`。 */
function firstNonEmpty(...values: readonly (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function readGitConfig(cwd: string, key: string): string | undefined {
  try {
    const out = execFileSync("git", ["config", key], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}
