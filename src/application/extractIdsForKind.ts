import { EntryKindDir } from "@/domain/entry/types";
import type { EntryKind } from "@/domain/entry/types";
import type { Workspace } from "@/domain/entry/WorkspaceLoader";

/**
 * 从 workspace 提取指定 kind 的所有 id。
 *
 * @remarks
 * **应用层查询** —— 从 workspace（已加载）中筛选属于某目录的条目的 id。
 * 无 IO —— workspace 由调用方提供。
 *
 * 依赖 `FileWorkspaceLoader` 已经"递归加载"——
 * 所以嵌套子目录（如 `skills/advanced/S12.md`）会被计入。
 */
export function extractIdsForKind(
  workspace: Workspace,
  kind: EntryKind,
): string[] {
  const dir = EntryKindDir[kind];
  const ids: string[] = [];

  for (const loaded of workspace.entries) {
    if (loaded.entry === null) continue;
    const normalized = loaded.path.replace(/\\/g, "/");
    if (!normalized.startsWith(dir + "/")) continue;
    ids.push(loaded.entry.frontmatter.id);
  }

  return ids;
}
