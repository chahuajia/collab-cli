import { Issue } from "@/domain/validation/Issue";
import type { RuleContext } from "@/domain/validation/Rule";

/**
 * 基座声明的顶层目录 —— **权威在这一份**（见 `meta/base-contract.md`）。
 *
 * @remarks
 * 为什么放在代码里而不是文档里：**文档不会拦人，代码会。**
 * 文档指向这里，而不是各存一份 —— 否则又是两份真相源。
 *
 * 加目录 = 加 kind = **基座变更**，要走"ADR + 迁移脚本 + validate 归零"。
 */
export const CONTRACT_DIRS = [
  "agreements",
  "workflows",
  "skills",
  "patterns",
  "integrations",
  "meta",
  "domains",
  "rfcs",
  "profiles",
  "templates",
  "inbox",
] as const;

const DECLARED: ReadonlySet<string> = new Set(CONTRACT_DIRS);

/**
 * 校验：**未声明的顶层目录里不得出现文件**。
 *
 * @remarks
 * 这条规则把"冻结基座"从愿望变成约束 —— 在此之前，新建一个顶层目录
 * （比如 `handbook/`）**没有任何东西会拦**，而它等于悄悄改了基座。
 *
 * 只看**含文件的目录**：空目录无害，不必强制存在或删除。
 * 只看**顶层**：嵌套目录（如 `meta/decision-records`）由各个 kind 自行管理。
 *
 * @param context - 校验上下文（需要 `allMarkdownPaths`）
 */
export function contractDirs(context: RuleContext): readonly Issue[] {
  const undeclared = new Set<string>();

  for (const markdownPath of context.allMarkdownPaths) {
    const normalized = markdownPath.replace(/\\/g, "/");
    const slash = normalized.indexOf("/");
    if (slash === -1) continue; // 根目录下的文件（ROOT.md 等）不属于任何目录
    const top = normalized.slice(0, slash);
    if (top.startsWith(".")) continue; // .github / .obsidian 等工具目录
    if (!DECLARED.has(top)) undeclared.add(top);
  }

  return [...undeclared].sort().map((dir) => Issue.undeclaredDir(dir));
}
