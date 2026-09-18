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
 * - **跳过围栏代码块与行内代码**（2026-09-16 修复）：
 *   否则"讨论链接"的文档会被误报成死链 —— 写 ADR-0009 时就踩了两次。
 *   代价：代码里的真链接不会被检查（可接受 —— 代码里的双括号多半是示例）。
 */
export function extractLinks(body: string): string[] {
    const pattern = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match: RegExpExecArray | null;
    const searchable = stripCode(body);
    while ((match = pattern.exec(searchable)) !== null) {
        const raw = match[1];
        if (raw !== undefined && raw.length > 0) links.push(raw);
    }
    return links;
}

/**
 * 去掉围栏代码块与行内代码。
 *
 * @remarks
 * 只做**保守**处理，不引入 Markdown 解析器：
 * - 围栏：以 ``` 开头的行（可带缩进）切换状态，围栏内整行忽略
 * - 行内：`` `...` `` 整段替换为空
 *
 * 替换而非删除行，是为了让行数保持不变（便于调试时对号入座）。
 */
function stripCode(body: string): string {
    const withoutFences = body
        .split("\n")
        .map((line) => {
            if (/^\s*```/.test(line)) return "\u0000FENCE\u0000";
            return line;
        })
        .join("\n");

    // 上面只是标记围栏行；这里按标记切分段落，段落内交替"在围栏内/外"
    const segments = withoutFences.split("\u0000FENCE\u0000");
    let inFence = false;
    const kept: string[] = [];
    for (const segment of segments) {
        kept.push(inFence ? "" : segment);
        inFence = !inFence;
    }

    return kept.join("\n").replace(/`[^`\n]*`/g, "");
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
  EntryKindValues.Integration,
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
