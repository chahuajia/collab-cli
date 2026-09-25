import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 仓库编码卫生：**不许有 UTF-8 BOM**。
 *
 * @remarks
 * 为什么值得一条测试：BOM 是**环境制造**的（Windows 编辑器与
 * `Set-Content -Encoding UTF8` 都默认带 BOM），而它会让不剥离它的解析器当场失败。
 * 2026-09-26 实测：`package.json` 被 `Set-Content` 重写后带上了 BOM，
 * vite/PostCSS 立刻报 `Unexpected token '﻿'`；同一次扫描在仓库里找出 7 个带
 * BOM 的文件。治根在 `.editorconfig`，这里是兜底。
 *
 * 只查 BOM，**不查行尾** —— 仓库开着 `core.autocrlf=true`，工作区的 .ts
 * 在某些机器上本来就是 CRLF，断言行尾会制造假红。
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage", ".husky"]);
const CHECKED_EXT = new Set([".ts", ".mts", ".mjs", ".cjs", ".js", ".json", ".md", ".yml", ".yaml"]);

/** UTF-8 BOM 的三个字节（EF BB BF）。 */
const BOM = [0xef, 0xbb, 0xbf] as const;

/** 兜底测试的下限：扫到的文件数少于它，说明扫描本身坏了。 */
const MIN_SCANNED_FILES = 50;

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".editorconfig") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(abs, found);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!CHECKED_EXT.has(path.extname(entry.name))) continue;
    found.push(abs);
  }
  return found;
}

function hasBom(abs: string): boolean {
  const head = readFileSync(abs).subarray(0, BOM.length);
  return head.length === BOM.length && BOM.every((byte, i) => head[i] === byte);
}

describe("仓库编码卫生", () => {
  it("没有文件带 UTF-8 BOM", () => {
    const offenders = walk(ROOT).filter(hasBom).map((abs) => path.relative(ROOT, abs));
    expect(offenders, `带 BOM 的文件（编辑器/脚本写出来的）:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("扫描确实覆盖到了文件（防止扫了个寂寞）", () => {
    expect(walk(ROOT).length).toBeGreaterThan(MIN_SCANNED_FILES);
    expect(statSync(path.join(ROOT, "package.json")).isFile()).toBe(true);
  });
});
