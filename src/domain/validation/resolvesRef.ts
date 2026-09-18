import { lastSegmentOf } from "@/domain/validation/rules/_shared";
import type { Entry } from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";



/**
 * 判断"引用是否指向某个已存在的实体"。
 *
 * @remarks
 * 三种匹配（任一命中即合法）：
 * 1. **完整路径**：`agreements/A1-output-format` → `allMarkdownPaths.has(完整)`
 * 2. **末段 = 文件名**：`A1-output-format`、`patterns/rooted-graph`
 * 3. **末段 = id**：`A1` —— **前提是 id 已登记进 `aliases`**（由 `idIsAlias` 规则强制）。
 *    渲染层（Obsidian）靠 alias 解析 id 形式的链接；没有那条规则，
 *    "忘了写 aliases" 就会静默断链 —— 这正是历史上那批 id 断链的成因。
 *
 * **推荐 id 形式**：id 是不可变快照（ADR-0009），语义后缀改名时链接存活。
 * 文件名形式在 Obsidian 里由编辑器自动改写，但在 **git / CLI / 静态站点**里不会。
 *
 * **性能**：末段匹配 O(N) —— 对当前规模可接受。
 * 未来规模大时，可给 `RuleContext` 加"末段索引"。
 *
 * @see refersTo —— 用于 `checkIndexForward`（判据是"指向给定 entry"）
 */
export function resolvesRef(ref: string, context: RuleContext): boolean {
  // 1. 完整路径直接匹配
  if (context.allMarkdownPaths.has(ref)) return true;

  // 2. 末段匹配：id 或文件名
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
 * 引用是否指向"这个 id 或这个文件名"的条目。
 *
 * @remarks
 * **这是全项目唯一的引用匹配规则** —— 校验（`refersTo`）与索引渲染
 * （`renderIndex`）都必须走这里。规则一旦出现两份，就会出现
 * "validate 说合法、index 却当悬空行删掉"的事故。
 *
 * 两种形式都认，但**推荐 id**：它是不可变快照，改名不失效。
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
 * 两种匹配（任一命中）：**id**（`A1`）或 **文件名**（`A1-output-format`）。
 *
 * 推荐 id：它是不可变快照（ADR-0009），语义后缀改名时链接存活。
 */
export function refersTo(ref: string, entry: Entry): boolean {
  return refersToIdentity(ref, entry.frontmatter.id, fileNameOf(entry.path));
}
