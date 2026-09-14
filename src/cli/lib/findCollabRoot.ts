import fs from "node:fs";
import path from "node:path";

export interface CollabRoot {
  readonly collabDir: string;
  readonly gitRoot: string;
}

/**
 * 布局 B 的顶层目录标记。
 *
 * @remarks
 * 这些目录的存在表示"仓库根就是知识库根"。
 * - 与 `EntryKindDir` 的"顶层段"保持一致 —— 但**故意用显式列表**：
 *   列表很少变，且"是否触发布局 B"是**产品决策**（不是纯派生）。
 * - **不包含 `meta`** —— 单独一个 `meta/` 不足以证明"这是知识库"。
 */
const LAYOUT_B_MARKERS = [
  "agreements",
  "skills",
  "workflows",
  "patterns",
] as const;

/**
 * 定位 COLLABORATION 工作区。
 *
 * @remarks
 * 三层优先级：
 * 1. **`COLLAB_DIR` 环境变量**（由 `--dir` 或用户手动设置）—— 最高。
 * 2. **向上找 `.git`** + 布局探测（`COLLABORATION/` 子目录 或 `agreements/` 等）。
 * 3. **报错** —— 附"如何指定"提示。
 *
 * @throws 当环境变量指向无效路径，或向上找找不到工作区时
 */
export function findCollabRoot(startDir: string): CollabRoot {
  // 1. 环境变量优先
  const explicitDir = process.env.COLLAB_DIR;
  if (explicitDir && explicitDir.length > 0) {
    return resolveExplicitDir(explicitDir);
  }

  // 2. 向上找 .git
  return findFromGitRoot(startDir);
}

/**
 * 解析显式指定的目录（`--dir` / `COLLAB_DIR`）。
 *
 * @remarks
 * 支持两种指向：
 * - 指向"仓库根"（内含 `COLLABORATION/` 子目录）→ 返回子目录。
 * - 指向"知识库根"（含 `agreements/` 等）→ 返回自身。
 */
function resolveExplicitDir(rawPath: string): CollabRoot {
  const absPath = path.resolve(rawPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`COLLAB_DIR path does not exist: ${absPath}`);
  }
  if (!fs.statSync(absPath).isDirectory()) {
    throw new Error(`COLLAB_DIR path is not a directory: ${absPath}`);
  }

  // 如果它内部有 COLLABORATION/ 子目录 → 布局 A
  const layoutA = path.join(absPath, "COLLABORATION");
  if (fs.existsSync(layoutA) && fs.statSync(layoutA).isDirectory()) {
    return { collabDir: layoutA, gitRoot: absPath };
  }

  // 否则 —— 假设用户指向的就是知识库根
  // gitRoot 用同一个路径 —— 如果不是 git 仓库，git 相关命令会在调用时失败
  return { collabDir: absPath, gitRoot: absPath };
}

/**
 * 从 `startDir` 向上找 `.git`，并探测两种布局。
 */
function findFromGitRoot(startDir: string): CollabRoot {
  let dir = path.resolve(startDir);

  while (true) {
    const gitDir = path.join(dir, ".git");
    if (fs.existsSync(gitDir)) {
      // 布局 A：`COLLABORATION/` 子目录
      const layoutA = path.join(dir, "COLLABORATION");
      if (fs.existsSync(layoutA) && fs.statSync(layoutA).isDirectory()) {
        return { collabDir: layoutA, gitRoot: dir };
      }

      // 布局 B：顶层有 `agreements/` 等
      const hasLayoutBMarker = LAYOUT_B_MARKERS.some((marker) =>
        fs.existsSync(path.join(dir, marker)),
      );
      if (hasLayoutBMarker) {
        return { collabDir: dir, gitRoot: dir };
      }

      // `.git` 存在但既不是 A 也不是 B
      throw new Error(
        `no COLLABORATION workspace found at ${dir}.\n\n` +
          `Expected one of:\n` +
          `  - a COLLABORATION/ subdirectory (layout A), or\n` +
          `  - agreements/, skills/, workflows/, or patterns/ at the repo root (layout B).\n\n` +
          `You can also specify the workspace explicitly:\n` +
          `  - collab --dir <path> <command>\n` +
          `  - COLLAB_DIR=<path> collab <command>`,
      );
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      // 到根目录还没找到 .git
      throw new Error(
        "not inside a git repository.\n\n" +
          "Run `git init` first, or specify the workspace with --dir/COLLAB_DIR:\n" +
          "  - collab --dir <path> <command>\n" +
          "  - COLLAB_DIR=<path> collab <command>",
      );
    }
    dir = parent;
  }
}
