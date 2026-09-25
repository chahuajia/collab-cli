// scripts/lib/entryFiles.ts
import { readdirSync } from "node:fs";
import path from "node:path";
import { EntryKindDir } from "@/domain/entry/types";

/**
 * 知识库的 kind 目录 —— **从领域契约派生**。
 *
 * @remarks
 * 迁移脚本原先各自手抄一份 `ENTRY_KIND_DIRS`（`add-author` / `add-dates` …）。
 * 手抄的代价已经量过：契约一改（加一个 kind、改一个目录名），脚本**静默漏掉**
 * 新目录 —— 而它是"只跑一次"的脚本，没人会回头核对。
 * 这里从 `EntryKindDir` 派生，`@/domain/entry/types` 一改，脚本跟着动。
 */
export function entryKindDirs(): readonly string[] {
  return Object.values(EntryKindDir);
}

/** 某个相对路径是否落在 kind 目录里（两种方向都算：目录本身、或它的子路径）。 */
export function isInsideEntryDir(relPath: string): boolean {
  const normalized = relPath.split("\\").join("/");
  return entryKindDirs().some(
    (dir) => normalized === dir || normalized.startsWith(`${dir}/`) || dir.startsWith(`${normalized}/`),
  );
}

export interface WalkOptions {
  /** 只要这个扩展名的文件（如 `".md"`）；省略 = 全部文件 */
  readonly ext?: string | undefined;
  /** 跳过以 `.` 开头的目录（默认 true） */
  readonly skipDotDirs?: boolean | undefined;
}

/**
 * 递归收集文件（**六个一次性脚本各自重写过一遍的同一段代码**）。
 *
 * @returns 绝对路径列表，顺序与 `readdirSync` 一致（不排序 —— 调用方若需要稳定顺序自己排）
 */
export function walkFiles(dir: string, options: WalkOptions = {}): readonly string[] {
  const { ext, skipDotDirs = true } = options;
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skipDotDirs && entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkFiles(full, options));
      continue;
    }
    if (!entry.isFile()) continue;
    if (ext !== undefined && !entry.name.endsWith(ext)) continue;
    found.push(full);
  }
  return found;
}

/** 相对路径（统一用 `/`）—— 报告与匹配都用它，避免 Windows 的反斜杠漏进匹配。 */
export function toPosixRel(baseDir: string, absPath: string): string {
  return path.relative(baseDir, absPath).split("\\").join("/");
}

/**
 * 收集"条目文件"（**数据迁移脚本共用的那一段**）。
 *
 * @remarks
 * 规则：只走 kind 目录或它们的父目录；跳过 `.` 目录、`_` 前缀文件（索引/模板）。
 * `add-author` 与 `add-dates` 原先各自写了一份完全相同的实现。
 */
export function collectEntryFiles(baseDir: string): readonly string[] {
  const found: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      const rel = toPosixRel(baseDir, full);
      if (entry.isDirectory()) {
        if (shouldDescend(rel)) visit(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".md")) continue;
      if (entry.name.startsWith("_")) continue;
      if (!isInsideEntryDir(rel)) continue;
      found.push(full);
    }
  };
  visit(baseDir);
  return found;
}

/**
 * 是否进得去这个目录。
 *
 * @remarks
 * 进"kind 目录"或"kind 目录的父目录"（如 `meta` 是 `meta/decision-records` 的前缀）。
 * `''` 是仓库根 → 进。`templates` / `meta/foo` → 不进。
 */
function shouldDescend(rel: string): boolean {
  if (rel === "" || rel === ".") return true;
  return entryKindDirs().some((dir) => rel === dir || dir.startsWith(`${rel}/`));
}
