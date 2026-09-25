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
 * **它不查什么**（写清楚，免得「CI 绿」被读成「文档对」）：
 *
 * - 命令的**顺序与组合**是否合理（如 `--confirm` 该不该配 `--enforced`）；
 * - 占位符是否恰当（`<KB>` 还是 `<路径>`）；
 * - 示例**能不能真的跑通** —— 有些命令会改状态（`retire`），要临时库，
 *   那是另一条检查，见 `kb-templates.test.ts` 的同类做法；
 * - 散文里对命令**语义**的描述是否准确（「毕业会自动删条目」这类话抓不到）。
 *
 * 一句话：它证明的是「文档与 `--help` **不矛盾**」，不是「文档正确」。
 *
 * **约定：引用未实现的命令必须标注。** 同一行里出现
 * `尚未实现` / `未实现` / `计划` / `草案` / `planned` / `TODO` 时，本检查不追究该行 ——
 * 因为"写清楚它还没有"本身就是诚实的表达，KB 里已有三处这么写。
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

/** 「这条还没实现」的标注词。 */
const MARKER = /(尚未实现|未实现|不存在|计划|草案|planned|TODO)/;

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
        // 定点抽查：解析器若把 `--reason` 归错命令，下面这条会先红，而不是等到文档假绿。
        expect([...(flags.get("--reason") ?? [])]).toEqual(["retire"]);

        const violations: string[] = [];

        for (const file of await markdownFiles(REAL_COLLAB_DIR)) {
            const rel = path.relative(REAL_COLLAB_DIR, file).replace(/\\/g, "/");
            const lines = (await readFile(file, "utf8")).split(/\r?\n/);

            // **块级豁免**：被围栏包住、且块内任意一行写了标注的，
            // 整块都不追究 —— 文档的惯例就是在块首写一句「以下为设计草案（未实现）」，
            // 只认行会把这种诚实表达判成缺陷。
            const exempt = new Set<number>();
            let fenceStart = -1;
            lines.forEach((line, i) => {
                if (!/^\s*```/.test(line)) return;
                if (fenceStart < 0) {
                    fenceStart = i;
                    return;
                }
                // 也看**块前 3 行**：文档的常见写法是先写一句
                // 「以下为设计草案（未实现）」再给块（S10 就是），只扫块内会漏。
                const from = Math.max(0, fenceStart - 5);
                if (MARKER.test(lines.slice(from, i + 1).join("\n"))) {
                    for (let k = fenceStart; k <= i; k += 1) exempt.add(k);
                }
                fenceStart = -1;
            });

            lines.forEach((line, idx) => {
                const usage = extractUsage(line, commands);
                if (usage === null) return;
                // 未实现的命令：同行标注、或所在围栏块标注过，就不算缺陷。
                if (MARKER.test(line) || exempt.has(idx)) return;
                // 子命令打错也曾被静默跳过（2026-09-26 实测 `collab retiree --candidates` → null）。
                if (!usage.known) {
                    violations.push(
                        `${rel}:${idx + 1}  未知子命令 ${usage.sub} —— --help 里没有这一条`,
                    );
                    return;
                }
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
