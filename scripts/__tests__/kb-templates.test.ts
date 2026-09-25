/**
 * KB `templates/` 的不变量：**抄出来就该过 validate**。
 *
 * @remarks
 * 为什么要有这条：2026-09-26 实测，五个条目模板里有**三个**抄进新库就报错 ——
 *
 * | 缺陷 | 症状 |
 * | :--- | :--- |
 * | 19 处**裸链接**（指向参考库的真实条目） | `DEAD_LINK` ×3（新库里那些条目不存在） |
 * | `adr-template` 缺 `created` / `updated` | `INVALID_SHAPE` ×2 |
 * | `pattern-template` / `adr-template` 缺 `aliases` | `ID_NOT_IN_ALIASES` |
 *
 * 三者同一个形状：**模板是"为参考库写的"，不是"给新库用的"**。
 * 这正是本仓与 KB 都在防的"承诺 vs 现实"——文档说照它抄，抄了就红。
 *
 * 断言的是**不变量**（抄出来能过 validate），不是模板的字节 ——
 * 字节会随文案调整而变，不变量不会。
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI_ENTRY = path.join(REPO_ROOT, "dist/cli/index.js");

/** 与 `src/mcp/__tests__/tools.test.ts` 同一约定：可用环境变量覆盖，缺省用本机布局。 */
const REAL_COLLAB_DIR =
  process.env["COLLAB_REAL_KB"] ??
  "D:\\actto\\front\\project\\collaboration_aggregate\\collaboration";

interface TemplateCase {
  readonly template: string;
  readonly target: string;
  /** 占位符 → 真实值（模拟"人照着模板填"）。 */
  readonly substitutions: readonly (readonly [string, string])[];
}

const COMMON: readonly (readonly [string, string])[] = [
  ["<git user.name>", "heiniao"],
  ["YYYY-MM-DD", "2026-09-26"],
];

/** 五种 kind 的模板 ↔ 目标路径 ↔ 占位符。`integration` 目前没有模板（见 KB 的 templates/README）。 */
const CASES: readonly TemplateCase[] = [
  {
    template: "agreement-template.md",
    target: "agreements/A99.md",
    substitutions: [
      ["A<n>", "A99"],
      ["<标题>", "测试约定"],
      ["<这条约定来自哪次真实事故/需求——禁止留空>", "2026-09-26 实测"],
    ],
  },
  {
    template: "skill-template.md",
    target: "skills/S99.md",
    substitutions: [
      ["S<n>", "S99"],
      ["<标题>", "测试技能"],
      ["<这条技能来自哪次真实事故/需求——禁止留空>", "2026-09-26 实测"],
    ],
  },
  {
    template: "workflow-template.md",
    target: "workflows/W99.md",
    substitutions: [
      ["W<n>", "W99"],
      ["<标题>", "测试工作流"],
      ["<这条工作流来自哪次真实任务，禁止留空>", "2026-09-26 实测"],
    ],
  },
  {
    template: "pattern-template.md",
    target: "patterns/tpl-test.md",
    substitutions: [
      ["<kebab-name>", "tpl-test"],
      ["# 标题", "# 测试模式"],
      ["<领域>", "测试"],
    ],
  },
  {
    template: "adr-template.md",
    target: "meta/decision-records/ADR-0099.md",
    substitutions: [
      ["ADR-<4 位数字>", "ADR-0099"],
      ["<决策标题>", "测试决策"],
    ],
  },
  {
    template: "integration-template.md",
    target: "integrations/intg-test.md",
    substitutions: [
      ["<kebab-name>", "intg-test"],
      ["# <标题>", "# 测试集成"],
      ["<这份手册来自哪次真实需求——禁止留空>", "2026-09-26 实测"],
    ],
  },
];

function run(args: readonly string[], cwd: string) {
  return execa("node", [CLI_ENTRY, ...args], { cwd, reject: false });
}

describe.skipIf(
  !existsSync(path.join(REAL_COLLAB_DIR, "templates", "agreement-template.md")),
)("KB templates — 真库", () => {
  it("六个条目模板抄进新库后，validate 必须 0 errors", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "kb-templates-"));
    try {
      const kb = path.join(root, "kb");
      const init = await run(["init", "--profile", "kb", "--dir", kb], root);
      expect(init.exitCode, init.stderr).toBe(0);

      for (const c of CASES) {
        const raw = await readFile(
          path.join(REAL_COLLAB_DIR, "templates", c.template),
          "utf8",
        );
        let filled = raw;
        for (const [from, to] of [...COMMON, ...c.substitutions]) {
          filled = filled.split(from).join(to);
        }
        const abs = path.join(kb, c.target);
        await writeFile(abs, filled, "utf8");
      }

      expect((await run(["--dir", kb, "index"], root)).exitCode).toBe(0);
      expect((await run(["--dir", kb, "catalog"], root)).exitCode).toBe(0);

      const validated = await run(["--dir", kb, "validate"], root);
      expect(
        validated.exitCode,
        `照 KB 模板抄出来的条目没通过 validate：\n${validated.stdout}\n${validated.stderr}`,
      ).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
