// src/domain/validation/rules/__tests__/linksResolve.test.ts
import { describe, it, expect } from 'vitest';
import {makeEntry} from "@/domain/entry/__tests__/testHelpers";
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {linksResolve, MAX_DEAD_LINKS} from "@/domain/validation/rules/linksResolve";
import {SeverityValues} from "@/domain/validation/Severity";
import type {RuleContext} from "@/domain/validation/Rule";

/** 构造 RuleContext 的快捷方式：只需 allEntryIds。 */
function ctx(ids: readonly string[]): RuleContext {
    return { allEntries: [], allEntryIds: new Set(ids),indexFiles: new Map(),  };
}

describe('linksResolve', () => {
    // ─────────────────────────────────────────────
    // 基础：E1, E2, E3, E4
    // ─────────────────────────────────────────────
    describe('基础场景', () => {
        it('passes when all links resolve (E1)', () => {
            const entry = makeEntry({ body: 'see [[S12]] and [[A8]]' });
            const issues = linksResolve(entry, ctx(['S12', 'A8']));
            expect(issues).toHaveLength(0);
        });

        it('reports one dead link (E2)', () => {
            const entry = makeEntry({ body: 'see [[S99]]' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(1);
            expect(issues[0]?.code).toBe(IssueCodeValues.DeadLink);
        });

        it('reports multiple different dead links (E3)', () => {
            const entry = makeEntry({ body: 'see [[S99]] and [[S98]]' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(2);
        });

        it('deduplicates repeated dead links (E4, D4=A)', () => {
            const entry = makeEntry({
                body: 'see [[S99]] and again [[S99]] and [[S99]]',
            });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(1);
        });
    });

    // ─────────────────────────────────────────────
    // 长引用 vs 短引用（D2=C）
    // ─────────────────────────────────────────────
    describe('引用形式（D2=C）', () => {
        it('accepts short-form link ([[id]])', () => {
            const entry = makeEntry({ body: 'see [[rooted-graph]]' });
            const issues = linksResolve(entry, ctx(['rooted-graph']));
            expect(issues).toHaveLength(0);
        });

        it('accepts long-form link ([[path/id]])', () => {
            const entry = makeEntry({ body: 'see [[patterns/rooted-graph]]' });
            const issues = linksResolve(entry, ctx(['rooted-graph']));
            expect(issues).toHaveLength(0);
        });

        it('accepts both forms pointing to same entry', () => {
            const entry = makeEntry({
                body: 'see [[rooted-graph]] and [[patterns/rooted-graph]]',
            });
            const issues = linksResolve(entry, ctx(['rooted-graph']));
            expect(issues).toHaveLength(0);
        });

        it('reports dead link for long-form to non-existent entry', () => {
            const entry = makeEntry({ body: 'see [[patterns/nonexistent]]' });
            const issues = linksResolve(entry, ctx(['rooted-graph']));
            expect(issues).toHaveLength(1);
        });

        it('deduplicates long and short forms of the same dead link', () => {
            // [[S99]] 和 [[patterns/S99]] 是同一个死链目标
            const entry = makeEntry({ body: 'see [[S99]] and [[patterns/S99]]' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(1);
        });
    });

    // ─────────────────────────────────────────────
    // 自引用（D3=A）
    // ─────────────────────────────────────────────
    describe('自引用（D3=A）', () => {
        it('allows self-reference', () => {
            const entry = makeEntry({ id: 'S12', body: 'see [[S12]]' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(0);
        });
    });

    // ─────────────────────────────────────────────
    // 标题里的链接（D5=A）
    // ─────────────────────────────────────────────
    describe('标题里的链接（D5=A）', () => {
        it('detects dead link in H2 heading', () => {
            const entry = makeEntry({ body: '## 引用 [[S99]]\n\n...' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(1);
        });

        it('detects dead link in list item', () => {
            const entry = makeEntry({ body: '- [[S99]]\n- [[S12]]' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(1);
        });
    });

    // ─────────────────────────────────────────────
    // 空引用 / 不完整（D7=A）
    // ─────────────────────────────────────────────
    describe('边界语法（D7=A）', () => {
        it('ignores empty [[]]', () => {
            const entry = makeEntry({ body: 'see [[]]' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(0);
        });

        it('ignores incomplete [[S12]', () => {
            const entry = makeEntry({ body: 'see [[S12]' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(0);
        });

        it('ignores Markdown links [text](url)', () => {
            const entry = makeEntry({ body: 'see [text](http://example.com)' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(0);
        });

        it('passes when body has no links at all', () => {
            const entry = makeEntry({ body: '## 上下文\n\n无链接。' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(0);
        });
    });

    // ─────────────────────────────────────────────
    // 代码块（D6=B，已知限制）
    // ─────────────────────────────────────────────
    describe('代码块（D6=B，已知限制）', () => {
        // 当前按纯文本处理，代码块内的链接也会被检测。
        // 引入 Markdown 解析器后应改为忽略。
        // TODO: 实现代码块识别后更新此测试
        it('detects links inside code blocks (known limitation)', () => {
            const body = '```\nsee [[S99]]\n```';
            const entry = makeEntry({ body });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(1);
        });
    });

    // ─────────────────────────────────────────────
    // 限流（新增）
    // ─────────────────────────────────────────────
    describe('限流（MAX_DEAD_LINKS）', () => {
        it(`limits output to ${MAX_DEAD_LINKS} when exceeded`, () => {
            // 构造 15 个不同的死链
            const refs = Array.from({ length: 15 }, (_, i) => `[[X${i + 1}]]`).join(' ');
            const entry = makeEntry({ body: refs });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(MAX_DEAD_LINKS);
        });

        it('does not limit when dead links are below MAX_DEAD_LINKS', () => {
            const refs = Array.from({ length: 5 }, (_, i) => `[[X${i + 1}]]`).join(' ');
            const entry = makeEntry({ body: refs });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(5);
        });

        it('counts only unique dead links toward the limit', () => {
            // 15 个引用但只有 3 个唯一死链 → 不触发限流
            const refs = Array.from({ length: 15 }, (_, i) => `[[X${(i % 3) + 1}]]`).join(' ');
            const entry = makeEntry({ body: refs });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues).toHaveLength(3);
        });
    });

    // ─────────────────────────────────────────────
    // Issue 元数据
    // ─────────────────────────────────────────────
    describe('Issue 元数据', () => {
        it('uses error severity', () => {
            const entry = makeEntry({ body: '[[S99]]' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues[0]?.severity).toBe(SeverityValues.Error);
        });

        it('carries entry path', () => {
            const entry = makeEntry({ body: '[[S99]]', path: 'skills/S12.md' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues[0]?.path).toBe('skills/S12.md');
        });

        it('message contains the original reference (not normalized)', () => {
            const entry = makeEntry({ body: '[[patterns/S99]]' });
            const issues = linksResolve(entry, ctx(['S12']));
            expect(issues[0]?.message).toContain('patterns/S99');
        });
    });
});