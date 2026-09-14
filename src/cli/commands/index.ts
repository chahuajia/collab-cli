// src/cli/commands/index.ts
import fs from "node:fs";
import path from "node:path";
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
  const allEntryIds = collectAllEntryIds(collabDir);


  for (const { kind, dir } of targets) {
    const absDir = path.join(collabDir, dir);
    const indexFilePath = path.join(absDir, "_index.md");

    const actualEntries = allEntryIds.get(kind) ?? [];

    const existing = fs.existsSync(indexFilePath)
      ? parseIndex(fs.readFileSync(indexFilePath, "utf8"))
      : null;

    const { content, added, removed } = renderIndex({
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
        outputLines.push(
          `✔ ${dir}/_index.md (added ${added}, removed ${removed})`,
        );
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

/**
 * 一次性加载所有条目，按 kind 分组。
 *
 * @remarks
 * 用 `FileWorkspaceLoader` 作为"条目发现"的唯一真相源——
 * 避免"自己遍历目录"与"Loader 的假设"漂移。
 *
 * 返回 `Map<EntryKind, string[]>`，value 是每个 kind 的 `frontmatter.id` 列表。
 */
function collectAllEntryIds(collabDir: string): Map<EntryKind, string[]> {
  const loader = new FileWorkspaceLoader(collabDir);
  const workspace = loader.load();

  const byKind = new Map<EntryKind, string[]>();
  for (const kind of Object.values(EntryKindValues)) {
    byKind.set(kind, []);
  }

  for (const loaded of workspace.entries) {
    if (loaded.entry === null) continue;
    const normalizedPath = loaded.path.replace(/\\/g, "/");

    for (const kind of Object.values(EntryKindValues)) {
      const dir = EntryKindDir[kind];
      if (normalizedPath.startsWith(dir + "/")) {
        const arr = byKind.get(kind);
        if (arr) arr.push(loaded.entry.frontmatter.id);
        break;
      }
    }
  }

  return byKind;
}