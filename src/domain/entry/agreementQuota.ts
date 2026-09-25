// src/domain/entry/agreementQuota.ts

/**
 * 约定层的**上限**（契约层的代谢机制）。
 *
 * @remarks
 * 这是全库唯一的"环境型"机制：**让"加"包含"减"的代价**。
 *
 * 为什么只限 `agreement`：协议层是**稀缺**的（每加一条，向未来每一次交互收税），
 * 而技能 / 模式 / 工作流是**手册**，本来就该增长，成本只在检索。
 *
 * 为什么没有 `--force`：绕过它的成本必须高于遵守它的成本 ——
 * 一个便宜的逃生口会让它退化成仪式，那与"没人遵守"是同一类失效。
 */
export const AGREEMENT_LIMIT = 10;

/**
 * 还能不能再加一条约定？不能则给出**怎么腾位置**的话术。
 *
 * @param occupying - 当前**占路由索引位**的约定条数（判据同 `buildCatalog`：`isRouted`）
 * @returns 已满时返回完整的人话（含出路）；未满返回 `null`
 *
 * @remarks
 * 这条判断原先写在 CLI 命令里（`cmdNew` 的 if），于是"配额的判据"和"配额的话术"
 * 都埋在 I/O 与参数解析中间，既不能被单测直接钉住，也不属于任何一层。
 * 它是一条**关于知识库的规则** → 归 domain。
 */
export function agreementQuotaExceeded(occupying: number): string | null {
  if (occupying < AGREEMENT_LIMIT) return null;
  return (
    `约定已达上限（${occupying}/${AGREEMENT_LIMIT}）。` +
    `约定是承重墙 —— 每加一条，都在向未来每一次交互收税。\n` +
    `先让一条退役（退出路由索引，文件与 git 历史保留）：\n` +
    `  collab retire <id> --reason "<过时|重复|表达差|未成熟>: <证据>"\n` +
    `也可以并入已有条目。若这一条确实不可谈判，` +
    `它多半该改写成 工作流 / 模式 / 集成层 的模样。`
  );
}
