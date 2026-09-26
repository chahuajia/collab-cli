// scripts/check-freshness.ts
//
// 工作记忆新鲜度自检 —— 让"过期"变成可判定的，而不是靠自觉。
//
// 用法：
//   npm run memory            # 默认：判定新鲜度（会话开始那一步）
//   npm run memory:draft      # 只读：打印"自上次对账以来变了什么" + 草稿
//   npm run memory:attest     # 人签完时间戳之后跑：记录已对账到的 HEAD
//
// 退出码：0 = 新鲜；1 = 过期或登记缺失
//
// ── 2026-09-26 搬家（原先在 `working-memory/check-freshness.mjs`）────────────
//
// 搬走的三个理由，都是本仓自己的规矩：
//   1. `working-memory/` 是**数据**（`README.md` / `AGENTS.md` 明写"只写判断，
//      不写可计算的事实"），而它是那里唯一的可执行代码；
//   2. 它是 `.mjs` 且在 `scripts/` 之外 → **同时逃出 `tsc` / `eslint` /
//      `vitest include`**。一个"判据脚本"自己没有任何判据 ——
//      `scripts/README.md` 第 3 条已经把这类写成教训了，它是最后一处漏网；
//   3. 它自己打印的下一步是 `node check-freshness.mjs`，而文档里的调用是
//      `node working-memory/check-freshness.mjs` —— **两条命令各错一半**
//      （实测前者在仓根直接 `Cannot find module`）。现在与其它门禁同形：`npm run memory*`。
//
// ── 两代判据（判据本身在 `lib/freshness.ts`，有单测）────────────────────────
//
// 第一代（2026-09-18）：比**时间**。问题（2026-09-25 实测）：三个仓都在活动时，
//   **签完 2 分钟就被下一次跨仓提交判过期**。一个每两分钟红一次的灯，只会训练出
//   "顺手再签一次" —— 凭据死亡，正是本仓删过两次的假绿灯。
//
// 第二代：比**增量**。记录"上次对账到哪些 HEAD"（`working-memory/.attested.json`，
//   脚本写、不手抄），之后只看 `HEAD..HEAD` 里有几个产品提交。
//   报的是"**自上次对账以来 3 个提交**"，不是"你过期了" —— 前者可执行，后者只是责备。
//
// 分工是关键：**机器持有事实（HEAD / 提交数），人持有判断（时间戳 + --attest）**。
// `.attested.json` 由人**显式调用** `--attest` 才写，脚本自己永远不会自动对账。
//
// 兼容：没有 `.attested.json` 时**回退到第一代的时间判据**。
//
// 一条容易踩的规则：本仓（`collab-cli`）**始终按脚本自身位置识别**，不读
// `COLLAB_CLI_DIR` —— 否则会出现"在本仓跑，却读/签别处的记忆"。另两个仓走
// `@/infrastructure/fs/repoRoots` 的解析链（env → 可推导布局 → 硬失败）。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "@/infrastructure/fs/repoRoots";
import {
  parseUpdatedAt,
  verdictOf,
  type RepoProbe,
  type StaleReason,
} from "./lib/freshness.js";

/** 脚本所在仓的根（`scripts/` 的上一层）。 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WM_DIR = path.join(REPO_ROOT, "working-memory");
const README_PATH = path.join(WM_DIR, "README.md");
const ATTESTED_PATH = path.join(WM_DIR, ".attested.json");

interface RepoSpec {
  readonly name: string;
  readonly dir: string;
  /** 不算作"产品代码变化"的路径（git pathspec 排除语法） */
  readonly exclude: readonly string[];
}

const REPOS: readonly RepoSpec[] = [
  // 本仓：按脚本位置识别（见文件头最后一条）
  { name: "collab-cli", dir: REPO_ROOT, exclude: [":(exclude)working-memory"] },
  { name: "collaboration", dir: repoRoot("collaboration"), exclude: [] },
  { name: "evolutionary", dir: repoRoot("evolutionary"), exclude: [] },
];

const DRAFT = process.argv.includes("--draft");
const ATTEST = process.argv.includes("--attest");

function git(dir: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function repoExists(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, ".git"));
  } catch {
    return false;
  }
}

/** `execFileSync` 抛出来的东西里有退出码吗（不用类型断言 —— 本仓禁 `as`）。 */
function isExecError(value: unknown): value is { readonly status?: number } {
  return typeof value === "object" && value !== null && "status" in value;
}

/**
 * `from` 是不是当前 HEAD 的祖先？
 *
 * @remarks
 * **这一条是 2026-09-26 补的假绿补丁。** `rev-list --count from..HEAD` 在
 * "HEAD 是 from 的祖先"（切回了更旧的分支 / 回退过）时**返回 0** ——
 * 报出来是"自上次对账以来 0 个提交，新鲜"，而真相是**账本覆盖的是另一条分支**。
 * `git merge-base --is-ancestor` 退出码 0/1 正好区分"是/不是"。
 */
function isAncestorOfHead(dir: string, from: string): boolean {
  try {
    execFileSync("git", ["-C", dir, "merge-base", "--is-ancestor", from, "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch (error) {
    if (isExecError(error) && error.status === 1) return false;
    throw error;
  }
}

function head(dir: string): string {
  return git(dir, ["rev-parse", "--short", "HEAD"]);
}

/** 自 `from` 以来**产品代码**的提交数（排除 working-memory）。 */
function deltaCount(repo: RepoSpec, from: string): number {
  return Number(
    git(repo.dir, ["rev-list", "--count", `${from}..HEAD`, "--", ".", ...repo.exclude]),
  );
}

/** 自 `from` 以来的提交主题（最多 limit 条）。 */
function deltaSubjects(repo: RepoSpec, from: string, limit = 5): string[] {
  const out = git(repo.dir, [
    "log",
    `-${limit}`,
    "--date=short",
    "--pretty=%ad %h %s",
    `${from}..HEAD`,
    "--",
    ".",
    ...repo.exclude,
  ]);
  return out.length === 0 ? [] : out.split("\n");
}

function lastCodeCommitAt(repo: RepoSpec): Date | null {
  try {
    const raw = git(repo.dir, [
      "log",
      "-1",
      "--date=format-local:%Y-%m-%d %H:%M",
      "--format=%cd",
      "--",
      ".",
      ...repo.exclude,
    ]);
    const dt = new Date(raw.replace(" ", "T"));
    return Number.isNaN(dt.getTime()) ? null : dt;
  } catch {
    // 取不到时间 → null（判据会把它算成"不可判定 = 不新鲜"，不是"通过"）
    return null;
  }
}

interface Attested {
  readonly attested_at: string | null;
  readonly heads: Readonly<Record<string, string>>;
}

const NO_ATTESTATION: Attested = { attested_at: null, heads: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * 读 `.attested.json`。
 *
 * @remarks
 * **不用 `as` 断言**（本仓 `parse-don't-validate` 的既有判据）：文件是外部输入，
 * 字段可能被手改过。读不成、形态不对，一律退化成"还没对过账"——
 * 那会走第一代的时间判据（保守，不会假装新鲜）。
 */
function readAttested(): Attested {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(ATTESTED_PATH, "utf8"));
  } catch {
    return NO_ATTESTATION;
  }
  if (!isRecord(parsed)) return NO_ATTESTATION;

  const heads: Record<string, string> = {};
  const rawHeads = parsed["heads"];
  if (isRecord(rawHeads)) {
    for (const [name, value] of Object.entries(rawHeads)) {
      if (typeof value === "string") heads[name] = value;
    }
  }
  const at = parsed["attested_at"];
  return { attested_at: typeof at === "string" ? at : null, heads };
}

/** 探测所有仓 —— 只负责"取事实"，判定交给 `lib/freshness.ts`。 */
function probeAll(attested: Attested): RepoProbe[] {
  const probes: RepoProbe[] = [];
  for (const repo of REPOS) {
    if (!repoExists(repo.dir)) {
      probes.push({
        name: repo.name,
        dir: repo.dir,
        reachable: false,
        head: "",
        from: null,
        delta: null,
        lastCommitAt: null,
        baselineLost: false,
        baselineDiverged: false,
      });
      continue;
    }

    const from = attested.heads[repo.name];
    if (from === undefined) {
      // 没有基线 → 回退第一代的时间判据
      probes.push({
        name: repo.name,
        dir: repo.dir,
        reachable: true,
        head: head(repo.dir),
        from: null,
        delta: null,
        lastCommitAt: lastCodeCommitAt(repo),
        baselineLost: false,
        baselineDiverged: false,
      });
      continue;
    }

    try {
      const ancestor = isAncestorOfHead(repo.dir, from);
      probes.push({
        name: repo.name,
        dir: repo.dir,
        reachable: true,
        head: head(repo.dir),
        from,
        delta: ancestor ? deltaCount(repo, from) : null,
        lastCommitAt: null,
        baselineLost: false,
        baselineDiverged: !ancestor,
      });
    } catch {
      // 基准 commit 已不可达（分支重写 / rebase）
      probes.push({
        name: repo.name,
        dir: repo.dir,
        reachable: true,
        head: head(repo.dir),
        from,
        delta: null,
        lastCommitAt: null,
        baselineLost: true,
        baselineDiverged: false,
      });
    }
  }
  return probes;
}

const readme = fs.readFileSync(README_PATH, "utf8");
const updatedAt = parseUpdatedAt(readme);
if (updatedAt === null) {
  console.error("✖ README 里找不到可解析的 `**更新**：YYYY-MM-DD HH:MM` —— 无法判定新鲜度。");
  console.error(`  文件：${README_PATH}`);
  // 区分"那一行不在"与"那一行在、但格式不对" —— 后者是签名时的格式问题，
  // 光说"找不到"会让人对着明明存在的一行发呆（2026-09-26 实测过一次）。
  const found = /^.*\*\*更新\*\*.*$/m.exec(readme);
  if (found !== null) {
    console.error(`  找到这一行，但读不出时间：${found[0].trim()}`);
    console.error("  期望形如：`**更新**：2026-09-26 07:59`（小时写一位数也行，冒号全角半角都行）");
  } else {
    console.error("  这一行根本不在 —— 它必须由**人**写在 README 顶部（见 AGENTS.md 的响应协议）");
  }
  process.exit(1);
}
const updatedRaw = updatedAt.toLocaleString("sv-SE").slice(0, 16);

// ─────────────────────────────── --attest ───────────────────────────────
//
// 只有人能触发它。守卫：README 的时间戳必须**晚于上次对账时间**，
// 否则就是"没签字先盖章" —— 机器替人签了名。
if (ATTEST) {
  const prev = readAttested();
  const prevAt = prev.attested_at;
  if (prevAt !== null && updatedAt.getTime() <= new Date(prevAt.replace(" ", "T")).getTime()) {
    console.error("✖ 拒绝对账：README 的 `**更新**：` 不比上次对账时间新。");
    console.error(`  上次对账：${prevAt}`);
    console.error(`  README  ：${updatedRaw}`);
    console.error("  顺序是：先读 README、改表、**签时间戳**，再跑 --attest。");
    process.exit(1);
  }

  const heads: Record<string, string> = {};
  for (const repo of REPOS) {
    if (!repoExists(repo.dir)) {
      console.error(`✖ 拒绝对账：${repo.name} 仓库路径不可达（${repo.dir}）`);
      process.exit(1);
    }
    heads[repo.name] = head(repo.dir);
  }
  const record = {
    attested_at: updatedRaw,
    heads,
    recorded_at: new Date().toLocaleString("sv-SE").slice(0, 16),
  };
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
  console.log(`上次对账：${prev.attested_at ?? "（无 .attested.json —— 尚未对过账）"}`);
  console.log("");
  console.log("自上次对账以来（只看产品代码提交）：");

  // 与默认判定**共用同一套探测**（`probeAll`）—— 两条路各写一遍必然漂移：
  // 2026-09-26 实测，"基准不在当前分支上"这条只补进了默认判定，
  // 于是 `--draft` 里还在报"0 个提交，ok"。**能派生就别复制。**
  for (const p of probeAll(prev)) {
    if (!p.reachable) {
      console.log(`  x ${p.name}: 仓库路径不可达（${p.dir}）`);
      continue;
    }
    if (p.from === null) {
      console.log(`  ? ${p.name}: 无基准（先跑 --attest 建立基线）  HEAD ${p.head}`);
      continue;
    }
    if (p.baselineLost) {
      console.log(`  ! ${p.name}: 基准 ${p.from} 已不可达（分支重写？）—— 需要重新对账`);
      continue;
    }
    if (p.baselineDiverged) {
      console.log(
        `  ! ${p.name}: 基准 ${p.from} **不在当前分支的历史上**（切了分支 / 回退过）` +
          `  (当前 HEAD ${p.head}) —— 需要重新对账`,
      );
      continue;
    }
    const n = p.delta ?? 0;
    const repo = REPOS.find((r) => r.name === p.name);
    console.log(`  ${n === 0 ? "ok" : "->"} ${p.name}: ${n} 个提交  (${p.from} → ${p.head})`);
    if (repo !== undefined) {
      for (const s of deltaSubjects(repo, p.from)) console.log(`       ${s}`);
    }
  }

  console.log("");
  console.log("草稿（请按实际情况改写，不要照抄）：");
  console.log(
    "  > **对齐于 <今天>**：自上次声明后，<哪个仓的哪条线> 走完/变了；" +
      "**具体数字看命令输出，不抄进来。**",
  );
  console.log("");
  console.log("⚠️  `**更新**：` 那一行**必须由人签**，本命令刻意不碰它。");
  process.exit(0);
}

// ─────────────────────────────── 默认：判定 ───────────────────────────────
const attested = readAttested();
const probes = probeAll(attested);
const verdict = verdictOf(probes, updatedAt);

console.log(`README 声明更新于：${updatedRaw}`);
if (attested.attested_at !== null) console.log(`上次对账：${attested.attested_at}`);
console.log("");

const staleNames = new Set(verdict.stale.map((s) => s.name));
for (const p of probes) {
  if (!p.reachable) {
    console.log(`  x ${p.name}: 仓库路径不可达（${p.dir}）`);
    console.log("      → 用环境变量覆盖（见 src/infrastructure/fs/repoRoots.ts），或明确知道自己在跳过什么。");
    continue;
  }
  if (!staleNames.has(p.name)) {
    console.log(
      p.delta === null
        ? `  ok ${p.name}: (HEAD ${p.head})`
        : `  ok ${p.name}: 自上次对账以来 0 个产品提交  (HEAD ${p.head})`,
    );
    continue;
  }
  console.log(`  x ${p.name}: ${describeStale(p, verdict.stale, attested)}`);
}

console.log("");
if (verdict.fresh) {
  console.log("ok 工作记忆新鲜。");
  process.exit(0);
}

console.log("!! 工作记忆未覆盖上面的变动 —— **先对账，再按它干活**。");
console.log("");
for (const reason of verdict.stale) {
  const repo = REPOS.find((r) => r.name === reason.name);
  if (repo === undefined || reason.kind !== "delta" || reason.from === null) continue;
  console.log(`   ${repo.name} 的变动：`);
  for (const s of deltaSubjects(repo, reason.from)) console.log(`     ${s}`);
}
console.log("");
console.log("   顺序（签名必须是人做的）：");
console.log("     1. npm run memory:draft    # 看变了什么（只读）");
console.log("     2. 改 working-memory/README.md 的「活跃任务」栏，并**亲手**把 `**更新**：` 改成当前时间");
console.log("     3. npm run memory:attest   # 记录已对账到的 HEAD");
process.exit(1);

/** 一行人话，解释这条仓为什么不新鲜。 */
function describeStale(
  probe: RepoProbe,
  stale: readonly StaleReason[],
  prev: Attested,
): string {
  const reason = stale.find((s) => s.name === probe.name);
  const from = reason?.from ?? prev.heads[probe.name] ?? "?";
  switch (reason?.kind) {
    case "unreachable":
      return "仓库路径不可达";
    case "baseline-lost":
      return `基准 ${from} 已不可达 —— 重新对账（--draft 看现状，改表后 --attest）`;
    case "diverged":
      return `基准 ${from} **不在当前分支的历史上**（切了分支 / 回退过）—— 账本覆盖的是另一条分支，重新对账`;
    case "unknown":
      return `拿不到产品提交时间（HEAD ${probe.head}）—— 不要当成"新鲜"`;
    case "no-baseline":
      return `最后一次产品提交晚于 README（HEAD ${probe.head}）← 无基线，按时间判`;
    case "delta":
      return `自上次对账以来 ${reason.delta ?? 0} 个产品提交  (${from} → ${probe.head})`;
    default:
      return `无法判定（HEAD ${probe.head}）`;
  }
}
