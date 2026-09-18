// 工作记忆新鲜度自检 —— 让"过期"变成可判定的，而不是靠自觉。
//
// 背景（2026-09-16）：README 停在 18:18，之后约 5 小时的工作没进去。
// 一个停在半天前的工作记忆，会让新会话**自信地走错方向** —— 它长得像"查过了"。
//
// 用法：node check-freshness.mjs
// 退出码：0 = 新鲜；1 = 过期或登记缺失
//
// ── 判据：时间，不是哈希（2026-09-18 改） ──────────────────────────────
//
// 上一版要求 README 里手抄三个仓的 HEAD。那是**第二份真相源**，而且必然漂移：
// 它刚接上电就拦了第一次 push —— 三个仓各前进一个提交，表里还写着旧哈希。
// 抄写会漂移，漂移会骗人（这正是本仓 patterns/derivation-over-copy 说的模式）。
//
// 现在只比**时间**：README 头部写 `**更新**：YYYY-MM-DD HH:MM`，
// 与每个仓"最后一次产品代码提交"的时间比较。晚于它 = 过期。
// 哈希不再写进 README —— 脚本会把当前 HEAD **打印出来**供参考（算出来的，不会漂移）。
//
// 一条容易踩的规则：**本文件自己住在 collab-cli 仓库里**。
// 若把 working-memory/ 的提交也算作"产品代码变化"，那"更新 README"本身
// 就会让登记过期 —— 永远收敛不了。所以比较时**排除 working-memory/**。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// 路径可用环境变量覆盖（COLLAB_CLI_DIR / COLLAB_KB_DIR / EVOLUTIONARY_DIR）。
// 默认值是作者本机的布局 —— 别处跑请显式给环境变量。
const REPOS = {
  "collab-cli": process.env.COLLAB_CLI_DIR ?? "D:\\actto\\front\\project\\collab-cli\\collab-cli",
  collaboration:
    process.env.COLLAB_KB_DIR ??
    "D:\\actto\\front\\project\\collaboration_aggregate\\collaboration",
  evolutionary:
    process.env.EVOLUTIONARY_DIR ??
    "D:\\actto\\front\\project\\evolutionary_start\\evolutionary",
};
/** 不算作"产品代码变化"的路径（pathsake 排除语法）。 */
const EXCLUDE = { "collab-cli": [":(exclude)working-memory"] };

function git(dir, args) {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/**
 * 仓库缺失 = **硬失败**，不是跳过。
 *
 * @remarks
 * 跳过会让"这个仓我根本没检查"与"检查了、它很新鲜"长得一模一样 ——
 * 与 collab-cli 里刚修掉的那个 `skipIf` 是同一个失效模式
 * （见 scripts/assert-no-skips.mjs 的注释）。
 */
function repoExists(dir) {
  try {
    return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, ".git"));
  } catch {
    return false;
  }
}

/**
 * 解析 README 头部的 `**更新**：YYYY-MM-DD HH:MM`。
 *
 * @returns 分钟级时间戳；解析不出来返回 null。
 */
function parseUpdatedAt(text) {
  const m = text.match(/\*\*更新\*\*\s*[：:]\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const dt = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
  );
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * 某仓最后一次**产品代码**提交的时间。
 *
 * @remarks
 * `--date=format-local` 取本地时间，与 README 里人写的时间同一时区。
 */
function lastCodeCommit(dir, name) {
  const args = ["log", "-1", "--date=format-local:%Y-%m-%d %H:%M", "--format=%cd"];
  const exclude = EXCLUDE[name];
  if (exclude) args.push("--", ".", ...exclude);
  const out = git(dir, args);
  const dt = new Date(out.replace(" ", "T"));
  return { raw: out, at: dt };
}

function head(dir) {
  return git(dir, ["rev-parse", "--short", "HEAD"]);
}

const readmePath = path.join(here, "README.md");
const readme = fs.readFileSync(readmePath, "utf8");

const updatedAt = parseUpdatedAt(readme);
if (updatedAt === null) {
  console.error("✖ README 里找不到 `**更新**：YYYY-MM-DD HH:MM` —— 无法判定新鲜度。");
  console.error(`  文件：${readmePath}`);
  process.exit(1);
}

// sv-SE 的输出恰好是 `YYYY-MM-DD HH:MM` —— 与 README 里写的格式一致。
console.log(`README 声明更新于：${updatedAt.toLocaleString("sv-SE").slice(0, 16)}`);
console.log("");
console.log("各仓最后一次产品代码提交：");

let stale = 0;
for (const [name, dir] of Object.entries(REPOS)) {
  if (!repoExists(dir)) {
    console.log(`  x ${name}: 仓库路径不可达（${dir}）`);
    console.log("      → 用环境变量覆盖，或明确知道自己在跳过什么。");
    stale += 1;
    continue;
  }

  const last = lastCodeCommit(dir, name);
  const sha = head(dir);
  const behind = last.at > updatedAt;

  if (behind) {
    console.log(`  x ${name}: ${last.raw}  (HEAD ${sha})  ← 晚于 README`);
    stale += 1;
  } else {
    console.log(`  ok ${name}: ${last.raw}  (HEAD ${sha})`);
  }
}

console.log("");
if (stale === 0) {
  console.log("ok 工作记忆新鲜。");
  process.exit(0);
}

console.log("!! 工作记忆已过期 —— **先把 README 更新到当前状态，再按它干活**。");
console.log("");
console.log("   更新方法：");
console.log("     1. 读上面标 x 的仓，看它自 README 声明的更新时间之后发生了什么");
console.log("     2. 改 README 的「活跃任务」栏，并把头部 `**更新**：` 改成当前时间");
console.log("");
console.log("   注意：改时间本身**不会**让检查通过 —— 产品代码的时间戳是固定的。");
process.exit(1);
