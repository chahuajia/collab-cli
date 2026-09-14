import {Issue} from "@/domain/validation/Issue";
import type {Entry} from "@/domain/entry/Entry";
import type {RuleContext} from "@/domain/validation/Rule";

/**
 * S8 要求的五个章节，顺序与命名固定（顺序本身不校验，见 D2）。
 */
const REQUIRED_SECTIONS = ['上下文', '问题', '方案', '反面', '关联'] as const;

/**
 * 从 Markdown body 中提取所有 H2 章节标题。
 *
 * @remarks
 * 匹配规则（D3 / D5）：
 * - 只认行首 `## `（两个 `#` + 一个空格）——拒绝 `#`、`###`、`####`
 * - 标题文本允许尾部空白（如 `## 方案   `）
 * - 拒绝标题后挂字（如 `## 方案说明` 不会被识别为 `方案`）
 * - 不在行首出现的 `## xxx`（如 `文本 ## 方案`）不匹配
 *
 * D7 待办：
 * - TODO: 代码块内的 `## 标题` 目前会被误识别为章节标题。
 *   当前 COLLABORATION 条目没有此情况，待未来引入 Markdown 解析器解决。
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
 * 校验条目 body 是否包含 S8 规定的五个必需章节。
 *
 * @remarks
 * 不变量：
 * - 缺失任一必需章节 → 报 `MissingSection`（error）
 * - 同一必需章节出现 ≥ 2 次 → 报 `DuplicateSection`（error）
 * - 章节顺序任意（D2=B）
 * - 空 body 视为五个章节全缺失（D1=A + D6=A）
 *
 * 不负责：
 * - 章节内容是否为空（应由其他规则负责，如未来的 `sectionNotEmpty`）
 * - 章节内容质量
 * - frontmatter 校验
 *
 * @param entry - 待校验条目
 * @param _context - 未使用；此规则只看单条 entry
 */
export const sectionsPresent = (
    entry: Entry,
    _context: RuleContext,
): readonly Issue[] => {
    const found = extractH2Sections(entry.body);

    // 统计每个标题出现的次数
    const counts = new Map<string, number>();
    for (const name of found) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    const issues: Issue[] = [];
    for (const section of REQUIRED_SECTIONS) {
        const count = counts.get(section) ?? 0;
        if (count === 0) {
            issues.push(Issue.missingSection(entry.path, section));
        } else if (count > 1) {
            issues.push(Issue.duplicateSection(entry.path, section));
        }
    }
    return issues;
};