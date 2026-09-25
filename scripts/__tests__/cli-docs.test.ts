/**
 * **本仓活文档**里写的 `collab …` 命令，必须与 `--help` 一致。
 *
 * @remarks
 * 与 `kb-command-docs.test.ts` 同源，但对象不同：那条管 KB（另一个仓），
 * 这条管**本仓**（`README.md` / `AGENTS.md` / `RELEASE.md` / `scripts/README.md`）。
 *
 * 起因（2026-09-26）：本仓 `README.md` 的 `retire` 一行漏了 `--confirm` ——
 * 而 `--enforced` **必须**同时给 `--confirm`（见 `src/cli/commands/retire.ts`）。
 * 那行字**随 npm 包发布**，用户照抄就报错，属于本仓反复在修的
 * "承诺 vs 现实"。所以除了"选项存在且用对命令"，这里多查一条：
 * **成对出现的选项，不能只写一半**（`REQUIRED_PAIRS`）。
 *
 * **它不查什么**（写清楚，免得"CI 绿"被读成"文档对"）：
 * - 命令的**顺序与示例能否真跑通**（有些命令会改状态，要临时库）；
 * - 散文里对命令语义的描述是否准确；
 * - 历史记录（`working-memory/`、`scripts/one-off/`）—— 那是"当时写过什么"，
 *   追着改等于篡改历史，故不在扫描范围内。
 *
 * **约定：引用未实现的命令必须标注**（`尚未实现` / `未实现` / `计划` / `草案` / `TODO`），
 * 标注了就豁免 —— 写清楚"它还没有"本身就是诚实的表达。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import { extractUsage, parseCliHelp, type Usage } from "../lib/cli-help.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI_ENTRY = path.join(REPO_ROOT, "dist/cli/index.js");

/** 只扫**活文档**：入口、发布说明、脚本说明。 */
const LIVE_DOCS = ["README.md", "AGENTS.md", "RELEASE.md", "scripts/README.md"];

/** 「这条还没实现」的标注词。 */
const MARKER = /(尚未实现|未实现|不存在|计划|草案|planned|TODO)/;

/**
 * 成对出现的选项：写了一半就是"照文档抄会报错"。
 *
 * @remarks
 * 真相在 CLI 实现里（`retire.ts` 的 `assertEnforcedTargetExists` 之前那段校验），
 * 这里只是把它写成**可检查的断言**。改了实现就要改这里 —— 这是有意的摩擦：
 * 另一条路是让文档悄悄漂走，那更贵。
 */
const REQUIRED_PAIRS: readonly { readonly when: string; readonly also: string; readonly sub: string }[] = [
  { when: "--enforced", also: "--confirm", sub: "retire" },
];

/** 一行里所有 `collab …` 用法（本仓文档常一行写多个命令）。 */
function usagesOf(line: string, commands: ReadonlySet<string>): Usage[] {
  const usages: Usage[] = [];
  for (const span of line.split("`")) {
    const usage = extractUsage(span, commands);
    if (usage !== null) usages.push(usage);
  }
  const whole = extractUsage(line, commands);
  if (whole !== null && usages.length === 0) usages.push(whole);
  return usages;
}

/** 成对规则的违规文案（空数组 = 通过）。 */
function pairViolations(at: string, usage: Usage): string[] {
  const out: string[] = [];
  for (const pair of REQUIRED_PAIRS) {
    if (usage.sub !== pair.sub) continue;
    if (!usage.flags.includes(pair.when)) continue;
    if (usage.flags.includes(pair.also)) continue;
    out.push(`${at}  ${usage.sub} 写了 ${pair.when} 却没写 ${pair.also}（必填成对，照抄会报错）`);
  }
  return out;
}

describe("本仓文档里的 collab 命令 — 与 --help 对齐", () => {
  it("每个选项都是 --help 承认的、用在对的子命令上，且成对选项没写一半", async () => {
    const helpResult = await execa("node", [CLI_ENTRY, "--help"], { reject: false });
    const { commands, flags } = parseCliHelp(helpResult.stdout);

    // 防"解析器坏了却报绿"
    expect(commands.size, "--help 解析出的子命令太少，解析器可能坏了").toBeGreaterThan(5);
    expect(flags.size, "--help 解析出的选项太少，解析器可能坏了").toBeGreaterThan(10);
    expect([...(flags.get("--reason") ?? [])]).toEqual(["retire"]);

    const violations: string[] = [];

    for (const rel of LIVE_DOCS) {
      const lines = (await readFile(path.join(REPO_ROOT, rel), "utf8")).split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (MARKER.test(line)) return;
        for (const usage of usagesOf(line, commands)) {
          const at = `${rel}:${idx + 1}`;
          if (!usage.known) {
            violations.push(`${at}  未知子命令 ${usage.sub} —— --help 里没有这一条`);
            continue;
          }
          for (const flag of usage.flags) {
            const allowed = flags.get(flag);
            if (allowed === undefined) {
              violations.push(`${at}  ${usage.sub} 用了 --help 里没有的选项 ${flag}`);
              continue;
            }
            if (allowed !== null && !allowed.has(usage.sub)) {
              violations.push(
                `${at}  ${flag} 不属于 ${usage.sub}（它只属于 ${[...allowed].join(" / ")}）`,
              );
            }
          }
          violations.push(...pairViolations(at, usage));
        }
      });
    }

    expect(violations, `\n${violations.join("\n")}\n`).toEqual([]);
  }, 60_000);

  it("守卫：成对规则真的会抓 —— 用 README 那行**旧写法**复现", () => {
    // 这就是 2026-09-26 之前 README 里的原文（`--confirm` 漏了，而它是必填的）
    const oldRow =
      '| `collab retire <id> --dormant|--enforced <path> --reason "<分类>: <证据>" [--dry-run]` | 让条目退出路由索引 |';
    const usage = extractUsage(oldRow, new Set(["retire"]));
    expect(usage?.sub).toBe("retire");
    expect(usage?.flags).toContain("--enforced");
    expect(pairViolations("README.md:1", usage ?? { sub: "", known: false, flags: [] })).toHaveLength(1);
  });
});
