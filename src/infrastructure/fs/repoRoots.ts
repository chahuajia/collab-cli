import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 本机已知的仓名 → 路径。**唯一一份解析链。**
 *
 * @remarks
 * 这条解析链原先有**两份手写的绝对路径**：一份在 `working-memory/check-freshness.mjs`，
 * 一份逐字复制到这里（`REPO_ROOTS`，docstring 还写着"与前者同源"）。
 * **用一句话声明同源，不等于同源** —— 而且后者**随包发布了**：
 * 实测 **npm 上的 `0.5.1`**（`dist/cli/lib/enforcedTargets.js`）里就是**作者的三个盘符**。
 * 本文刻意不再写出那些字面量 —— 注释也会随包走。
 *
 * 三个问题叠在一起：
 * - **机器专属路径进公开包**：别人装上拿到的默认值指向一个不存在的盘符；
 * - **同一事实写两处必然漂移**（[[patterns/derivation-over-copy]]）；
 * - **默认值不是"用户已经会的那条链"**：路径的链应当是
 *   `env > 可推导/配置 > 硬失败`，而不是"作者的磁盘布局"。
 *
 * 现在的链（**顺序即语义**）：
 * 1. 环境变量（`COLLAB_CLI_DIR` / `COLLAB_KB_DIR` / `EVOLUTIONARY_DIR`）——
 *    名字保留，因为文档与 KB 的 `enforced` 用法已经引用它们；
 * 2. `COLLAB_PROJECTS_DIR`，或**从本模块位置推导**的共同父目录，
 *    再拼上**一处声明**的相对布局（`REPO_SUBPATH`）；
 * 3. 自己这个仓（`collab-cli`）先认"本模块所在的 checkout"——**由位置推导，放哪都对**。
 *
 * 返回的是**候选路径，不保证存在**。判断"在不在"是调用方的事，
 * 而且必须保持三态：存在 / 不存在 / **无法判定**（见 `enforcedTargets.ts` 的 `unresolvable`）。
 */
export const REPO_NAMES = ["collab-cli", "collaboration", "evolutionary"] as const;

export type RepoName = (typeof REPO_NAMES)[number];

/** 逐仓的环境变量名。报错信息、文档、测试都引用这张表。 */
export const REPO_ENV_VARS: Record<RepoName, string> = {
  "collab-cli": "COLLAB_CLI_DIR",
  collaboration: "COLLAB_KB_DIR",
  evolutionary: "EVOLUTIONARY_DIR",
};

/** 共同父目录的环境变量名（三个仓不在一起时，只设这一个就够）。 */
export const PROJECTS_DIR_ENV = "COLLAB_PROJECTS_DIR";

/**
 * 三仓在**共同父目录**下的相对布局。
 *
 * @remarks
 * 这是"本机布局"的**声明处 —— 只有这一处**。搬动仓库时改这里，或设
 * `COLLAB_PROJECTS_DIR`（后者不改代码）。
 */
const REPO_SUBPATH: Record<RepoName, string> = {
  "collab-cli": "collab-cli/collab-cli",
  collaboration: "collaboration_aggregate/collaboration",
  evolutionary: "evolutionary_start/evolutionary",
};

/** 本包（= 本仓）根目录：`src/**` 与 `dist/**` 都是上溯三层。 */
const PACKAGE_ROOT: string = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const SELF: RepoName = "collab-cli";

/**
 * 「这是一份 checkout」而不是「被装进 node_modules 的一份包」。
 *
 * @remarks
 * 判据是 `.git` 在不在。装进 `node_modules` 的包没有 `.git` ——
 * 于是 npm 用户不会被误导成"我的 collab-cli 仓就是那个包目录"。
 */
function isCheckout(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".git"));
}

/**
 * 三仓的**共同父目录**（候选值）。
 *
 * @remarks
 * `COLLAB_PROJECTS_DIR` 优先；没设就按本模块位置推导。
 * 推导出来的值在 npm 安装场景下没有意义 —— 但那时三个子路径都不存在，
 * 调用方会得到"无法判定"，而不是一个**假的**路径。
 */
export function projectsRoot(): string {
  const explicit = process.env[PROJECTS_DIR_ENV];
  if (explicit !== undefined && explicit.length > 0) return explicit;
  return path.resolve(PACKAGE_ROOT, "..", "..");
}

/** 仓名是不是我们认识的那三个。 */
export function isRepoName(value: string): value is RepoName {
  return REPO_NAMES.some((name) => name === value);
}

/**
 * 仓名 → 本机候选路径。
 *
 * @remarks
 * **自己优先用"模块所在的 checkout"**：这一条由位置推导，仓库搬到哪都对，
 * 不需要任何配置。其余两个仓才依赖 `REPO_SUBPATH` 声明的布局。
 */
export function repoRoot(name: RepoName): string {
  const override = process.env[REPO_ENV_VARS[name]];
  if (override !== undefined && override.length > 0) return override;
  if (name === SELF && isCheckout(PACKAGE_ROOT)) return PACKAGE_ROOT;
  return path.join(projectsRoot(), REPO_SUBPATH[name]);
}
