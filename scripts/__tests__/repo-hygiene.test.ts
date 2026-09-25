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

/**
 * 安装范围只有一个真相源。
 *
 * @remarks
 * 2026-09-26 实测：`@^0.5` 曾**手写在四处**（kb 骨架 README、consumer wrapper、
 * `init` 的两条下一步提示）。升到 `0.6.0` 时，四处会同时把用户钉回 0.5.x ——
 * 而且**不报错**：`npx` 老老实实装旧版本，用户拿到的是换 `parse` 契约之前的包。
 *
 * 现在从 `package.json` 派生（`COLLAB_NPM_RANGE`）。这条测试防止有人再抄一遍。
 * 只扫 `src/`、`scripts/` 的源码 —— `working-memory/` 与 `RELEASE.md` 里的历史记录
 * 不算（它们记的是"当时是什么"，不该被追着改）。
 */
describe("CLI 安装范围只有一个真相源", () => {
  const HANDWRITTEN_RANGE = /@chahuajia\/collab-cli@[\^~]?\d/;
  const SINGLE_SOURCE = path.join("src", "infrastructure", "version.ts");

  // 标题里也不写那个字面量 —— 本文件在扫描范围内，守卫会指控它自己（实测踩过）
  it("源码里没有手写的安装范围（应派生自 package.json）", () => {
    const offenders = walk(ROOT)
      .map((abs) => path.relative(ROOT, abs))
      .filter(
        (rel) =>
          (rel.startsWith(`src${path.sep}`) ||
            rel.startsWith(`scripts${path.sep}`)) &&
          rel !== SINGLE_SOURCE,
      )
      .filter((rel) => HANDWRITTEN_RANGE.test(readFileSync(path.join(ROOT, rel), "utf8")));

    expect(
      offenders,
      `手写的安装范围（应改用 COLLAB_NPM_RANGE）:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("守卫本身有效：认得出写死的范围，也放得过不带范围的命令行", () => {
    // 样本必须拼接构造：本文件也在扫描范围内，写成字面量会让守卫指控它自己
    const hardcoded = ["npx --yes @chahuajia/collab-cli", "@^0.5 validate"].join("");
    expect(HANDWRITTEN_RANGE.test(hardcoded)).toBe(true);
    expect(HANDWRITTEN_RANGE.test("npx --yes @chahuajia/collab-cli --version")).toBe(false);
  });
});
