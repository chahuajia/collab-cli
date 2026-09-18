import type { Frontmatter } from './Frontmatter';

/**
 * **不进入路由索引**的状态。
 *
 * @remarks
 * `dormant` 的正确语义不是"灰掉但仍占索引位"，而是**从路由索引中除名**
 * （见 `meta/pruning-policy`）。死亡成本归零，抵抗删除才没有理由。
 *
 * 只排除"明确退役"的两种；`draft` 仍然进入 —— 那是"在用但未定稿"，不是退役。
 */
export const RETIRED_STATUSES: ReadonlySet<string> = new Set([
    'dormant',
    'deprecated',
]);

/**
 * 这条条目是否**占路由索引位**。
 *
 * @remarks
 * **唯一判据。** `buildCatalog`（哪条进 catalog.json）与 `collab new`
 * 的约定层配额（还能不能加）必须用同一段代码 —— 否则会出现
 * "配额说满了、路由表里却只有 3 条"这类自相矛盾，而人只能靠阅读去发现它。
 *
 * 两条退役路径，含义不同，都退出路由：
 * - `status` 落到 dormant/deprecated —— 被冷落（没人引用、内容过时）。
 * - `enforced` 非空 —— **已毕业**：内容已被测试/工具固化，
 *   从此跑测试就遵守它，不需要任何人再读它（见 `patterns/policy-without-mechanism`
 *   讨论的"条目 → 测试"输送带）。
 */
export function isRouted(frontmatter: Frontmatter): boolean {
    if (RETIRED_STATUSES.has(frontmatter.status)) return false;
    if (frontmatter.enforced !== null) return false;
    return true;
}
