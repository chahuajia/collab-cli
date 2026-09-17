// src/cli/commands/index.ts
import fs from "node:fs";
import path from "node:path";
import { extractAllIndexEntries } from "@/application/extractIndexEntries";
import { findCollabRoot } from "@/cli/lib/findCollabRoot";
import { parseIndex } from "@/cli/lib/parseIndex";
import { renderIndex } from "@/cli/lib/renderIndex";
import {
  type EntryKind,
  EntryKindDir,
  EntryKindValues,
} from "@/domain/entry/types";
import { FileWorkspaceLoader } from "@/infrastructure/fs/FileWorkspaceLoader";

interface Target {
  readonly kind: EntryKind;
  readonly dir: string;
}

/**
 * `collab index [dir]`
 *
 * 更新已知目录的 `_index.md`。增量同步，保留人工列与额外内容。
 */
export async function cmdIndex(args: string[]): Promise<void> {
  const { collabDir } = findCollabRoot(process.cwd());

  const requestedDir = args.find((a) => !a.startsWith("-"));
  const targets = resolveTargets(collabDir, requestedDir);

  const outputLines: string[] = [];
  let totalMissingNames = 0;
  const loader = new FileWorkspaceLoader(collabDir);
  const workspace = loader.load();
  const allEntries = extractAllIndexEntries(workspace);

  for (const { kind, dir } of targets) {
    const absDir = path.join(collabDir, dir);
    const indexFilePath = path.join(absDir, "_index.md");
    const actualEntries = allEntries.get(kind) ?? [];
    const existing = fs.existsSync(indexFilePath)
      ? parseIndex(fs.readFileSync(indexFilePath, "utf8"))
      : null;

    const { content, added, removed, normalized } = renderIndex({
      kind,
      existing,
      actualEntries,
    });

    if (existing === null) {
      fs.writeFileSync(indexFilePath, content, "utf8");
      outputLines.push(`✔ ${dir}/_index.md (created, ${added} entries)`);
      totalMissingNames += added;
    } else {
      const oldContent = fs.readFileSync(indexFilePath, "utf8");
      if (oldContent !== content) {
        fs.writeFileSync(indexFilePath, content, "utf8");
        const parts = [`added ${added}`, `removed ${removed}`];
        if (normalized > 0) parts.push(`normalized ${normalized} to id anchor`);
        outputLines.push(`✔ ${dir}/_index.md (${parts.join(", ")})`);
        totalMissingNames += added;
      } else {
        outputLines.push(`✔ ${dir}/_index.md (no changes)`);
      }
    }
  }

  for (const line of outputLines) {
    console.log(line);
  }

  if (totalMissingNames > 0) {
    console.log("");
    console.log(
      `⚠ ${totalMissingNames} new row(s) need a name. Edit _index.md to fill them.`,
    );
  }
}

function resolveTargets(
  collabDir: string,
  requestedDir: string | undefined,
): Target[] {
  if (requestedDir) {
    const kind = findKindByDir(requestedDir);
    if (!kind) {
      throw new Error(`unknown directory: ${requestedDir}`);
    }
    const absDir = path.join(collabDir, EntryKindDir[kind]);
    if (!fs.existsSync(absDir)) {
      throw new Error(`directory does not exist: ${requestedDir}`);
    }
    return [{ kind, dir: EntryKindDir[kind] }];
  }

  const targets: Target[] = [];
  for (const kind of Object.values(EntryKindValues)) {
    const dir = EntryKindDir[kind];
    const absDir = path.join(collabDir, dir);
    if (fs.existsSync(absDir)) {
      targets.push({ kind, dir });
    }
  }
  return targets;
}

function findKindByDir(dir: string): EntryKind | null {
  for (const kind of Object.values(EntryKindValues)) {
    if (EntryKindDir[kind] === dir) return kind;
  }
  return null;
}
