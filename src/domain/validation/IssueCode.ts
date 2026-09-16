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
    /** 重复章节 */
    DuplicateSection: 'DUPLICATE_SECTION',
    /** 目录有没有 index */
    MissingIndex:'MISSING_INDEX',
    /** 条目是不在index 里 */
    MissingFromIndex: 'MISSING_FROM_INDEX',
    /** index引用不存在条目 */
    DanglingIndexEntry: 'DANGLING_INDEX_ENTRY',

    // ─────────────────────────────────────────────
    // collab apply —— bundle 落盘通道的问题
    // ─────────────────────────────────────────────
    /** bundle 本身不可用（JSON / 形状 / 空的 files） */
    BundleInvalid: 'BUNDLE_INVALID',
    /** bundle 中的路径不安全（绝对路径 / `..` / 不在白名单） */
    BundlePathInvalid: 'BUNDLE_PATH_INVALID',
    /** bundle 中的内容为空或纯空白 */
    BundleEmptyContent: 'BUNDLE_EMPTY_CONTENT',
    /** 声明的 sha256 与内容实际哈希不符 */
    BundleHashMismatch: 'BUNDLE_HASH_MISMATCH',
    /** bundle 的意图与工作区当前状态冲突 */
    BundleConflict: 'BUNDLE_CONFLICT',

    /** id 不是文件名的前缀（链接按文件名解析，两者必须同源） */
    IdFileNameMismatch: 'ID_FILE_NAME_MISMATCH',

    /** id 没有登记进 aliases（渲染层靠 alias 解析 id 形式的链接） */
    IdNotInAliases: 'ID_NOT_IN_ALIASES',

    /** catalog.json 与工作区不一致（生成物过期） */
    CatalogStale: 'CATALOG_STALE',

    /** 顶层目录未在基座契约里声明（等于悄悄改基座） */
    UndeclaredDir: 'UNDECLARED_DIR',

    // ─────────────────────────────────────────────
    // collab parse —— A17 文本协议的切分问题
    // ─────────────────────────────────────────────
    /** 文本结构不合法（块外有内容 / 未闭合 / 空输入） */
    ParseInvalid: 'PARSE_INVALID',
    /** 块内容为空或纯空白 */
    ParseEmptyBlock: 'PARSE_EMPTY_BLOCK',
    /** 同一 path 出现两次 */
    ParseDuplicatePath: 'PARSE_DUPLICATE_PATH',

} as const;

export type IssueCode = ValueOf<typeof IssueCodeValues>;
