import { Issue } from "@/domain/validation/Issue";
import { fileNameOf } from "@/domain/validation/resolvesRef";
import type { Entry } from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * id 与文件名之间的分隔符。
 *
 * @remarks
 * 用 `-` 而不是"任意前缀"，是为了**避免歧义**：
 * `S2` 若按裸前缀匹配，会同时命中 `S2-csp-reporting` 与 `S20-...`。
 */
const PREFIX_SEPARATOR = "-";

/**
 * 校验 `frontmatter.id` 是**文件名的前缀**（以 `-` 为界）。
 *
 * @remarks
 * 不变量：`<id>` 或 `<id>-<slug>` —— 也就是文件名要么就是 id，要么以 `id-` 开头。
 *
 * **为什么需要这条**（2026-09-16）：
 * 链接按**文件名**解析。如果 id 与文件名脱钩（如文件叫 `S36-xxx.md` 而 `id: S37`），
 * 那么按 id 写的引用、按 id 建索引、按 id 找文件——全都会指向一个不存在的东西。
 * 这条规则把"id 与文件名同源"变成**可验收**的，而不是靠约定。
 *
 * @param entry - 待校验条目
 * @param _context - 未使用；此规则只看单条 entry 的 id 与路径
 */
export const idMatchesFileName = (
  entry: Entry,
  _context: RuleContext,
): readonly Issue[] => {
  const id = entry.frontmatter.id;
  const fileName = fileNameOf(entry.path);

  if (fileName === id || fileName.startsWith(id + PREFIX_SEPARATOR)) return [];

  return [Issue.idFileNameMismatch(entry.path, id, fileName)];
};
