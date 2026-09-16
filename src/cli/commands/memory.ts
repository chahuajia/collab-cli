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

const DATE_PATTERN = /(?:\*\*)?更新(?:\*\*)?[：:]\s*(\d{4})-(\d{2})-(\d{2})/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface StaleFile {
  readonly relPath: string;
  readonly reason: string;
}

/**
 * `collab memory [--max-age <days>]`
 *
 * 检查**工作记忆**里"声称当前状态"的文件是否过期。
 *
 * @remarks
 * 为什么需要它：working-memory 是全库**唯一**满足这三个条件的地方 ——
 * **AI 写、AI 读并相信、没有任何东西检查**。
 * 知识库有 `validate`，生成物有 `CATALOG_STALE`，目录有 `UNDECLARED_DIR`，
 * 而它什么都没有 —— 于是它最先腐烂（实测：`anchors.md` 停在三天前、
 * `README` 任务表过期、一句 `0 issues` 是假的）。
 *
 * **判据**：只查"当前状态类"文件（`progress.md` / `anchors.md` / `README.md`）。
 * 日志类的不用查 —— 旧不等于错。
 *
 * 退出码：0 = 都新鲜；1 = 有过期或查不到日期的。
 */
export async function cmdMemory(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { "max-age": { type: "string" } },
    strict: false,
  });

  const maxAge = readMaxAge(values["max-age"]);
  const root = findWorkingMemory(process.cwd());
  if (root === null) {
    console.error("✖ working-memory/ not found (searched upwards from cwd)");
    process.exit(1);
  }

  const stale: StaleFile[] = [];
  let checked = 0;

  for (const abs of walk(root)) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (!CURRENT_STATE_FILES.includes(path.basename(abs))) continue;
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
    console.log(`✔ working-memory: ${checked} current-state file(s), all fresh (≤ ${maxAge} days)`);
    return;
  }

  console.error(`✖ working-memory: ${stale.length} of ${checked} file(s) need attention`);
  for (const { relPath, reason } of stale) {
    console.error(`  ${relPath} — ${reason}`);
  }
  console.error("");
  console.error("  修法：更新它，或把它降级成归档（`_archive/` 下的快照不受此检查）。");
  process.exit(1);
}

function readMaxAge(raw: unknown): number {
  if (typeof raw !== "string" || raw.length === 0) return DEFAULT_MAX_AGE_DAYS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_AGE_DAYS;
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
