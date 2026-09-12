// src/domain/validation/IssueCode.ts
import type { ValueOf } from '../../shared/types.js';

/**
 * Issue 编码值域。
 *
 * @remarks
 * 用稳定的 SCREAMING_SNAKE_CASE 字符串值：
 * - 便于日志检索与聚合。
 * - 便于国际化（key 稳定）。
 * - 避免中文 code 带来的编码问题。
 */
export const IssueCodeValues = {
    /** 空 ID */
    EmptyId: 'EMPTY_ID',
    /** ID 前缀不匹配 */
    IdPrefixMismatch: 'ID_PREFIX_MISMATCH',
    /** 日期格式无效 */
    InvalidDate: 'INVALID_DATE',
    /** 日期顺序无效 */
    DateOrderInvalid: 'DATE_ORDER_INVALID',
    /** 缺少 Frontmatter */
    MissingFrontmatter: 'MISSING_FRONTMATTER',
    /** YAML 格式无效 */
    InvalidYaml: 'INVALID_YAML',
    /** 类型目录不匹配 */
    TypeDirMismatch: 'TYPE_DIR_MISMATCH',
    /** 缺少章节 */
    MissingSection: 'MISSING_SECTION',
    /** 死链 */
    DeadLink: 'DEAD_LINK',
    /** 重复 ID */
    DuplicateId: 'DUPLICATE_ID',
    /** 形状无效 */
    InvalidShape: 'INVALID_SHAPE',
} as const;

export type IssueCode = ValueOf<typeof IssueCodeValues>;