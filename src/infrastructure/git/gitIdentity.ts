// src/infrastructure/git/gitIdentity.ts
import { execFileSync } from "node:child_process";

/**
 * 从 git 配置读**作者标识**（`user.name` → `user.email`）。
 *
 * @remarks
 * `author` 的语义是"**人**"（条目里写的是 `heiniao` 这样的名字，不是邮箱），
 * 所以 `user.name` 优先，邮箱只作兜底。
 *
 * 它是**适配器**：命令里原先直接 `execFileSync('git', …)`，于是"条目作者从哪来"
 * 这件事既不属于命令（presentation），也没法在被测时替换。现在它是一个注入点 ——
 * 用例只声明"我要一个作者标识"，怎么拿到由这里决定。
 *
 * @returns 作者标识；未配置或命令失败时 `undefined`（**不抛** —— 缺身份由用例决定怎么办）
 */
export function readGitAuthor(cwd: string): string | undefined {
  return readGitConfig(cwd, "user.name") ?? readGitConfig(cwd, "user.email");
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
