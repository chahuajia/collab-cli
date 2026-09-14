// src/cli/lib/generateId.ts
import fs from 'node:fs';
import path from 'node:path';
import {
    EntryKindValues,
    EntryKindDir,
    EntryPrefix,
} from '../../domain/entry/types.js';
import type { EntryKind } from '../../domain/entry/types.js';

/**
 * 为新条目生成下一个 ID。
 *
 * @remarks
 * 扫描目录下所有 `.md` 文件（递归、排除 `_*`），
 * 提取符合 `<prefix><number>` 形式的文件名，取最大数字 +1。
 *
 * - `pattern` 类型没有前缀 → 抛错，要求手动指定
 * - `adr` 类型的数字补零到 4 位
 *
 * @throws 当类型为 pattern 时（无前缀无法自动生成）
 */
export function generateNextId(collabDir: string, type: EntryKind): string {
    if (type === EntryKindValues.Pattern) {
        throw new Error(
            'Pattern entries require a manual id. Usage: collab new pattern <id>',
        );
    }

    const prefix = EntryPrefix[type];
    const dir = path.join(collabDir, EntryKindDir[type]);

    if (!fs.existsSync(dir)) {
        return formatId(type, prefix, 1);
    }

    const numbers = collectNumbers(dir, prefix);
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return formatId(type, prefix, max + 1);
}

/** Markdown 文件扩展名。 */
const MD_EXTENSION = '.md';
function collectNumbers(dir: string, prefix: string): number[] {
    const numbers: number[] = [];
    walk(dir, (fileName) => {
        if (!fileName.endsWith(".md") || fileName.startsWith("_")) return;
        const base = fileName.slice(0, -MD_EXTENSION.length); // 去掉 .md
        const n = extractNumber(base, prefix);
        if (n !== undefined) numbers.push(n);
    });
    return numbers;
}

function walk(dir: string, visitor: (fileName: string) => void): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), visitor);
        } else if (entry.isFile()) {
            visitor(entry.name);
        }
    }
}

function extractNumber(name: string, prefix: string): number | undefined {
    if (!name.startsWith(prefix)) return undefined;
    const rest = name.slice(prefix.length);
    if (!/^\d+$/.test(rest)) return undefined;
    return parseInt(rest, 10);
}

const ADR_PADDING = 4;
function formatId(type: EntryKind, prefix: string, n: number): string {
    if (type === EntryKindValues.Adr) {
        return `${prefix}${String(n).padStart(ADR_PADDING, "0")}`;
    }
    return `${prefix}${n}`;
}