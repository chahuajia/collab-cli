// 工作记忆新鲜度自检 —— 让"过期"变成可判定的，而不是靠自觉。
//
// 背景（2026-09-16）：README 停在 18:18，之后约 5 小时的工作没进去。
// 一个停在半天前的工作记忆，会让新会话**自信地走错方向** —— 它长得像"查过了"。
//
// 用法：node check-freshness.mjs
// 退出码：0 = 新鲜；1 = 过期或登记缺失
//
// 一条容易踩的规则：**本文件自己住在 collab-cli 仓库里**。
// 若只比 HEAD，"每次更新 README"本身就会让登记过期 —— 永远收敛不了。
// 所以比较时**排除 working-memory/ 自身**：真正该让记忆过期的是**产品代码的变化**。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPOS = {
  "collab-cli": "D:\\actto\\front\\project\\collab-cli\\collab-cli",
  collaboration: "D:\\actto\\front\\project\\collaboration_aggregate\\collaboration",
  evolutionary: "D:\\actto\\front\\project\\evolutionary_start\\evolutionary",
};
const EXCLUDE = { "collab-cli": [":(exclude)working-memory"] };

function git(dir, args) {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

const readme = fs.readFileSync(path.join(here, "README.md"), "utf8");

let stale = 0;
console.log("登记 vs 实际：");
for (const [name, dir] of Object.entries(REPOS)) {
  const re = new RegExp("\\|\\s*`" + name.replace(/-/g, "\\-") + "`\\s*\\|\\s*`([0-9a-f]{7,40})`");
  const m = readme.match(re);
  const now = git(dir, ["rev-parse", "--short", "HEAD"]);
  if (!m) {
    console.log("  x " + name + ": README 里没有登记（需要 | `" + name + "` | `<hash>` |）");
    stale += 1;
    continue;
  }
  if (m[1] === now) {
    console.log("  ok " + name + ": " + m[1]);
    continue;
  }
  let behind = "未知（登记的提交不在历史里？）";
  try {
    behind = git(dir, ["rev-list", "--count", m[1] + "..HEAD", "--", ".", ...(EXCLUDE[name] || [])]);
  } catch (err) {
    /* 保持默认值 */
  }
  if (behind === "0") {
    console.log("  ok " + name + ": " + m[1] + "（其后的提交只动了 working-memory）");
    continue;
  }
  console.log("  x " + name + ": 登记 " + m[1] + " != 实际 " + now + "  （产品代码落后 " + behind + " 个提交）");
  stale += 1;
}

console.log("");
if (stale === 0) {
  console.log("ok 工作记忆新鲜。");
  process.exit(0);
}
console.log("!! 工作记忆已过期 —— **先把 README 更新到当前状态，再按它干活**。");
console.log("   更新方法：读三仓库 git log，改 README 的「登记（本版）」表与「活跃任务」栏。");
process.exit(1);