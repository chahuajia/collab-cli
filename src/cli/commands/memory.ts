import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

/** 默认新鲜期（天）。 */
const DEFAULT_MAX_AGE_DAYS = 7;

/**
 * 声称"当前状态"的文件 —— 只有它们需要新鲜。
 *
 * @remarks
 * `decisions.md` / `parking-lot.md` / `spec.md` **不在列表里**：
 * 它们是追加式日志，越旧越正常（一个三天前写的决策仍然是那个决策）。
 */
const CURRENT_STATE_FILES = ["progress.md", "anchors.md", "README.md"];

/**
 * **候选池**：有入口没出口的那种文件。
 *
 * @remarks
 * `interceptions-candidates.md` 的约定是「L2 撞墙先记候选 → **W4 通过后 harvest**」。
 * 前半句有动作，后半句**没有任何东西触发** —— 于是候选一直挂着，
 * 而"加了候选"看起来像在推进。
 *
 * 实测（2026-09-19）：连着几轮往候选池加行，**一次 W4 都没跑过**。
 * 这与 `pruning-policy` 的「引用计数从未测量」、代谢配额的「从未执行」是同一个病：
 * **没有仪器的地方，什么都没有执行过。**
 *
 * 所以这里给它装一根线：候选龄期超阈值 → 报。
 */
const CANDIDATE_FILES = ["interceptions-candidates.md"];

const DATE_PATTERN = /(?:\*\*)?更新(?:\*\*)?[：:]\s*(\d{4})-(\d{2})-(\d{2})/;

/** 表格行：`| 2026-09-19 | 条目 | … | … | 状态 |` */
const CANDIDATE_ROW = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|([^|]*)\|(.*)\|\s*([^|]*?)\s*\|\s*$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface StaleFile {
  readonly relPath: string;
  readonly reason: string;
}

/**
 * `collab memory [--max-age <days>]`
 *
 * 检查**工作记忆**里两类会腐烂的东西：
 *
 * 1. **声称当前状态的文件**（`progress.md` / `anchors.md` / `README.md`）
 * 2. **候选池**（`interceptions-candidates.md`）—— 记了却没走完流程的行
 *
 * @remarks
 * 为什么需要它：working-memory 是全库**唯一**满足这三个条件的地方 ——
 * **AI 写、AI 读并相信、没有任何东西检查**。
 * 知识库有 `validate`，生成物有 `CATALOG_STALE`，目录有 `UNDECLARED_DIR`，
 * 而它什么都没有 —— 于是它最先腐烂（实测：`anchors.md` 停在三天前、
 * `README` 任务表过期、一句 `0 issues` 是假的）。
 *
 * **判据**：文件类只查"当前状态类"（日志类旧不等于错）；
 * 候选池只查**未 harvest** 且**龄期超阈**的行（已 harvest 的是正常历史）。
 *
 * 退出码：0 = 都新鲜；1 = 有过期、查不到日期、或有挂太久的候选。
 */
export async function cmdMemory(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      "max-age": { type: "string" },
      "max-candidate-age": { type: "string" },
    },
    strict: false,
  });

  const maxAge = readMaxAge(values["max-age"], DEFAULT_MAX_AGE_DAYS);
  const maxCandidateAge = readMaxAge(
    values["max-candidate-age"],
    DEFAULT_MAX_CANDIDATE_AGE_DAYS,
  );

  const root = findWorkingMemory(process.cwd());
  if (root === null) {
    // 说清"为什么找不到"而不是只报找不到：**知识库仓本来就没有工作记忆**
    // （工作记忆属于主体仓，见 KB 的 W10）。2026-09-26 最小可用性排查：
    // 在 kb 骨架里跑 `collab memory` 只得到一句 "not found"，读起来像故障。
    console.error(
      "✖ working-memory/ not found (searched upwards from cwd).\n" +
        "  注意：**知识库仓没有工作记忆** —— 进度与决策属于主体仓的 working-memory/\n" +
        "  （本命令要在**项目仓**里跑，不是在 KB 仓里跑）。",
    );
    process.exit(1);
  }

  const stale: StaleFile[] = [];
  let checked = 0;

  for (const abs of walk(root)) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    const base = path.basename(abs);

    if (CANDIDATE_FILES.includes(base)) {
      checked++;
      stale.push(...checkCandidates(abs, rel, maxCandidateAge));
      continue;
    }

    if (!CURRENT_STATE_FILES.includes(base)) continue;

    // **`README.md` 只查 working-memory 根那一份。**
    //
    // 嵌套的 README（`agents/fe/README.md`、`tasks/x/contracts/README.md`）
    // 是**结构文档**，不声称当前状态 —— 旧不等于错。
    // 把它们一起查会稳定产出假阳性，而**假阳性会让整个仪器被无视**
    // （"多报 → 没人看"，见 reachability 的同款教训）。
    if (base === "README.md" && rel.includes("/")) continue;

    checked++;

    const content = fs.readFileSync(abs, "utf8");
    const match = DATE_PATTERN.exec(content);
    if (match === null) {
      stale.push({ relPath: rel, reason: "no `更新：YYYY-MM-DD` line — cannot be checked" });
      continue;
    }

    const age = ageInDays(`${match[1]}-${match[2]}-${match[3]}`);
    if (age > maxAge) {
      stale.push({ relPath: rel, reason: `last updated ${age} days ago (> ${maxAge})` });
    }
  }

  if (stale.length === 0) {
    console.log(
      `✔ working-memory: ${checked} file(s) fresh ` +
        `(state ≤ ${maxAge}d · candidates ≤ ${maxCandidateAge}d)`,
    );
    return;
  }

  console.error(`✖ working-memory: ${stale.length} of ${checked} file(s) need attention`);
  for (const { relPath, reason } of stale) {
    console.error(`  ${relPath} — ${reason}`);
  }
  console.error("");
  console.error("  修法：");
  console.error("    - 状态文件：更新它，或降级成归档（`_archive/` 下的快照不受此检查）");
  console.error("    - 候选池：**跑 W4** 决定 harvest 还是丢弃 —— 候选挂着不是推进");
  process.exit(1);
}

/** 候选池默认龄期 —— 比状态文件宽（W4 是批次动作，不是每日动作）。 */
const DEFAULT_MAX_CANDIDATE_AGE_DAYS = 14;

/**
 * 找出**未 harvest 且龄期超阈**的候选行。
 *
 * @remarks
 * 判据是「状态列有没有说 harvested」＋「行上那个日期有多旧」。
 * 行日期用的是**当时记候选的日期** —— 所以龄期 = 「这条候选挂了多久没走完流程」，
 * 正是要测的东西。
 */
function checkCandidates(abs: string, rel: string, maxAge: number): StaleFile[] {
  const out: StaleFile[] = [];
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const m = CANDIDATE_ROW.exec(line);
    if (m === null) continue;
    const date = m[1];
    const entry = (m[2] ?? "").trim();
    const status = (m[4] ?? "").trim();
    if (date === undefined) continue;

    if (status.toLowerCase().includes("harvested")) continue;

    const age = ageInDays(date);
    if (age > maxAge) {
      const label = status.length > 0 ? status : "(空)";
      // **点名哪一条** —— 只说"有 N 条过期"和"根本没查"长得一样。
      out.push({
        relPath: rel,
        reason: `${entry} — 挂了 ${age} 天未 harvest（> ${maxAge}d）· 状态「${label}」`,
      });
    }
  }

  return out;
}

function readMaxAge(raw: unknown, fallback: number): number {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** 向上找 `working-memory/`（特征发现，不用固定层级）。 */
function findWorkingMemory(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, "working-memory");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "_archive") continue; // 快照不受新鲜度约束
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function ageInDays(isoDate: string): number {
  const then = new Date(`${isoDate}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.floor((now - then) / MS_PER_DAY);
}
