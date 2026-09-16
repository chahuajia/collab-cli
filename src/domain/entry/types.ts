// src/domain/entry/types.ts
import type { ValueOf } from '@/shared/types';

/**
 * 条目类型值域。
 *
 * @remarks
 * 命名采用 `*Values` 后缀，因为这个名字表示"值的集合"，而非单一值的类型。
 * 类型 `EntryKind` 单独导出，保持简洁。
 */
export const EntryKindValues = {
    Agreement: 'agreement',
    Workflow: 'workflow',
    Skill: 'skill',
    Pattern: 'pattern',
    Adr: 'adr',
    Integration: 'integration',
} as const;

/**
 * 条目类型的联合类型。
 */
export type EntryKind = ValueOf<typeof EntryKindValues>;

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
 * 用 `Record<EntryKind, string>` 而非散落的字符串，保证：
 * - 加新 EntryKind 时，TS 编译期报错，强制补全前缀。
 * - 前缀的拥有者是 EntryKind，命名空间清晰。
 */
export const EntryPrefix: Record<EntryKind, EntryIdPrefix> = {
    [EntryKindValues.Agreement]: 'A',
    [EntryKindValues.Workflow]: 'W',
    [EntryKindValues.Skill]: 'S',
    [EntryKindValues.Pattern]: '',
    [EntryKindValues.Adr]: 'ADR-',
    [EntryKindValues.Integration]: '',
};

/**
 * 每个类型的合法 id 形态。
 */
export type EntryIdFor<T extends EntryKind> =
    T extends 'agreement' ? `A${number}` :
        T extends 'workflow' ? `W${number}` :
            T extends 'skill' ? `S${number}` :
                T extends 'adr' ? `ADR-${string}` :
                    T extends 'pattern' ? `${Lowercase<string>}` :
                        T extends 'integration' ? `${Lowercase<string>}` :
                            never;

export function isEntryIdFor<T extends EntryKind>(id: string, type: T): id is EntryIdFor<T> {
    // 运行时校验
    const prefix = EntryPrefix[type];
    return prefix === '' || id.startsWith(prefix);
}


/**
 * 每种 EntryKind 条目所在的目录。
 *
 * @remarks
 * 与 `EntryPrefix` 对称：
 * - `EntryPrefix` 约束 **id 的形态**（如 skill 的 id 必须以 S 开头）。
 * - `EntryKindDir` 约束 **路径的形态**（如 skill 必须放在 skills/ 下）。
 *
 * 加新 EntryKind 时，编译期会强制补全此映射。
 */
export const EntryKindDir: Record<EntryKind, string> = {
    [EntryKindValues.Agreement]: 'agreements',
    [EntryKindValues.Workflow]: 'workflows',
    [EntryKindValues.Skill]: 'skills',
    [EntryKindValues.Pattern]: 'patterns',
    [EntryKindValues.Adr]: 'meta/decision-records',
    [EntryKindValues.Integration]: 'integrations',
};

function isEntryKind(value: string): value is EntryKind {
  return value in EntryKindDir;
}
/**
 * 目录名 → 期望的 EntryKind。
 *
 * @remarks
 * 用于反向校验：从 `entry.path` 推断"这个条目应该是什么类型"，
 * 再与 `entry.frontmatter.type` 比较。
 *
 * 未识别的目录返回 undefined——这类路径由其他规则或人工处理。
 */
const DirToType: Readonly<Record<string, EntryKind>> = Object.freeze(
  Object.entries(EntryKindDir).reduce<Record<string, EntryKind>>(
    (acc, [type, dir]) => {
      if (isEntryKind(type)) {
        acc[dir] = type;
      }
      return acc;
    },
    {},
  ),
);

export function entryTypeForDir(dir: string): EntryKind | undefined {
    return DirToType[dir];
}

export const EntryStatusValues = {
  // 通用（适用于 agreement / workflow / skill / pattern）
  Draft: 'draft',
  Active: 'active',
  Dormant: 'dormant',
  Deprecated: 'deprecated',
  // ADR 专属
  Proposed: 'proposed',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Withdrawn: 'withdrawn',
  Superseded: 'superseded',
} as const;

export type EntryStatus = ValueOf<typeof EntryStatusValues>;

/** 通用 status 集合（非 ADR 类型使用）。 */
export const CommonStatuses = [
  EntryStatusValues.Draft,
  EntryStatusValues.Active,
  EntryStatusValues.Dormant,
  EntryStatusValues.Deprecated,
] as const;

/** ADR 专属 status 集合。 */
export const AdrStatuses = [
  EntryStatusValues.Proposed,
  EntryStatusValues.Accepted,
  EntryStatusValues.Rejected,
  EntryStatusValues.Withdrawn,
  EntryStatusValues.Superseded,
] as const;

/**
 * 给定 kind，返回允许的 status 集合。
 */
export function allowedStatusesFor(kind: EntryKind): readonly EntryStatus[] {
  if (kind === EntryKindValues.Adr) return AdrStatuses;
  return CommonStatuses;
}

/**
 * 每种 kind 创建新条目时的默认 status。
 */
export const DefaultStatusFor: Record<EntryKind, EntryStatus> = {
  [EntryKindValues.Agreement]: EntryStatusValues.Draft,
  [EntryKindValues.Workflow]: EntryStatusValues.Draft,
  [EntryKindValues.Skill]: EntryStatusValues.Draft,
  [EntryKindValues.Pattern]: EntryStatusValues.Draft,
  [EntryKindValues.Integration]: EntryStatusValues.Draft,
  [EntryKindValues.Adr]: EntryStatusValues.Proposed,  // ← ADR 专属
};
