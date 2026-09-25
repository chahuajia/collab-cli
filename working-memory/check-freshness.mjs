// 工作记忆新鲜度自检 —— 让"过期"变成可判定的，而不是靠自觉。
//
// 用法：
//   node check-freshness.mjs            # 默认：判定新鲜度（pre-push 挂的就是它）
//   node check-freshness.mjs --draft    # 只读：打印"自上次对账以来变了什么" + 草稿
//   node check-freshness.mjs --attest   # 人签完时间戳之后跑：记录已对账到的 HEAD
//
// 退出码：0 = 新鲜；1 = 过期或登记缺失
//
// ── 两代判据 ────────────────────────────────────────────────────────
//
// 第一代（2026-09-18）：比**时间** —— README 的 `**更新**：` 与各仓"最后一次产品代码提交"比。
//   问题（2026-09-25 实测）：三个仓都在活动时，**签完 2 分钟就被下一次跨仓提交判过期**。
//   一个每两分钟红一次的灯，只会训练出"顺手再签一次" —— 凭据死亡，正是本仓删过两次的假绿灯。
//
// 第二代（本版）：比**增量** —— 记录"上次对账到哪些 HEAD"（`working-memory/.attested.json`，
//   脚本写、不手抄），之后只看 `HEAD..HEAD` 里有几个产品提交。
//   报的是"**自上次对账以来 3 个提交**"，不是"你过期了" —— 前者可执行，后者只是责备。
//
// 分工是关键：**机器持有事实（HEAD / 提交数），人持有判断（时间戳 + --attest）**。
// `.attested.json` 由人**显式调用** `--attest` 才写，脚本自己永远不会自动对账。
//
// 兼容：没有 `.attested.json` 时**回退到第一代的时间判据** —— 部署这份脚本不会当场改变行为。
//
// 一条容易踩的规则：**本文件自己住在 collab-cli 仓库里**。
// 若把 working-memory/ 的提交也算作"产品代码变化"，那"更新 README"本身就会让登记过期。
// 所以比较时**排除 working-memory/**。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const REPOS = {
  "collab-cli": process.env.COLLAB_CLI_DIR ?? "D:\\actto\\front\\project\\collab-cli\\collab-cli",
  collaboration:
    process.env.COLLAB_KB_DIR ??
    "D:\\actto\\front\\project\\collaboration_aggregate\\collaboration",
  evolutionary:
    process.env.EVOLUTIONARY_DIR ?? "D:\\actto\\front\\project\\evolutionary_start\\evolutionary",
};
/** 不算作"产品代码变化"的路径（pathsake 排除语法）。 */
const EXCLUDE = { "collab-cli": [":(exclude)working-memory"] };

const ATTESTED_PATH = path.join(here, ".attested.json");
const DRAFT = process.argv.includes("--draft");
const ATTEST = process.argv.includes("--attest");

function git(dir, args) {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function repoExists(dir) {
  try {
    return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, ".git"));
  } catch {
    return false;
  }
}

function parseUpdatedAt(text) {
  const m = text.match(/\*\*更新\*\*\s*[：:]\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function lastCodeCommit(dir, name) {
  const args = ["log", "-1", "--date=format-local:%Y-%m-%d %H:%M", "--format=%cd"];
  const exclude = EXCLUDE[name];
  if (exclude) args.push("--", ".", ...exclude);
  return { raw: git(dir, args) };
}

function head(dir) {
  return git(dir, ["rev-parse", "--short", "HEAD"]);
}

/** 自 `from` 以来**产品代码**的提交数（排除 working-memory）。 */
function deltaCount(dir, name, from) {
  const args = ["rev-list", "--count", `${from}..HEAD`];
  const exclude = EXCLUDE[name];
  if (exclude) args.push("--", ".", ...exclude);
  return Number(git(dir, args));
}

/** 自 `from` 以来的提交主题（最多 limit 条）。 */
function deltaSubjects(dir, name, from, limit = 5) {
  const args = ["log", `-${limit}`, "--date=short", "--pretty=%ad %h %s", `${from}..HEAD`];
  const exclude = EXCLUDE[name];
  if (exclude) args.push("--", ".", ...exclude);
  const out = git(dir, args);
  return out.length === 0 ? [] : out.split("\n");
}

function readAttested() {
  try {
    return JSON.parse(fs.readFileSync(ATTESTED_PATH, "utf8"));
  } catch {
    return null;
  }
}

const readmePath = path.join(here, "README.md");
const readme = fs.readFileSync(readmePath, "utf8");
const updatedAt = parseUpdatedAt(readme);
if (updatedAt === null) {
  console.error("✖ README 里找不到 `**更新**：YYYY-MM-DD HH:MM` —— 无法判定新鲜度。");
  console.error(`  文件：${readmePath}`);
  process.exit(1);
}
const updatedRaw = updatedAt.toLocaleString("sv-SE").slice(0, 16);

// ─────────────────────────────── --attest ───────────────────────────────
//
// 只有人能触发它。守卫：README 的时间戳必须**晚于上次对账时间**，
// 否则就是"没签字先盖章" —— 机器替人签了名。
if (ATTEST) {
  const prev = readAttested();
  if (prev && prev.attested_at && updatedAt.getTime() <= new Date(prev.attested_at.replace(" ", "T")).getTime()) {
    console.error("✖ 拒绝对账：README 的 `**更新**：` 不比上次对账时间新。");
    console.error(`  上次对账：${prev.attested_at}`);
    console.error(`  README  ：${updatedRaw}`);
    console.error("  顺序是：先读 README、改表、**签时间戳**，再跑 --attest。");
    process.exit(1);
  }

  const heads = {};
  for (const [name, dir] of Object.entries(REPOS)) {
    if (!repoExists(dir)) {
      console.error(`✖ 拒绝对账：${name} 仓库路径不可达（${dir}）`);
      process.exit(1);
    }
    heads[name] = head(dir);
  }
  const record = { attested_at: updatedRaw, heads, recorded_at: new Date().toLocaleString("sv-SE").slice(0, 16) };
  fs.writeFileSync(ATTESTED_PATH, JSON.stringify(record, null, 2) + "\n", "utf8");
  console.log(`✔ 已对账到：${JSON.stringify(heads)}`);
  console.log(`  记录写入：${path.relative(process.cwd(), ATTESTED_PATH)}`);
  process.exit(0);
}

// ─────────────────────────────── --draft ───────────────────────────────
//
// 只读。打印"自上次对账以来变了什么"，供人判断该更新还是该降级归档。
// **绝不写文件**，也**绝不改时间戳那一行** —— 签名始终是人签的。
if (DRAFT) {
  const prev = readAttested();
  console.log(`README 声明更新于：${updatedRaw}`);
  console.log(`上次对账：${prev ? prev.attested_at : "（无 .attested.json —— 尚未对过账）"}`);
  console.log("");
  console.log("自上次对账以来（只看产品代码提交）：");

  for (const [name, dir] of Object.entries(REPOS)) {
    if (!repoExists(dir)) {
      console.log(`  x ${name}: 仓库路径不可达（${dir}）`);
      continue;
    }
    const from = prev?.heads?.[name];
    if (!from) {
      console.log(`  ? ${name}: 无基准（先跑 --attest 建立基线）  HEAD ${head(dir)}`);
      continue;
    }
    let n;
    try {
      n = deltaCount(dir, name, from);
    } catch {
      console.log(`  ! ${name}: 基准 ${from} 已不可达（分支重写？）—— 需要重新对账`);
      continue;
    }
    console.log(`  ${n === 0 ? "ok" : "->"} ${name}: ${n} 个提交  (${from} → ${head(dir)})`);
    for (const s of deltaSubjects(dir, name, from)) console.log(`       ${s}`);
  }

  console.log("");
  console.log("草稿（请按实际情况改写，不要照抄）：");
  if (prev) {
    console.log(
      `  > **对齐于 <今天>**：自上次声明后，<哪个仓的哪条线> 走完/变了；` +
        `**具体数字看命令输出，不抄进来。**`,
    );
  } else {
    console.log("  （还没有基线；先按上面的提交主题更新「活跃任务」栏，再签时间戳 + --attest）");
  }
  console.log("");
  console.log("⚠️  `**更新**：` 那一行**必须由人签**，本命令刻意不碰它。");
  process.exit(0);
}

// ─────────────────────────────── 默认：判定 ───────────────────────────────
const attested = readAttested();
console.log(`README 声明更新于：${updatedRaw}`);
if (attested) console.log(`上次对账：${attested.attested_at}`);
console.log("");

let stale = 0;
const details = [];

for (const [name, dir] of Object.entries(REPOS)) {
  if (!repoExists(dir)) {
    console.log(`  x ${name}: 仓库路径不可达（${dir}）`);
    console.log("      → 用环境变量覆盖，或明确知道自己在跳过什么。");
    stale += 1;
    continue;
  }

  const sha = head(dir);

  // 没有基线 → 回退第一代时间判据（部署本版不改变行为）
  if (!attested?.heads?.[name]) {
    const last = lastCodeCommit(dir, name);
    const behind = new Date(last.raw.replace(" ", "T")) > updatedAt;
    if (behind) {
      console.log(`  x ${name}: ${last.raw}  (HEAD ${sha})  ← 晚于 README`);
      stale += 1;
      details.push([name, dir, null]);
    } else {
      console.log(`  ok ${name}: ${last.raw}  (HEAD ${sha})`);
    }
    continue;
  }

  const from = attested.heads[name];
  let n;
  try {
    n = deltaCount(dir, name, from);
  } catch {
    console.log(`  ! ${name}: 基准 ${from} 已不可达 —— 重新对账（--draft 看现状，改表后 --attest）`);
    stale += 1;
    continue;
  }

  if (n > 0) {
    console.log(`  x ${name}: 自上次对账以来 ${n} 个产品提交  (${from} → ${sha})`);
    stale += 1;
    details.push([name, dir, from]);
  } else {
    console.log(`  ok ${name}: 自上次对账以来 0 个产品提交  (HEAD ${sha})`);
  }
}

console.log("");
if (stale === 0) {
  console.log("ok 工作记忆新鲜。");
  process.exit(0);
}

console.log("!! 工作记忆未覆盖上面的变动 —— **先对账，再按它干活**。");
console.log("");
for (const [name, dir, from] of details) {
  if (!from) continue;
  console.log(`   ${name} 的变动：`);
  for (const s of deltaSubjects(dir, name, from)) console.log(`     ${s}`);
}
console.log("");
console.log("   顺序（签名必须是人做的）：");
console.log("     1. node check-freshness.mjs --draft     # 看变了什么（只读）");
console.log("     2. 改 README 的「活跃任务」栏，并**亲手**把 `**更新**：` 改成当前时间");
console.log("     3. node check-freshness.mjs --attest    # 记录已对账到的 HEAD");
process.exit(1);