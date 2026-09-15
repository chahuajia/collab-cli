// src/domain/validation/rules/_shared.ts
import {
  EntryPrefix,
  EntryKindDir,
  EntryKindValues,
} from "@/domain/entry/types";
import type {EntryKind} from "@/domain/entry/types";


/**
 * 从 Markdown body 中提取所有 `[[X]]` 形式的引用原文。
 *
 * @remarks
 * - 只匹配 `[[X]]`，X 至少 1 个字符（`[[]]` 不匹配）
 * - 允许 X 含 `/`（长引用）
 * - 不处理 Markdown 链接 `[text](url)`
 * - 不处理代码块（TODO：未来引入 Markdown 解析器时统一处理）
 */
export function extractLinks(body: string): string[] {
    const pattern = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
        const raw = match[1];
        if (raw !== undefined && raw.length > 0) links.push(raw);
    }
    return links;
}

/**
 * 取引用的"最后一段"作为匹配 key。
 *
 * @example
 * - `S12` → `S12`
 * - `patterns/rooted-graph` → `rooted-graph`
 * - `meta/decision-records/ADR-0001` → `ADR-0001`
 */
export function lastSegmentOf(ref: string): string {
    const parts = ref.split('/');
    return parts[parts.length - 1] ?? ref;
}

/**
 * 取文件路径所在的目录（不含文件名）。
 *
 * @example
 * - `skills/S12.md` → `skills`
 * - `meta/decision-records/ADR-0001.md` → `meta/decision-records`
 * - `S12.md` → `''`
 */
export function dirOfPath(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash === -1 ? '' : normalized.slice(0, lastSlash);
}

/** 所有 EntryKind 的显式列表。 */
const ALL_ENTRY_TYPES: readonly EntryKind[] = [
  EntryKindValues.Agreement,
  EntryKindValues.Workflow,
  EntryKindValues.Skill,
  EntryKindValues.Pattern,
  EntryKindValues.Adr,
];

/**
 * 目录 → id 前缀的反向查找。
 *
 * @remarks
 * 用显式类型数组而非 `Object.keys`，避免 TS 5.9 严格模式下
 * `Object.keys` 返回 `string[]` 导致的索引类型失败。
 */
const DirToPrefix = new Map<string, string>();
for (const type of ALL_ENTRY_TYPES) {
  DirToPrefix.set(EntryKindDir[type], EntryPrefix[type]);
}

export function idPrefixForDir(dir: string): string | undefined {
    return DirToPrefix.get(dir);
}

