#!/usr/bin/env node
// scripts/assert-no-skips.mjs
//
// 让"跳过"与"通过"在**退出码上可分**。
//
// 为什么需要它：本仓曾有一处 `describe.skipIf(!existsSync(<绝对路径>))` 的测试。
// 在 CI 上那个路径不存在 → 静默跳过 → CI 全绿；在本机路径存在 → 断言过时而红。
// 两种情况都是"绿"，但含义完全不同 —— 这会让"验过了"和"根本没验"长得一模一样。
//
// 机制：跑 vitest 的 json reporter，数 numSkipped。任何跳过都必须出现在
// `.vitest-skip-allowlist.json` 里并写明理由 —— 跳过从此是一次被 review 的显式行为。
//
// 没有允许清单的话，CI 会在拿不到真库的机器上永久红；那会诱使人去关掉整个门禁，
// 比不做还糟。允许清单是让门禁**可持续**的那一半。

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/**
 * vitest 的 JS 入口 —— 用 `node <entry>` 起，而不是 `npx vitest`。
 *
 * @remarks
 * Node 20+ 在 Windows 上对 `.cmd` 有 spawn 限制（CVE-2024-27980），
 * `execFileSync("npx.cmd", …)` 会直接 EINVAL。绕开 .cmd 层是唯一
 * 不依赖 `shell: true` 的干净做法（后者会把参数交给 shell 解析）。
 */
const VITEST_ENTRY = require.resolve("vitest/vitest.mjs");

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWLIST_PATH = path.join(PROJECT_ROOT, ".vitest-skip-allowlist.json");
const REPORT_PATH = path.join(PROJECT_ROOT, ".vitest-report.json");

/** 删掉中间报告 —— 它是过程产物，不该留在工作区里被 git 看到。 */
function cleanup() {
  try {
    rmSync(REPORT_PATH, { force: true });
  } catch {
    /* 删不掉不是失败，忽略 */
  }
}

/** 读允许清单；缺失 = 空清单（不是错误 —— 新仓应该能在零跳过下跑绿）。 */
function readAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return { allowed: [] };
  try {
    const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
    return { allowed: Array.isArray(parsed.allowed) ? parsed.allowed : [] };
  } catch (e) {
    console.error(`✖ 无法解析 ${path.relative(PROJECT_ROOT, ALLOWLIST_PATH)}: ${e.message}`);
    process.exit(1);
  }
}

console.log("▶ 运行测试（json reporter）…");

try {
  execFileSync(
    process.execPath,
    [VITEST_ENTRY, "run", "--reporter=json", `--outputFile=${REPORT_PATH}`],
    { cwd: PROJECT_ROOT, encoding: "utf8", stdio: ["ignore", "inherit", "inherit"] },
  );
} catch {
  // 测试本身有失败 —— 交给 vitest 的退出码语义，这里不重复报。
  console.error("✖ 测试未通过（见上方 vitest 输出）。");
  cleanup();
  process.exit(1);
}

/** 汇总每个被跳过的测试，用于与允许清单比对。 */
function collectSkips(report) {
  const skips = [];
  for (const file of report.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      if (t.status === "pending" || t.status === "skipped" || t.status === "todo") {
        skips.push({
          file: path.relative(PROJECT_ROOT, file.name).split(path.sep).join("/"),
          name: t.fullName ?? t.title,
        });
      }
    }
  }
  return skips;
}

let report;
try {
  report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
} catch (e) {
  console.error(`✖ 无法读取 vitest 报告: ${e.message}`);
  cleanup();
  process.exit(1);
}

cleanup();

const { allowed } = readAllowlist();
const skips = collectSkips(report);
// vitest 的 json reporter 沿用 jest 的字段名（numPendingTests / numTodoTests），
// 不是 numSkipped —— 读错字段会得到"0 通过 0 跳过"这种看起来没问题的谎报。
const numSkipped = (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);
const numPassed = report.numPassedTests ?? 0;

/** 与允许清单匹配：按 file 或 file::name 前缀。 */
function isAllowed(skip) {
  return allowed.some(
    (a) => a.file === skip.file && (a.name === undefined || skip.name.includes(a.name)),
  );
}

const unlisted = skips.filter((s) => !isAllowed(s));

if (unlisted.length > 0) {
  console.error("");
  console.error(`✖ 有 ${unlisted.length} 个测试被跳过，但不在允许清单里：`);
  for (const s of unlisted) console.error(`    ${s.file}\n      ${s.name}`);
  console.error("");
  console.error("  跳过 = 没验，不是验过了。要么让它跑，要么把它");
  console.error(`  写进 ${path.relative(PROJECT_ROOT, ALLOWLIST_PATH)} 并写明理由。`);
  process.exit(1);
}

// 兜底：报告说跳了 N 个，但我们只能对上 M < N 个 —— 说明有跳过没能归因
// （通常是整个文件被 skip，断言根本没被枚举）。归因不了的跳过 = 不可审计。
if (numSkipped > skips.length) {
  console.error("");
  console.error(
    `✖ 报告显示 ${numSkipped} 个跳过，但只有 ${skips.length} 个可归因到具体测试。`,
  );
  console.error("  归因不了的跳过无法审计 —— 请检查是否有整个测试文件被 skip。");
  process.exit(1);
}

console.log(
  `✔ ${numPassed} 通过 · ${numSkipped} 跳过（${allowed.length} 条已在允许清单中声明）`,
);
