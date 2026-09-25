import fs from "node:fs";
import path from "node:path";
import { isRepoName, repoRoot } from "@/infrastructure/fs/repoRoots";

/**
 * `enforced` 的形态：`<repo>:<path>`。
 *
 * @remarks
 * 与 `enforcedShape` 规则同一判据 —— 但那边只查**形态**（保持 validate 密闭），
 * 这边查**存在性**（需要跨仓读文件系统，所以只在明确要求时跑）。
 */
const SHAPE = /^([a-z][a-z0-9-]*):([^\s].*)$/;

export type EnforcedResolution =
  | { readonly kind: "resolved"; readonly abs: string; readonly exists: boolean }
  /** 仓名不认识，或本机没有那个仓 —— **不知道**，不是"不存在"。 */
  | { readonly kind: "unresolvable"; readonly reason: string };

/**
 * 把 `enforced` 的值解析成本机绝对路径，并判断它是否存在。
 *
 * @remarks
 * **三态，不是两态**：存在 / 不存在 / **无法判定**。
 * 把"无法判定"当成"不存在"会制造假阳性 —— 在别的机器上（没有那个业务仓）
 * validate 会全红，于是这条检查会被关掉，然后**真正的漂移也没人看了**。
 */
export function resolveEnforced(value: string): EnforcedResolution {
  const m = SHAPE.exec(value);
  if (m === null) {
    return { kind: "unresolvable", reason: "形态不是 <repo>:<path>" };
  }
  const repo = m[1];
  const relPath = m[2];
  if (repo === undefined || relPath === undefined) {
    return { kind: "unresolvable", reason: "形态不是 <repo>:<path>" };
  }

  if (!isRepoName(repo)) {
    return { kind: "unresolvable", reason: `不认识仓名 "${repo}"` };
  }

  // 解析链在 `repoRoots.ts` —— **唯一一份**：`retire --enforced`（写入时查）与
  // `validate --check-enforced`（事后复查）共用它，而且
  // `working-memory/check-freshness` 的"三仓在哪"也走它。
  // 两份必然漂移，而"写入时查的是 A、复查时查的是 B"正是最坏的那种漂移。
  // 刻意**不**做"扫描 workspace 找仓"的通用逻辑 —— 那是为未知规模设计。
  const root = repoRoot(repo);
  if (!fs.existsSync(root)) {
    return { kind: "unresolvable", reason: `仓 "${repo}" 在本机不可达` };
  }

  const abs = path.join(root, relPath);
  return { kind: "resolved", abs, exists: fs.existsSync(abs) };
}
