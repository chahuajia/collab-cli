import {EntryKindDir} from "@/domain/entry/types";
import {Issue} from "@/domain/validation/Issue";
import type {Entry} from "@/domain/entry/Entry";
import type {RuleContext} from "@/domain/validation/Rule";

/**
 * 校验条目的类型与其所在目录是否匹配。
 *
 * @remarks
 * **领域规则**：每种 EntryKind 有约定的目录（见 `EntryKindDir`）。
 * 条目的 `frontmatter.type` 必须与所在目录对应的类型一致。
 *
 * **不变量**：
 * - 路径**必须**包含期望目录 → 通过。
 * - 其他任何情况 → 报 `TypeDirMismatch`。
 *
 * **前置条件**：此规则假设 loader 层已经过滤掉非条目文件
 * （如 `_index.md`、`README.md`、临时草稿）。如果 loader 层未过滤，
 * 这些文件的路径不匹配任何 EntryKindDir，会被此规则报错——
 * 这是 loader 层的责任，不是规则层的问题。
 *
 * @param entry - 待校验的条目
 * @param _context - 未使用；此规则只看单条 entry 信息
 * @returns Issue 列表；无问题时为空数组
 *
 * @example
 * ```ts
 * // 通过
 * typeMatchesDir(makeEntry({ type: 'Skill', path: 'skills/S12.md' }), ctx);
 * // → []
 *
 * // 报错：type 与目录不一致
 * typeMatchesDir(makeEntry({ type: 'Skill', path: 'workflows/S12.md' }), ctx);
 * // → [TypeDirMismatch]
 *
 * // 报错：路径不在任何已知目录下
 * typeMatchesDir(makeEntry({ type: 'Skill', path: 'drafts/S12.md' }), ctx);
 * // → [TypeDirMismatch]
 * ```
 */
export const typeMatchesDir = (entry: Entry, _context: RuleContext): readonly Issue[] => {
    // 统一路径分隔符：Windows 下可能拿到 "skills\S12.md"
    const normalized = entry.path.replace(/\\/g, '/');

    // 期望目录（基于条目自身的 type）
    const expectedDir = EntryKindDir[entry.frontmatter.type];

    // 通过：路径包含期望目录
    if (normalized.includes(expectedDir + '/')) {
        return [];
    }

    // 其他一切情况都报错——不匹配就是问题
    return [
        Issue.typeDirMismatch(
            entry.path,
            entry.frontmatter.type,   // 实际类型
            expectedDir,              // 期望目录
        ),
    ];
};