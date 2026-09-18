// src/domain/validation/rules/__tests__/linksResolve.test.ts
import { describe, it, expect } from 'vitest';
import {makeEntry} from "@/domain/entry/__tests__/testHelpers";
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {linksResolve, MAX_DEAD_LINKS} from "@/domain/validation/rules/linksResolve";
import {SeverityValues} from "@/domain/validation/Severity";
import type {RuleContext} from "@/domain/validation/Rule";

/**
 * 构造 RuleContext 的快捷方式。
 *
 * @remarks
 * **链接按文件名解析**（2026-09-16 修正），所以这里的 `ids` 同时当作文件名：
 * 未显式给 `paths` 时，按 `skills/<id>` 派生。
 */
function ctx(
  ids: readonly string[],
  paths: readonly string[] = [],
): RuleContext {
  return {
    allEntries: [],
    allEntryIds: new Set(ids),
    indexFiles: new Map(),
    allMarkdownPaths: new Set(
      paths.length > 0 ? paths : ids.map((id) => `skills/${id}`),
    ),
  };
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
        it('accepts a bare name when it IS the file name', () => {
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
    // 代码里的双括号是示例，不是链接（2026-09-16 修复）
    // ─────────────────────────────────────────────
    describe('跳过代码（2026-09-16）', () => {
        it('ignores a link inside a fenced code block', () => {
            const entry = makeEntry({
                body: '```md\n[[S99]]\n```\n',
            });
            expect(linksResolve(entry, ctx([]))).toHaveLength(0);
        });

        it('ignores a link inside inline code', () => {
            const entry = makeEntry({ body: '写作 `[[S99]]` 表示引用' });
            expect(linksResolve(entry, ctx([]))).toHaveLength(0);
        });

        it('still reports a real link next to a code span', () => {
            const entry = makeEntry({
                body: '示例 `[[S99]]` 与真链接 [[S98]]',
            });
            const issues = linksResolve(entry, ctx([]));
            expect(issues).toHaveLength(1);
            expect(issues[0]?.message).toContain('S98');
        });

        it('resumes checking after the fence closes', () => {
            const entry = makeEntry({
                body: '```\n[[S99]]\n```\n[[S98]]\n',
            });
            const issues = linksResolve(entry, ctx([]));
            expect(issues).toHaveLength(1);
            expect(issues[0]?.message).toContain('S98');
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
    // 代码块（D6=B）—— 旧"已知限制"已修（2026-09-16）
    // ─────────────────────────────────────────────
    describe('代码块（D6=B）', () => {
        // 旧行为：按纯文本处理，代码块里的链接也被检测 —— 会让"讨论链接"的
        // 文档误报死链（写 ADR-0009 时踩了两次）。
        // 新行为：围栏与行内代码一律跳过。见下方 "跳过代码（2026-09-16）"。
        it('does NOT detect links inside code blocks anymore', () => {
            const body = '```\nsee [[S99]]\n```';
            const entry = makeEntry({ body });
            expect(linksResolve(entry, ctx(['S12']))).toHaveLength(0);
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
    describe("Issue 元数据", () => {
      it("uses error severity", () => {
        const entry = makeEntry({ body: "[[S99]]" });
        const issues = linksResolve(entry, ctx(["S12"]));
        expect(issues[0]?.severity).toBe(SeverityValues.Error);
      });

      it("carries entry path", () => {
        const entry = makeEntry({ body: "[[S99]]", path: "skills/S12.md" });
        const issues = linksResolve(entry, ctx(["S12"]));
        expect(issues[0]?.path).toBe("skills/S12.md");
      });

      it("message contains the original reference (not normalized)", () => {
        const entry = makeEntry({ body: "[[patterns/S99]]" });
        const issues = linksResolve(entry, ctx(["S12"]));
        expect(issues[0]?.message).toContain("patterns/S99");
      });
    });

    // ─────────────────────────────────────────────
    // 文件存在性（新增）
    // ─────────────────────────────────────────────
    describe("文件存在性（非条目引用）", () => {
      it("passes for [[ROOT]] when ROOT.md exists", () => {
        const entry = makeEntry({ body: "see [[ROOT]]" });
        const issues = linksResolve(entry, ctx([], ["ROOT"]));
        expect(issues).toHaveLength(0);
      });

      it("passes for [[meta/evolution-log]] when file exists", () => {
        const entry = makeEntry({ body: "see [[meta/evolution-log]]" });
        const issues = linksResolve(entry, ctx([], ["meta/evolution-log"]));
        expect(issues).toHaveLength(0);
      });

      it("passes for [[domains/architecture/_index]] when file exists", () => {
        const entry = makeEntry({
          body: "see [[domains/architecture/_index]]",
        });
        const issues = linksResolve(
          entry,
          ctx([], ["domains/architecture/_index"]),
        );
        expect(issues).toHaveLength(0);
      });

      it("passes for [[profiles/_index]] when file exists", () => {
        const entry = makeEntry({ body: "see [[profiles/_index]]" });
        const issues = linksResolve(entry, ctx([], ["profiles/_index"]));
        expect(issues).toHaveLength(0);
      });

      it("passes for [[rfcs/_index]] when file exists", () => {
        const entry = makeEntry({ body: "see [[rfcs/_index]]" });
        const issues = linksResolve(entry, ctx([], ["rfcs/_index"]));
        expect(issues).toHaveLength(0);
      });

      it("still reports DEAD_LINK for [[ROOT]] when file does NOT exist", () => {
        const entry = makeEntry({ body: "see [[ROOT]]" });
        const issues = linksResolve(entry, ctx([], [])); // 无文件
        expect(issues).toHaveLength(1);
        expect(issues[0]?.code).toBe(IssueCodeValues.DeadLink);
      });

      it("still reports DEAD_LINK for missing file [[meta/gone]]", () => {
        const entry = makeEntry({ body: "see [[meta/gone]]" });
        const issues = linksResolve(entry, ctx([], ["meta/evolution-log"]));
        expect(issues).toHaveLength(1);
      });

      it("reports DEAD_LINK for directory references ([[meta/decision-records]])", () => {
        // 目录引用 —— 即使目录存在 —— 也不是 .md 文件 —— 报 DEAD_LINK
        const entry = makeEntry({ body: "see [[meta/decision-records]]" });
        const issues = linksResolve(
          entry,
          ctx([], ["meta/decision-records/ADR-0001"]),
        );
        expect(issues).toHaveLength(1);
      });

      it("条目 id 优先于文件路径（都命中时不报）", () => {
        const entry = makeEntry({ body: "see [[S12]]" });
        // S12 是条目 —— 不需要文件路径
        const issues = linksResolve(entry, ctx(["S12"], ["S12"]));
        expect(issues).toHaveLength(0);
      });

      it("条目 id 和文件路径都不命中时报错", () => {
        const entry = makeEntry({ body: "see [[S99]]" });
        const issues = linksResolve(entry, ctx(["S12"], ["ROOT"]));
        expect(issues).toHaveLength(1);
      });
    });
});
