// src/domain/entry/types.ts
import type { ValueOf } from '@/shared/types';

/**
 * 条目类型值域。
 *
 * @remarks
 * 命名采用 `*Values` 后缀，因为这个名字表示"值的集合"，而非单一值的类型。
 * 类型 `EntryType` 单独导出，保持简洁。
 */
export const EntryTypeValues = {
    Agreement: 'agreement',
    Workflow: 'workflow',
    Skill: 'skill',
    Pattern: 'pattern',
    Adr: 'adr',
} as const;

/**
 * 条目类型的联合类型。
 */
export type EntryType = ValueOf<typeof EntryTypeValues>;

/**
 * 条目状态值域。
 */
export const EntryStatusValues = {
    Draft: 'draft',
    Active: 'active',
    Dormant: 'dormant',
    Deprecated: 'deprecated',
} as const;

/**
 * 条目状态的联合类型。
 */
export type EntryStatus = ValueOf<typeof EntryStatusValues>;

/**
 * 每种类型允许的 id 前缀。
 *
 * @remarks
 * 前缀是"标识符的开头几个字符"，用于快速判断类型。
 * Pattern 类型无前缀（用空串表示）。
 */
export type EntryIdPrefix = 'A' | 'W' | 'S' | 'ADR-' | '';

/**
 * 每个类型的合法 id 形态。
 */
export type EntryIdShape =
    | `A${number}`       // A1, A2, ...
    | `W${number}`       // W1, W2, ...
    | `S${number}`       // S1, S2, ...
    | `ADR-${string}`    // ADR-0001
    | Lowercase<string>; // pattern 的 kebab-case 名字

/**
 * 每种类型的 id 前缀。
 *
 * @remarks
 * 用 `Record<EntryType, string>` 而非散落的字符串，保证：
 * - 加新 EntryType 时，TS 编译期报错，强制补全前缀。
 * - 前缀的拥有者是 EntryType，命名空间清晰。
 */
export const EntryPrefix: Record<EntryType, EntryIdPrefix> = {
    [EntryTypeValues.Agreement]: 'A',
    [EntryTypeValues.Workflow]: 'W',
    [EntryTypeValues.Skill]: 'S',
    [EntryTypeValues.Pattern]: '',
    [EntryTypeValues.Adr]: 'ADR-',
};

/**
 * 每个类型的合法 id 形态。
 */
export type EntryIdFor<T extends EntryType> =
    T extends 'agreement' ? `A${number}` :
        T extends 'workflow' ? `W${number}` :
            T extends 'skill' ? `S${number}` :
                T extends 'adr' ? `ADR-${string}` :
                    T extends 'pattern' ? `${Lowercase<string>}` :
                        never;

export function isEntryIdFor<T extends EntryType>(id: string, type: T): id is EntryIdFor<T> {
    // 运行时校验
    const prefix = EntryPrefix[type];
    return prefix === '' || id.startsWith(prefix);
}