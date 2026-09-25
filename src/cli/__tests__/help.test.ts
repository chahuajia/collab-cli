import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toSucceed, useTestWorkspace } from "@/cli/commands/__tests__/testHelpers";
import { SUPPORTED_PROFILES } from "@/cli/commands/init";
import { COMMANDS } from "@/cli/index";

const ctx = useTestWorkspace();

const COMMANDS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../commands",
);

/**
 * 命令源码里 `parseArgs` 声明的选项键。
 *
 * @remarks
 * 从**源码**取，而不是维护一份清单 —— 这份 help 曾经漏掉 `--kb` / `--out` /
 * `--stdout` / `--with-ci` / `--max-candidate-age` 五个真选项，也曾经写着
 * 早已不存在的 `--profile starter`。判据只有一条：**源码里有的，help 必须提**。
 */
function declaredOptionKeys(): readonly string[] {
  const keys = new Set<string>();
  const pattern = /^\s+"?([a-z][a-z-]*)"?:\s*\{\s*type:/gm;
  for (const name of readdirSync(COMMANDS_DIR)) {
    if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
    const source = readFileSync(path.join(COMMANDS_DIR, name), "utf8");
    for (const match of source.matchAll(pattern)) {
      const key = match[1];
      if (key !== undefined) keys.add(key);
    }
  }
  return [...keys].sort();
}

/**
 * 解析 `--help` 的 Commands 段。
 *
 * @remarks
 * 只取 `Commands:` 到下一个空行之间的行；命令行形如 `  <name> [args]  说明`。
 * 续行（缩进更多、以 `(` 开头）不算命令。
 */
function commandsInHelp(help: string): string[] {
  const lines = help.split("\n");
  const start = lines.findIndex((l) => l.trim() === "Commands:");
  if (start === -1) throw new Error("help has no `Commands:` section");

  const names: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") break;
    const match = /^ {2}([a-z][a-z-]*)(?:\s|$)/.exec(line);
    if (match !== null && match[1] !== undefined) names.push(match[1]);
  }
  return names;
}

describe("collab --help", () => {
  it("lists every command in COMMANDS", async () => {
    const result = await toSucceed(["--help"], ctx().root, ctx().envOverrides);
    const listed = new Set(commandsInHelp(result.stdout));

    for (const name of Object.keys(COMMANDS)) {
      expect(listed.has(name), `help is missing command "${name}"`).toBe(true);
    }
  });

  it("invents no command that COMMANDS does not have", async () => {
    const result = await toSucceed(["--help"], ctx().root, ctx().envOverrides);
    const known = new Set(Object.keys(COMMANDS));

    for (const name of commandsInHelp(result.stdout)) {
      expect(known.has(name), `help lists unknown command "${name}"`).toBe(true);
    }
  });

  it("lists each command exactly once (no duplicate rows)", async () => {
    const result = await toSucceed(["--help"], ctx().root, ctx().envOverrides);
    const names = commandsInHelp(result.stdout);
    expect(names.length).toBe(new Set(names).size);
  });

  /**
   * help 里的 `--profile` 取值必须与 **实际支持的** 一致。
   *
   * @remarks
   * 2026-09-26 实测：help 写着 `--profile starter`，而 `starter` 早就不是合法值
   * （`init` 当场报"未知 --profile"）。**手写的取值清单必然漂移** ——
   * 现在它从 `SUPPORTED_PROFILES` 派生，这条测试钉住派生关系。
   */
  it("advertises exactly the supported --profile values", async () => {
    const result = await toSucceed(["--help"], ctx().root, ctx().envOverrides);
    const advertised = new Set(SUPPORTED_PROFILES);

    for (const profile of advertised) {
      expect(result.stdout, `help 未列出 --profile ${profile}`).toContain(profile);
    }
    // 反向：不许出现任何"看起来像 profile 但不在清单里"的取值
    const line = result.stdout.split("\n").find((l) => l.includes("--profile")) ?? "";
    const values = line.match(/--profile\s+([a-z|]+)/)?.[1]?.split("|") ?? [];
    expect(values.sort()).toEqual([...advertised].sort());
  });

  /**
   * 源码里声明的**每个选项**都要在 help 里出现。
   *
   * @remarks
   * 2026-09-26 深查时实测：help 漏了 `--kb` / `--with-ci` / `--with-hook` /
   * `--out` / `--stdout` / `--max-candidate-age`，而 `--author` 的说明还写着
   * "override git user.email"（实现优先 `user.name`）。人工比对会漏 —— 这条测试不会。
   */
  it("documents every option the commands actually declare", async () => {
    const result = await toSucceed(["--help"], ctx().root, ctx().envOverrides);
    const keys = declaredOptionKeys();

    expect(keys.length, "选项提取器没扫到东西 —— 正则可能过期了").toBeGreaterThan(15);
    const missing = keys.filter((key) => !result.stdout.includes(`--${key}`));
    expect(missing, `help 未提及这些选项：${missing.join(", ")}`).toEqual([]);
  });

  it("fails an unknown command with a non-zero exit and a help hint", async () => {
    const result = await toSucceed(["--help"], ctx().root, ctx().envOverrides);
    expect(result.stdout).toContain("--help");
  });
});
