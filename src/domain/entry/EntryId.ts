// src/domain/entry/EntryId.ts
import {EntryPrefix, type EntryKind} from '@/domain/entry/types'
import { Issue} from '@/domain/validation/Issue.js';
import { type Result, Ok, Err } from '@/shared/Result';

declare const EntryIdBrand: unique symbol;
export type EntryId = string & { readonly [EntryIdBrand]: unique symbol };

/**
 * EntryId 的工厂。
 *
 * @remarks
 * 不变量：id 前缀必须与 type 匹配（如 skill 的 id 必须以 "S" 开头）。
 * 唯一生产者：`EntryId.create`。
 */
export const EntryId = {
    /**
     * 构造 EntryId。
     *
     * @param raw - 原始字符串
     * @param type - 条目类型，用于校验前缀
     * @returns 成功返回 EntryId，失败返回 Issue
     */
    create(raw: string, type: EntryKind): Result<EntryId, Issue> {
        if (!raw) return Err(Issue.emptyId());
        const prefix = EntryPrefix[type];
        
        if (prefix && !raw.startsWith(prefix)) {
            return Err(Issue.idPrefixMismatch(raw, type, prefix));
        }
        return Ok(raw as EntryId);
    },

    /**
     * 值相等比较。
     */
    equals(a: EntryId, b: EntryId): boolean {
        return a === b;
    },
} as const;