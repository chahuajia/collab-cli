import { lastSegmentOf } from "@/domain/validation/rules/_shared";
import type { Entry } from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";



/**
 * 判断"引用是否指向某个已存在的实体"。
 *
 * @remarks
 * 四种匹配（任一命中即合法）：
 * 1. **短 id**：`A1` → `allEntryIds.has('A1')`
 * 2. **完整路径**：`agreements/A1-output-format` → `allMarkdownPaths.has(完整)`
 * 3. **末段短 id**：`patterns/rooted-graph` → `allEntryIds.has('rooted-graph')`
 * 4. **文件名匹配**：`A1-output-format` → 某 `allMarkdownPaths` 的末段为 `A1-output-format`
 *
 * **性能**：第 4 步 O(N) —— 对当前规模可接受。
 * 未来规模大时，可给 `RuleContext` 加"末段索引"。
 *
 * @see refersTo —— 用于 `checkIndexForward`（判据是"指向给定 entry"）
 */
export function resolvesRef(ref: string, context: RuleContext): boolean {
  // 1. 短 id 直接匹配
  if (context.allEntryIds.has(ref)) return true;

  // 2. 完整路径直接匹配
  if (context.allMarkdownPaths.has(ref)) return true;

  // 3 & 4. 末段匹配
  const last = lastSegmentOf(ref);

  if (context.allEntryIds.has(last)) return true;

  for (const p of context.allMarkdownPaths) {
    if (lastSegmentOf(p) === last) return true;
  }

  return false;
}

/**
 * 取条目路径的"文件名"（末段去掉 `.md`）。
 *
 * @example
 * - `skills/S1-h2-output.md` → `S1-h2-output`
 * - `meta/decision-records/ADR-0001.md` → `ADR-0001`
 *
 * @remarks
 * 先统一分隔符 —— Windows 上 `entry.path` 可能是 `skills\S1-h2-output.md`，
 * 而 `lastSegmentOf` 只按 `/` 切分（与 `typeMatchesDir` / `dirOfPath` 同一约定）。
 */
export function fileNameOf(path: string): string {
  return lastSegmentOf(path.replace(/\\/g, "/")).replace(/\.md$/, "");
}

/**
 * 引用是否指向"这个 id / 这个文件名"的条目。
 *
 * @remarks
 * **这是全项目唯一的引用匹配规则。**
 *
 * 校验（`refersTo`）与索引渲染（`renderIndex`）都必须走这里 ——
 * 规则一旦出现两份，就会出现 2026-09-16 实测到的那种事故：
 * `validate` 认为 `[[S1-h2-output]]` 合法，而 `index` 把它当悬空行删掉，
 * 顺手丢掉人工维护的名称/领域/状态列（真实库 54 行）。
 *
 * @param ref - `_index.md` 或正文里的引用原文
 * @param id - 条目的 `frontmatter.id`（如 `S1`）
 * @param fileName - 条目的文件名（如 `S1-h2-output`）
 */
export function refersToIdentity(
  ref: string,
  id: string,
  fileName: string,
): boolean {
  const last = lastSegmentOf(ref);
  return last === id || last === fileName;
}

/**
 * 判断"引用是否指向给定的条目"。
 *
 * @remarks
 * 用于 `checkIndexForward` —— 它需要"本条目是否被 index 列出"。
 *
 * 两种匹配（任一命中）：
 * 1. **短 id**：`[[A1]]` → `A1` === `entry.frontmatter.id`
 * 2. **文件名**：`[[A1-output-format]]` → `A1-output-format` === entry 的文件名（去 .md）
 *
 * **两者都认** —— 因为 `_index.md` 里可能写短 id、也可能写文件名。
 */
export function refersTo(ref: string, entry: Entry): boolean {
  return refersToIdentity(
    ref,
    entry.frontmatter.id,
    fileNameOf(entry.path),
  );
}
