// domain/entry/RawFrontmatter.ts
import type { EntryKind, EntryStatus } from './types.js';

/**
 * 边界层产物：字段已通过形状校验，但尚未构造为值对象。
 * - type/status：已是枚举（边界层校验）
 * - id/created/updated：仍是 string（业务不变量待校验）
 */
export interface RawFrontmatter {
    readonly id: string;
    readonly type: EntryKind;
    readonly status: EntryStatus;
    readonly created: string;
    readonly updated: string;
    readonly domains?: readonly string[];
    readonly 'applies-to'?: readonly string[];
    readonly supersedes?: string | null;
    readonly author?: string;
    readonly 'co-authors'?: readonly string[];
    readonly focus?: readonly string[];
    readonly provenance?: string;
}