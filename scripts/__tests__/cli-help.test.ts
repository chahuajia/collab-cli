import { describe, expect, it } from "vitest";
import { extractUsage, parseCliHelp } from "../lib/cli-help.js";

/**
 * 用**一份小样本**锁住解析规则。
 *
 * @remarks
 * 样本刻意保留了真实 help 里三种难处理的形态：
 * 多行描述（续行）、`--with-ci / --with-hook`（一个描述两个选项）、
 * `-m, --message`（长短名并列）。真 help 的形状变了不该让解析器悄悄失效 ——
 * E2E 那条测试会用真 help，但**这里要能先红**。
 */
const HELP = [
    "collab — CLI for the COLLABORATION protocol",
    "",
    "Usage:",
    "  collab [--dir <path>] <command> [options]",
    "",
    "Commands:",
    "  init [--profile consumer|kb] Scaffold a minimal workspace",
    "  retire <id>                  Retire an entry from the routing index (not deleted).",
    "                               --candidates lists islands (report only, never writes)",
    "  validate                     Validate the entire workspace",
    "  mcp                          Run as an MCP server on stdio",
    "  commit -m \"<message>\"        Validate + git add + git commit",
    "",
    "Global options:",
    "  --dir <path>                 COLLABORATION workspace (also: COLLAB_DIR env)",
    "",
    "Command options (only where listed):",
    "  --reason \"<分类>: <证据>\"     retire — 必填；判据见 meta/pruning-policy",
    "  --enforced <path>            retire — 退役路径：已毕业",
    "  --with-ci / --with-hook      init — 生成 CI / husky 接线",
    "  -m, --message <message>      commit — commit message",
    "",
    "Other:",
    "  --help, -h                   Show this help",
    "",
].join("\n");

describe("parseCliHelp", () => {
    const help = parseCliHelp(HELP);

    it("认出子命令，且不被续行干扰", () => {
        expect([...help.commands].sort()).toEqual([
            "commit",
            "init",
            "mcp",
            "retire",
            "validate",
        ]);
    });

    it("选项归属到正确的子命令", () => {
        expect([...(help.flags.get("--reason") ?? [])]).toEqual(["retire"]);
        expect([...(help.flags.get("--enforced") ?? [])]).toEqual(["retire"]);
    });

    it("一个描述里的多个选项都要登记（--with-ci / --with-hook）", () => {
        expect([...(help.flags.get("--with-ci") ?? [])]).toEqual(["init"]);
        expect([...(help.flags.get("--with-hook") ?? [])]).toEqual(["init"]);
    });

    it("长短名并列时短名也要登记（-m, --message）", () => {
        expect([...(help.flags.get("-m") ?? [])]).toEqual(["commit"]);
        expect([...(help.flags.get("--message") ?? [])]).toEqual(["commit"]);
    });

    it("全局与 Other 段的选项不限子命令（null）", () => {
        expect(help.flags.get("--dir")).toBeNull();
        expect(help.flags.get("--help")).toBeNull();
        expect(help.flags.get("-h")).toBeNull();
    });
});

describe("extractUsage", () => {
    const commands = parseCliHelp(HELP).commands;

    it("全局选项在前的形态", () => {
        expect(extractUsage("collab --dir <KB> validate", commands)).toEqual({
            sub: "validate",
            flags: ["--dir"],
        });
    });

    it("变量代替可执行名，且选项一堆", () => {
        const line =
            'node $COLLAB --dir $KB retire <id> --enforced <测试路径> --reason "<分类>: <证据>" --confirm';
        expect(extractUsage(line, commands)).toEqual({
            sub: "retire",
            flags: ["--dir", "--enforced", "--reason", "--confirm"],
        });
    });

    it("codex mcp add 那一行：子命令是 mcp，不是被当成参数的 collab", () => {
        const line =
            "codex mcp add collab -- node <repo>/bin/collab.js mcp --dir <KB>";
        expect(extractUsage(line, commands)).toEqual({
            sub: "mcp",
            flags: ["--dir"],
        });
    });

    it("赋值行不是调用", () => {
        expect(extractUsage("COLLAB=<collab-cli>/dist/cli/index.js", commands)).toBeNull();
    });

    it("占位子命令（collab <cmd> --help）不算用法", () => {
        expect(extractUsage("`collab <cmd> --help`", commands)).toBeNull();
    });

    it("只是提到这个词不算", () => {
        expect(extractUsage("工具：validate / catalog / retire / memory / mcp", commands)).toBeNull();
    });
});
