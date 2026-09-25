/**
 * KB 文档里写的 `collab …` 命令，必须与 `--help` 一致。
 *
 * @remarks
 * 起因：2026-09-26 一天里抓到**五个**「照文档抄就报错」，形状全是
 * 「同一份事实写在两个载体里，只有一边被改」。前四个修的是载体本身
 * （模板 ↔ 模板 / 模板 ↔ 工具）；**这一个把文档 ↔ CLI 也变成检查** ——
 * 用户拍板：*KB 的文档错，就该红 CI*。
 *
 * 断言的是**成员关系**（选项存在、且用在对的子命令上），不是某段文案 ——
 * 所以重排文档、改措辞不会假红；而把 `--reason` 写漏、把 `--confirm`
 * 挪到别的命令上，会。
 *
 * 不扫 `inbox/`：它是增量补丁的档案，不是活文档。
 */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import { extractUsage, parseCliHelp } from "../lib/cli-help.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI_ENTRY = path.join(REPO_ROOT, "dist/cli/index.js");

/** 与 `src/mcp/__tests__/tools.test.ts` 同一约定。 */
const REAL_COLLAB_DIR =
    process.env["COLLAB_REAL_KB"] ??
    "D:\\actto\\front\\project\\collaboration_aggregate\\collaboration";

const SKIP_DIRS = new Set(["inbox", "node_modules", ".git", ".obsidian", "_archive"]);

async function markdownFiles(dir: string, found: string[] = []): Promise<string[]> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await markdownFiles(abs, found);
            continue;
        }
        if (entry.isFile() && entry.name.endsWith(".md")) found.push(abs);
    }
    return found;
}

describe.skipIf(!existsSync(REAL_COLLAB_DIR))("KB 文档里的 collab 命令 — 真库", () => {
    it("每个选项都是 --help 承认的，且用在对的子命令上", async () => {
        const helpResult = await execa("node", [CLI_ENTRY, "--help"], { reject: false });
        const { commands, flags } = parseCliHelp(helpResult.stdout);

        // 防"解析器坏了却报绿"：真 help 至少该认出五六个子命令与十几个选项。
        expect(commands.size, "--help 解析出的子命令太少，解析器可能坏了").toBeGreaterThan(5);
        expect(flags.size, "--help 解析出的选项太少，解析器可能坏了").toBeGreaterThan(10);

        const violations: string[] = [];

        for (const file of await markdownFiles(REAL_COLLAB_DIR)) {
            const rel = path.relative(REAL_COLLAB_DIR, file).replace(/\\/g, "/");
            const lines = (await readFile(file, "utf8")).split(/\r?\n/);
            lines.forEach((line, idx) => {
                const usage = extractUsage(line, commands);
                if (usage === null) return;
                for (const flag of usage.flags) {
                    const allowed = flags.get(flag);
                    if (allowed === undefined) {
                        violations.push(`${rel}:${idx + 1}  ${usage.sub} 用了 --help 里没有的选项 ${flag}`);
                        continue;
                    }
                    if (allowed !== null && !allowed.has(usage.sub)) {
                        violations.push(
                            `${rel}:${idx + 1}  ${flag} 不属于 ${usage.sub}（它只属于 ${[...allowed].join(" / ")}）`,
                        );
                    }
                }
            });
        }

        expect(violations, `\n${violations.join("\n")}\n`).toEqual([]);
    }, 60_000);
});
