import { execFileSync } from "node:child_process";

/**
 * 运行 git 命令，返回 stdout。
 *
 * @remarks
 * - **成功** → 返回 stdout（可能为空字符串）。
 * - **失败** → 抛 `Error`，消息包含"运行的命令"和 git 的 stderr。
 *
 * **设计决策**（任务 #2）：
 * - **不接收 `op` 参数** —— 调用方不该传"上下文"给通用工具。
 * - **错误消息包含 git args** —— 让调用方从消息就能定位"跑了什么"。
 * - **返回 `string`** —— `commit.ts` 不关心 stdout 时可忽略。
 */
export function gitRun(args: string[], cwd: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stderr = extractStderr(e);
    throw new Error(
      `git ${args.join(" ")} failed: ${stderr.trim() || message}`,
    );
  }
}

/**
 * 类型守卫：判断 e 是否形如 `{ stderr: unknown }`。
 *
 * @remarks
 * 用类型守卫代替 `as` 断言 —— 断言是"我保证"，守卫是"我验证"。
 */
function hasStderr(e: unknown): e is { stderr: unknown } {
  return typeof e === "object" && e !== null && "stderr" in e;
}

/**
 * 从未知类型的错误中提取 stderr。
 *
 * @remarks
 * `execFileSync` 抛出的是 `Error` 的子类，附加 `stderr` / `stdout` 字段 ——
 * 但 TS 的标准类型定义不包含它们。
 */
function extractStderr(e: unknown): string {
  if (!hasStderr(e)) return "";
  const raw = e.stderr;
  if (typeof raw === "string") return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw).toString("utf8");
  return "";
}
