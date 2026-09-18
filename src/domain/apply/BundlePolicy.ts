/**
 * `collab apply` 的策略常量（白名单）。
 *
 * @remarks
 * 采用白名单而非黑名单（patterns/allowlist-over-denylist）：
 * 声明"允许写哪里"，而不是穷举"禁止写哪里"。
 */

/**
 * bundle 允许写入的顶层目录。
 *
 * @remarks
 * 这**不是** `EntryKindDir` 的派生值 —— 它更大：
 * - `meta/` 覆盖 `meta/decision-records/` 之外的元层文件（如 `meta/evolution-log.md`）。
 * - `domains/` 与 `inbox/` 目前不是 EntryKind，但是合法的知识库目录。
 *
 * 所以**故意显式列出**：这是产品决策，不是纯派生。
 */
export const AllowedBundleTopLevelDirs = [
  "agreements",
  "workflows",
  "skills",
  "patterns",
  "meta",
  "domains",
  "inbox",
] as const;

/**
 * 一条合法 bundle 路径至少需要的段数。
 *
 * @remarks
 * `skills/S30.md` 是两段；`skills` 只有一段 —— 那指向目录，不是文件。
 */
export const MinBundlePathSegments = 2;
