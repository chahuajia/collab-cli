import { extractIdsForKind } from "@/application/extractIdsForKind";
import { type EntryKind, EntryKindValues } from "@/domain/entry/types";
import type { Workspace } from "@/domain/entry/WorkspaceLoader";

export function extractAllIdsByKind(
  workspace: Workspace,
): Map<EntryKind, string[]> {
  const result = new Map<EntryKind, string[]>();
  for (const kind of Object.values(EntryKindValues)) {
    result.set(kind, extractIdsForKind(workspace, kind));
  }
  return result;
}
