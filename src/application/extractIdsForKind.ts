import { extractIndexEntries } from "@/application/extractIndexEntries";
import type { EntryKind } from "@/domain/entry/types";
import type { Workspace } from "@/domain/entry/WorkspaceLoader";

/**
 * 从 workspace 提取指定 kind 的所有 id。
 *
 * @remarks
 * **派生自 `extractIndexEntries`**（"派生优于复制"）——
 * 目录筛选与"文件名"的取法只此一处。
 *
 * 调用方是 `cmdNew`：算下一个 id 时只关心 id，不关心文件名。
 */
export function extractIdsForKind(
  workspace: Workspace,
  kind: EntryKind,
): string[] {
  return extractIndexEntries(workspace, kind).map((entry) => entry.id);
}
