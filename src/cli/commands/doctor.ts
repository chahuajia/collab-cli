import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { ValidateUseCase, standardRules } from "@/application/ValidateUseCase";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";
import { findCollabRoot } from "@/infrastructure/fs/findCollabRoot";

/**
 * `collab doctor [--json]`
 *
 * 一条命令回答：**这套接线还活着吗？**（2026-10-06 新增）
 *
 * @remarks
 * 起因（实测，2026-10-06）：某新项目的 agent 通读了入口，整段会话 `collab` 用了 **0 次** ——
 * 判据全写进 `working-memory/`（下一个人读不到），`catalog.json` 停在几行。
 * 根因不是"文件缺失"，是**入口没点名工具**：不知道有工具，等于这条规范不存在。
 *
 * 所以 doctor 检查的**不是内容对错，而是"接线还在不在"**：
 *
 * | # | 检查 | 通不过时的动作 |
 * | :--- | :--- | :--- |
 * | 1 | 能不能定位知识库（`--dir` / `COLLAB_DIR` / 向上找 `.git`） | 给 `--dir` |
 * | 2 | 知识库校验过不过（`validate`） | 看它报的 Issue |
 * | 3 | 生成物新不新（`CATALOG_STALE` / `MISSING_FROM_INDEX`） | 直接给命令 |
 * | 4 | **入口点名工具了吗**（`AGENTS.md` 里有没有 `collab <cmd>`） | 给出该补的那几行 |
 * | 5 | 有没有 `.git`（`commit` 的门） | `git init`，或只用只读命令 |
 *
 * **两个根要分开**（2026-10-06 实测的坑）：**知识库**是校验对象（`--dir` / `COLLAB_DIR` / 向上找），
 * 而**入口与 git 属于"你人在的那个仓"**（cwd）。第一版把 git 检查错用了知识库的根 ——
 * 于是"在一个没 git 的项目里跑"会报"是 git 仓"（因为它看的是 KB）✗。
 *
 * 退出码：有 ✖ → `1`；只有 ⚠ → `0`（warning 是"该修但不阻断"）。
 * 这是刻意的：**接错线的门禁比不装门禁更坏**；但它也不该把正常流程卡死。
 */

/** 入口里"点名工具"的判据：包名，或 `collab <子命令>` 之一。 */
const MENTIONS_CLI =
  /@chahuajia\/collab-cli|\bcollab\s+(validate|catalog|new|index|commit|push|retire|memory|parse|apply|mcp|doctor)\b/;

/** `--json` 的缩进宽度（与其它命令的 JSON 输出保持一致）。 */
const JSON_INDENT = 2;

interface Check {
  readonly level: "ok" | "warn" | "fail";
  readonly name: string;
  readonly detail: string;
  /** 通不过时的下一步（一句可执行的） */
  readonly next?: string;
}

export async function cmdDoctor(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { json: { type: "boolean", default: false } },
    strict: false,
  });

  const checks: Check[] = [];
  const cwd = process.cwd();

  // 1. 定位工作区
  let collabDir: string;
  let gitRoot: string;
  try {
    const root = findCollabRoot(cwd);
    collabDir = root.collabDir;
    gitRoot = root.gitRoot;
    checks.push({ level: "ok", name: "工作区", detail: collabDir });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    checks.push({
      level: "fail",
      name: "工作区",
      detail: msg.split("\n")[0] ?? msg,
      next: "用 `collab --dir <知识库根> doctor` 指定；或设 COLLAB_DIR",
    });
    report(checks, values.json === true);
    process.exit(1);
  }

  // 2 + 3. 校验（生成物新鲜度那两条就藏在 validate 的 Issue 里）
  const { entries, report: validation } = new ValidateUseCase(
    new FileWorkspaceLoader(collabDir),
    standardRules,
  ).execute();
  const errors = validation.errors();
  const warnings = validation.warnings();

  if (errors.length === 0) {
    checks.push({
      level: "ok",
      name: "知识库校验",
      detail: `${entries.length} entries, ${warnings.length} warnings`,
    });
  } else {
    const codes = [...new Set(errors.map((i) => i.code))].join(", ");
    checks.push({
      level: "fail",
      name: "知识库校验",
      detail: `${errors.length} errors（${codes}）`,
      next: "`collab validate` 看逐条",
    });
  }

  const errorCodes = new Set<string>(errors.map((issue) => issue.code));
  if (errorCodes.has(IssueCodeValues.CatalogStale)) {
    checks.push({
      level: "fail",
      name: "生成物",
      detail: "`catalog.json` 陈旧 —— 它是仪器，陈旧 = 没接线",
      next: "`collab catalog`",
    });
  }
  if (errorCodes.has(IssueCodeValues.MissingFromIndex)) {
    checks.push({
      level: "fail",
      name: "生成物",
      detail: "`_index.md` 缺条目",
      next: "`collab index`",
    });
  }

  // 本仓（= 你人在的那个仓）：入口与 git 都看它，**不看知识库**
  const projectRoot = findGitRoot(cwd);
  if (projectRoot !== null && projectRoot !== gitRoot) {
    checks.push({ level: "ok", name: "本仓", detail: projectRoot });
  }

  // 4. 入口点名工具了吗
  const agentsPath = findAgentsMd(cwd, projectRoot);
  if (agentsPath === null) {
    checks.push({
      level: "warn",
      name: "入口",
      detail: "没找到 `AGENTS.md`",
      next: "`collab init --profile consumer --kb <知识库>` 生成骨架",
    });
  } else if (MENTIONS_CLI.test(fs.readFileSync(agentsPath, "utf8"))) {
    // 路径相对 **cwd**（入口属于"你人在哪个项目"），不是相对知识库
    checks.push({ level: "ok", name: "入口", detail: `${rel(cwd, agentsPath)} 点名了工具` });
  } else {
    checks.push({
      level: "warn",
      name: "入口",
      detail:
        `${rel(cwd, agentsPath)} **没有提到 collab 命令** —— ` +
        "不知道有工具，等于这条规范不存在",
      next: "在入口补一行：`npx --yes @chahuajia/collab-cli --dir <知识库> validate`（见 KB 的 A13）",
    });
  }

  // 5. git 在不在（commit 的门；没有它 commit / push 都不可用）
  if (projectRoot !== null) {
    checks.push({ level: "ok", name: "git", detail: "是 git 仓（commit 可用）" });
  } else {
    checks.push({
      level: "warn",
      name: "git",
      detail: "不是 git 仓 → `commit` / `push` 不可用（只能读与校验）",
      next: "`git init`（然后 commit 才有意义）",
    });
  }

  report(checks, values.json === true);
  if (checks.some((c) => c.level === "fail")) process.exit(1);
}

/** 打印结果：人看清单，机器看 JSON。 */
function report(checks: readonly Check[], asJson: boolean): void {
  if (asJson) {
    process.stdout.write(JSON.stringify({ checks }, null, JSON_INDENT) + "\n");
    return;
  }
  const mark = { ok: "✔", warn: "⚠", fail: "✖" } as const;
  for (const c of checks) {
    console.log(`${mark[c.level]} ${c.name}：${c.detail}`);
    if (c.next !== undefined && c.level !== "ok") console.log(`    → ${c.next}`);
  }
  const bad = checks.filter((c) => c.level !== "ok").length;
  console.log("");
  console.log(bad === 0 ? "ok 接线都在。" : `${bad} 处需要处理（见上面的 →）。`);
}

/**
 * 找入口文件：从 `cwd` 向上找到 `gitRoot` 为止。
 *
 * @remarks
 * 找不到就返回 `null` —— 由调用方决定"没有入口"算 warning 还是 error。
 */
function findAgentsMd(cwd: string, projectRoot: string | null): string | null {
  let dir = path.resolve(cwd);
  // 有本仓 → 只在本仓内找；没有 git 仓 → 只看 cwd（项目根通常就在这）
  const stop = projectRoot === null ? dir : path.resolve(projectRoot);
  for (;;) {
    const candidate = path.join(dir, "AGENTS.md");
    if (fs.existsSync(candidate)) return candidate;
    if (dir === stop) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * 从 `cwd` 向上找 `.git`（**本仓**，与知识库无关）。
 *
 * @remarks
 * 刻意不复用 `findCollabRoot().gitRoot` —— 那个会先被 `COLLAB_DIR` 接管，
 * 于是"在别的项目里跑 doctor"会拿知识库的根去判 git ✗。
 */
function findGitRoot(cwd: string): string | null {
  let dir = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function rel(from: string, to: string): string {
  const r = path.relative(from, to);
  return r === "" ? "." : r;
}
