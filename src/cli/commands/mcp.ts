import path from "node:path";
import readline from "node:readline";
import { parseArgs } from "node:util";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { createSession, dispatch } from "@/mcp/server";
import type { ToolContext } from "@/mcp/handlers";

/**
 * `collab mcp [--dir <path>]`
 *
 * 把知识库以 **MCP stdio 服务器**的形式暴露给 AI 客户端。
 *
 * @remarks
 * **stdout 是协议通道，不是日志通道。** 本函数里不许出现 `console.log`
 * —— 往 stdout 写任何非 JSON-RPC 内容都会让客户端解析失败。
 * 所有诊断信息走 stderr（规范允许，且客户端通常透传给用户）。
 *
 * 工作区**不在启动时强制解析**：客户端可能从任意 cwd 拉起服务器。
 * 解析失败时记在 `dir = null`，等工具调用时若带 `dir` 参数仍可用；
 * 不带参数则给出可操作的错误提示。
 */
export async function cmdMcp(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { dir: { type: "string" } },
    strict: false,
  });

  const cwd = process.cwd();
  const rawDir = values.dir;
  const explicit = typeof rawDir === "string" && rawDir.length > 0
    ? path.resolve(cwd, rawDir)
    : null;

  const ctx: ToolContext = { cwd, dir: resolveStartupDir(cwd, explicit) };
  const session = createSession();

  process.stderr.write(
    `collab mcp: workspace = ${ctx.dir ?? "(未解析 —— 调用工具时传 dir 参数)"}\n`,
  );

  const lines = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (line.trim().length === 0) continue;
    const response = dispatch(line, ctx, session);
    if (response !== null) process.stdout.write(response);
  }
}

/**
 * 启动时解析默认工作区。
 *
 * @remarks
 * 失败**不终止进程** —— 一个还没进工作区的客户端应该看到工具能列出来，
 * 而不是一个连不上的服务器。真正的报错推迟到第一次用到它的工具调用。
 */
function resolveStartupDir(cwd: string, explicit: string | null): string | null {
  try {
    return explicit !== null
      ? findCollabRoot(explicit, explicit).collabDir
      : findCollabRoot(cwd).collabDir;
  } catch {
    return null;
  }
}
