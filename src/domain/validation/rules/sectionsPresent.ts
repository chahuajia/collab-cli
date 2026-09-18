import { type EntryKind, EntryKindValues } from "@/domain/entry/types";
import {Issue} from "@/domain/validation/Issue";
import type {Entry} from "@/domain/entry/Entry";
import type {RuleContext} from "@/domain/validation/Rule";
/**
 * 每种 kind 的必需章节。
 *
 * @remarks
 * **两种"章节体系"**：
 * - **模式语言格式**（agreement / workflow / skill / pattern）——
 *   上下文 / 问题 / 方案 / 反面 / 关联
 * - **ADR 格式**（adr）——
 *   背景 / 决策 / 后果 / 替代方案 / 关联
 *
 * **为什么按 kind 分**：
 * - 模式语言：源自 Alexander 的《建筑模式语言》——**通用问题解决结构**。
 * - ADR：源自 Michael Nygard 的经典格式 —— **决策记录结构**。
 * - 两者"语义结构"不同 —— 强行统一会让 ADR "不像 ADR"。
 *
 * @see S8 模式语言格式
 * @see ADR（Michael Nygard / MADR 模板）
 */
const SECTIONS_BY_KIND: Record<EntryKind, readonly string[]> = {
  [EntryKindValues.Agreement]: ["上下文", "问题", "方案", "反面", "关联"],
  [EntryKindValues.Workflow]: ["上下文", "问题", "方案", "反面", "关联"],
  [EntryKindValues.Skill]: ["上下文", "问题", "方案", "反面", "关联"],
  [EntryKindValues.Pattern]: ["上下文", "问题", "方案", "反面", "关联"],
  [EntryKindValues.Integration]: ["上下文", "问题", "方案", "反面", "关联"],
  [EntryKindValues.Adr]: ["背景", "决策", "后果", "替代方案", "关联"],
};

/**
 * 从 Markdown body 中提取所有 H2 章节标题。
 *
 * @remarks
 * 匹配规则（D3 / D5）：
 * - 只认行首 `## `（两个 `#` + 一个空格）—— 拒绝 `#`、`###`、`####`
 * - 标题文本允许尾部空白（如 `## 方案   `）
 * - 拒绝标题后挂字（如 `## 方案说明` 不会被识别为 `方案`）
 * - 不在行首出现的 `## xxx` 不匹配
 *
 * D7 待办：
 * - TODO: 代码块内的 `## 标题` 目前会被误识别为章节标题。
 */
function extractH2Sections(body: string): string[] {
  const pattern = /^## (.+?)\s*$/gm;
  const sections: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const name = match[1];
    if (name !== undefined) sections.push(name);
  }
  return sections;
}

/**
 * 校验条目 body 是否包含其 kind 对应的必需章节。
 *
 * @remarks
 * 不变量：
 * - 缺失任一必需章节 → `MissingSection`（error）
 * - 同一必需章节出现 ≥ 2 次 → `DuplicateSection`（error）
 * - 章节顺序任意
 * - 空 body 视为所有章节缺失
 *
 * **按 kind 分**：
 * - `SECTIONS_BY_KIND[entry.frontmatter.type]` —— 决定"必需哪些章节"
 *
 * 不负责：
 * - 章节内容是否为空
 * - 章节内容质量
 * - 非必需章节的额外校验
 */
export const sectionsPresent = (
  entry: Entry,
  _context: RuleContext,
): readonly Issue[] => {
  const requiredSections = SECTIONS_BY_KIND[entry.frontmatter.type];

  const found = extractH2Sections(entry.body);

  // 统计每个标题出现的次数
  const counts = new Map<string, number>();
  for (const name of found) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const issues: Issue[] = [];
  for (const section of requiredSections) {
    const count = counts.get(section) ?? 0;
    if (count === 0) {
      issues.push(Issue.missingSection(entry.path, section));
    } else if (count > 1) {
      issues.push(Issue.duplicateSection(entry.path, section));
    }
  }
  return issues;
};
