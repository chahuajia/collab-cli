// src/cli/lib/templates.ts
import { stringify as stringifyYaml } from 'yaml';
import { EntryKindValues } from '../../domain/entry/types.js';
import { formatMarkdown } from './formatEntry.js';
import type { EntryKind } from '../../domain/entry/types.js';

/**
 * 五个固定章节的空骨架。
 *
 * @remarks
 * 与 S8 的章节命名严格一致——`sectionsPresent` 规则会校验。
 */
const EMPTY_BODY = [
    '## 上下文',
    '',
    '## 问题',
    '',
    '## 方案',
    '',
    '## 反面',
    '',
    '## 关联',
    '',
].join('\n');

export interface BuildTemplateArgs {
    readonly type: EntryKind;
    readonly id: string;
    readonly author: string;
    /** 覆盖默认的今日日期（用于测试）。格式 YYYY-MM-DD。 */
    readonly today?: string;
}

/**
 * 生成条目文件的完整内容。
 *
 * @remarks
 * 结构：
 * 1. YAML frontmatter（字段顺序固定，便于人工阅读）
 * 2. 空章节骨架（用 Prettier 格式化，失败则原样）
 */
export async function buildTemplate(args: BuildTemplateArgs): Promise<string> {
    const today = args.today ?? localDate();
    const frontmatter = buildFrontmatter(args.type, args.id, args.author, today);
    const yamlText = stringifyYaml(frontmatter, { lineWidth: 0 });
    const body = await formatMarkdown(EMPTY_BODY);
    return `---\n${yamlText}---\n\n${body}`;
}

const DATE_PART_WIDTH = 2;
/**
 * 本地时区的今日日期，格式 YYYY-MM-DD。
 */
function localDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(DATE_PART_WIDTH, '0');
    const day = String(d.getDate()).padStart(DATE_PART_WIDTH, '0');
    return `${y}-${m}-${day}`;
}

/**
 * 按类型构造 frontmatter 对象。
 *
 * @remarks
 * 字段顺序即最终序列化顺序。
 * 每种类型包含其专属字段（见 templates/ 文件夹）。
 */
function buildFrontmatter(
    type: EntryKind,
    id: string,
    author: string,
    today: string,
): Record<string, unknown> {
    const base = {
        id,
        type,
        status: 'draft',
        created: today,
        updated: today,
    };

    switch (type) {
        case EntryKindValues.Agreement:
            return {
                ...base,
                'applies-to': ['all'],
                author,
            };
        case EntryKindValues.Workflow:
            return {
                ...base,
                domains: [],
                'applies-to': [],
                author,
            };
        case EntryKindValues.Skill:
            return {
                ...base,
                domains: [],
                'applies-to': [],
                focus: [],
                author,
            };
        case EntryKindValues.Pattern:
            return {
                ...base,
                author,
            };
        case EntryKindValues.Adr:
            return {
                ...base,
                supersedes: null,
                author,
            };
    }
}