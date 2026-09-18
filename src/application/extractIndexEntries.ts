import { EntryKindDir, EntryKindValues } from "@/domain/entry/types";
import { fileNameOf } from "@/domain/validation/resolvesRef";
import type { EntryKind } from "@/domain/entry/types";
import type { Workspace } from "@/domain/entry/WorkspaceLoader";

/**
 * 索引里的一个条目 —— **渲染 `_index.md` 所需的最小信息**。
 *
 * @remarks
 * 为什么不是裸 `id`：`_index.md` 的引用有两种合法写法
 * （短 id `[[S1]]` 与文件名 `[[S1-h2-output]]`），判断"已有行是否悬空"
 * 需要同时知道两者。只给 id 会让渲染层被迫自己猜 —— 那正是
 * 2026-09-16 那次事故的成因。
 */
export interface IndexEntry {
  /** `frontmatter.id`（如 `S1`）—— 新行按这个渲染 */
  readonly id: string;
  /** 文件名去掉 `.md`（如 `S1-h2-output`）—— 识别已有行用这个 */
  readonly fileName: string;
}

/**
 * 从 workspace 提取指定 kind 的索引条目。
 *
 * @remarks
 * **应用层查询** —— 无 IO，workspace 由调用方提供。
 * 依赖 `FileWorkspaceLoader` 已递归加载，所以嵌套子目录
 * （如 `skills/advanced/S12.md`）会被计入。
 */
export function extractIndexEntries(
  workspace: Workspace,
  kind: EntryKind,
): IndexEntry[] {
  const dir = EntryKindDir[kind];
  const entries: IndexEntry[] = [];

  for (const loaded of workspace.entries) {
    if (loaded.entry === null) continue;
    const normalized = loaded.path.replace(/\\/g, "/");
    if (!normalized.startsWith(dir + "/")) continue;
    entries.push({
      id: loaded.entry.frontmatter.id,
      fileName: fileNameOf(loaded.path),
    });
  }

  return entries;
}

/**
 * 所有 kind 的索引条目，按 kind 分组。
 */
export function extractAllIndexEntries(
  workspace: Workspace,
): Map<EntryKind, IndexEntry[]> {
  const result = new Map<EntryKind, IndexEntry[]>();
  for (const kind of Object.values(EntryKindValues)) {
    result.set(kind, extractIndexEntries(workspace, kind));
  }
  return result;
}
