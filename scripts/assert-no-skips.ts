#!/usr/bin/env node
// scripts/assert-no-skips.ts
//
// 让"跳过"与"通过"在**退出码上可分**。
//
// 为什么需要它：本仓曾有一处 `describe.skipIf(!existsSync(<绝对路径>))` 的测试。
// 在 CI 上那个路径不存在 → 静默跳过 → CI 全绿；在本机路径存在 → 断言过时而红。
// 两种情况都是"绿"，但含义完全不同 —— 这会让"验过了"和"根本没验"长得一模一样。
//
// 机制：跑 vitest 的 json reporter，数跳过。任何跳过都必须出现在
// `.vitest-skip-allowlist.json` 里并写明理由 —— 跳过从此是一次被 review 的显式行为。
//
// 没有允许清单的话，CI 会在拿不到真库的机器上永久红；那会诱使人去关掉整个门禁，
// 比不做还糟。允许清单是让门禁**可持续**的那一半。
//
// **本文件只做 I/O**（起进程、读文件、打印、退出码）；判定在
// `scripts/lib/skip-accounting.ts`（纯函数，有单测）—— 门禁的判据必须可被单独验证。

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EMPTY_ALLOWLIST,
  failedTests,
  passedCount,
  parseVitestReport,
  skippedCount,
  unattributedSkips,
  unlistedSkips,
} from "./lib/skip-accounting.js";
import type { AllowEntry, Allowlist, VitestReport } from "./lib/skip-accounting.js";

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
function cleanup(): void {
  try {
    rmSync(REPORT_PATH, { force: true });
  } catch {
    /* 删不掉不是失败，忽略 */
  }
}

/** 读允许清单；缺失 = 空清单（不是错误 —— 新仓应该能在零跳过下跑绿）。 */
function readAllowlist(): Allowlist {
  if (!existsSync(ALLOWLIST_PATH)) return EMPTY_ALLOWLIST;
  try {
    const raw: unknown = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
    if (!isRecord(raw)) return EMPTY_ALLOWLIST;
    const entries = raw["allowed"];
    if (!Array.isArray(entries)) return EMPTY_ALLOWLIST;
    // 形状不对的条目**丢掉**（而不是猜）—— 清单是手写的，容错但不容错到放行
    return { allowed: entries.map(toAllowEntry).filter(isEntry) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`✖ 无法解析 ${path.relative(PROJECT_ROOT, ALLOWLIST_PATH)}: ${reason}`);
    process.exit(1);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 一条允许清单条目；形状不对返回 `null`（调用方丢掉它）。 */
function toAllowEntry(value: unknown): AllowEntry | null {
  if (!isRecord(value)) return null;
  const file = value["file"];
  if (typeof file !== "string" || file.length === 0) return null;
  const name = value["name"];
  return typeof name === "string" ? { file, name } : { file };
}

function isEntry(value: AllowEntry | null): value is AllowEntry {
  return value !== null;
}

function readReport(): VitestReport | null {
  try {
    return parseVitestReport(JSON.parse(readFileSync(REPORT_PATH, "utf8")));
  } catch {
    return null;
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
  // 测试本身有失败。**必须点名**：只说"未通过"会让 CI 日志里
  // "哪条挂了"和"根本没跑"长得一样 —— 与这个脚本要治的病同源。
  reportFailures();
  cleanup();
  process.exit(1);
}

/** 点名失败的测试（读不到报告就退回一句通用提示，不掩盖真实退出码）。 */
function reportFailures(): void {
  const report = readReport();
  if (report === null) {
    console.error("✖ 测试未通过（未拿到报告 —— 见上方 vitest 输出）。");
    return;
  }
  const failed = failedTests(report, PROJECT_ROOT);
  console.error("");
  console.error(`✖ ${failed.length} 个测试失败：`);
  for (const f of failed) {
    console.error(`    ${f.file}`);
    console.error(`      ${f.name}`);
    for (const line of f.message.split("\n")) console.error(`      │ ${line}`);
  }
  console.error("");
}

const report = readReport();
if (report === null) {
  console.error("✖ 无法读取 vitest 报告。");
  cleanup();
  process.exit(1);
}

cleanup();

const allowlist = readAllowlist();

const unlisted = unlistedSkips(report, allowlist, PROJECT_ROOT);
if (unlisted.length > 0) {
  console.error("");
  console.error(`✖ 有 ${unlisted.length} 个测试被跳过，但不在允许清单里：`);
  for (const skip of unlisted) console.error(`    ${skip.file}\n      ${skip.name}`);
  console.error("");
  console.error("  跳过 = 没验，不是验过了。要么让它跑，要么把它");
  console.error(
    `  写进 ${path.relative(PROJECT_ROOT, ALLOWLIST_PATH)} 并写明理由。`,
  );
  process.exit(1);
}

const unattributed = unattributedSkips(report, PROJECT_ROOT);
if (unattributed > 0) {
  console.error("");
  console.error(
    `✖ 报告显示 ${skippedCount(report)} 个跳过，但有 ${unattributed} 个无法归因到具体测试。`,
  );
  console.error("  归因不了的跳过无法审计 —— 请检查是否有整个测试文件被 skip。");
  process.exit(1);
}

console.log(
  `✔ ${passedCount(report)} 通过 · ${skippedCount(report)} 跳过（${allowlist.allowed.length} 条已在允许清单中声明）`,
);
