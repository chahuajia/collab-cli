// src/cli/lib/templates.ts
import { stringify as stringifyYaml } from 'yaml';
import { DefaultStatusFor, EntryKindValues } from '../../domain/entry/types.js';
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
 *
 * @remarks
 * `falsifier` / `enforced` 由人填写，这里只发空位（`falsifier` 留空、
 * `enforced: null`）—— 工具**生成不出来**这两样：前者是判断，后者是毕业决定。
 * 见 `templates/README.md` 的"改字段先改模板"与 `meta/base-contract.md`。
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
        // 默认 status 由领域层给出，不在这里硬编码 —— ADR 的合法集合里没有 draft，
        // 写死 'draft' 会让 `collab new adr` 生成一个立刻非法的条目。
        status: DefaultStatusFor[type],
        created: today,
        updated: today,
        // id 必须登记为 alias —— 渲染层靠 alias 解析 id 形式的链接。
        // 这是**机械事实**，不该由人记；人只需追加额外别名。
        aliases: [id],
        // 毕业标记：留 null，除非这条内容已被测试/工具固化。
        enforced: null,
    };
    // 注意：**不发 `falsifier`**。它是可选的入库门槛，缺失是合法状态。
    // 发 `falsifier: ""` 会制造"看起来填了、其实没填"的假象 ——
    // 而假象正是这个库一直在删的东西（假绿灯、编造的数字、与事实相反的规则）。
    // 新条目在草案期没有 falsifier 是诚实的；它在入库（W5）时由人填写，由棘轮规则把关。

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
        case EntryKindValues.Integration:
            return {
                ...base,
                domains: [],
                'applies-to': [],
                author,
            };
    }
}
