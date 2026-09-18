// src/domain/validation/Rule.ts
import type {Issue} from "./Issue";
import type {Entry} from "../entry/Entry";

/**
 * 规则运行的上下文。
 *
 * @remarks
 * 用于跨条目的规则（如 deadLink 需要看全部条目）。
 */
export interface RuleContext {
  readonly allEntryIds: ReadonlySet<string>;
  readonly allEntries: readonly Entry[];

  /**
   * 所有 `_index.md` 的内容，按所在目录路径索引。
   *
   * @remarks
   * key 是目录相对路径（如 `skills`、`meta/decision-records`），
   * value 是 `_index.md` 的完整内容。
   */
  readonly indexFiles: ReadonlyMap<string, string>;
  readonly allMarkdownPaths: ReadonlySet<string>;

  /**
   * `catalog.json` 的原始内容（生成物）。
   *
   * @remarks
   * `undefined` = 不检查；`null` = 文件不存在；`string` = 内容（可能过期）。
   */
  readonly catalogJson?: string | null | undefined;

  /** 仓库根 Markdown 的内容（`AGENTS.md` / `ROOT.md` / `README.md`）。 */
  readonly rootDocs?: ReadonlyMap<string, string> | undefined;

  /**
   * kind 目录之外的 `_index.md`（如 `domains/architecture/_index.md`）。
   *
   * @remarks
   * 它们同样是路由面（那张"症状 → 先读"表），但不属于任何 EntryKind，
   * 所以不在 `indexFiles` 里。见 `routingToGraduated` 规则。
   */
  readonly extraDocs?: ReadonlyMap<string, string> | undefined;
}

/**
 * 逐条目规则：接收单个条目，输出该条目相关的 Issue。
 */
export type Rule = (entry: Entry, context: RuleContext) => readonly Issue[];

/**
 * 全局规则：只看整个工作区，不针对单个条目。
 *
 * @remarks
 * 用于目录级检查（如"每个目录是否有 index"）。
 * 与 `Rule` 的关键差异：签名中没有 `entry` 参数。
 */
export type GlobalRule = (context: RuleContext) => readonly Issue[];

/**
 * 规则注册表：把两类规则打包，供 UseCase 注入。
 */
export interface RuleRegistry {
    readonly perEntry: readonly Rule[];
    readonly global: readonly GlobalRule[];
}
