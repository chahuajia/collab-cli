// src/domain/validation/rules/__tests__/sectionsPresent.test.ts
import { describe, it, expect } from 'vitest';
import {makeEntry} from "@/domain/entry/__tests__/testHelpers";
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {sectionsPresent} from "@/domain/validation/rules/sectionsPresent";
import {SeverityValues} from "@/domain/validation/Severity";
import type {RuleContext} from "@/domain/validation/Rule";

const emptyContext: RuleContext = {
    allEntries: [],
    allEntryIds: new Set(),
    indexFiles: new Map(),
    allMarkdownPaths: new Set(),
};

/** 五章节齐全的模板 body，供多个用例裁剪使用。 */
const FULL_BODY = [
    '## 上下文',
    '',
    '有些背景。',
    '',
    '## 问题',
    '',
    '有些问题。',
    '',
    '## 方案',
    '',
    '有些方案。',
    '',
    '## 反面',
    '',
    '有些反面。',
    '',
    '## 关联',
    '',
    '- [[S12]]',
    '',
].join('\n');

describe('sectionsPresent', () => {
    // ─────────────────────────────────────────────
    // 完整场景：E3, E4
    // ─────────────────────────────────────────────
    describe('完整场景', () => {
        it('passes when all five sections are present', () => {
            const entry = makeEntry({ body: FULL_BODY });
            expect(sectionsPresent(entry, emptyContext)).toHaveLength(0);
        });

        it('passes when sections are in arbitrary order (D2=B)', () => {
            const entry = makeEntry({
                body: [
                    '## 关联',
                    '- [[S12]]',
                    '## 方案',
                    '...',
                    '## 上下文',
                    '...',
                    '## 反面',
                    '...',
                    '## 问题',
                    '...',
                ].join('\n'),
            });
            expect(sectionsPresent(entry, emptyContext)).toHaveLength(0);
        });
    });

    // ─────────────────────────────────────────────
    // 缺失场景：E1, E2
    // ─────────────────────────────────────────────
    describe('缺失场景', () => {
        it('reports all 5 sections missing for empty body (E1)', () => {
            const entry = makeEntry({ body: '' });
            const issues = sectionsPresent(entry, emptyContext);
            expect(issues).toHaveLength(5);
            issues.forEach((i) => {
                expect(i.code).toBe(IssueCodeValues.MissingSection);
            });
        });

        it('reports 4 missing when only 方案 exists (E2)', () => {
            const entry = makeEntry({ body: '## 方案\n\n...\n' });
            const issues = sectionsPresent(entry, emptyContext);
            expect(issues).toHaveLength(4);

            const messages = issues.map((i) => i.message).join(' ');
            expect(messages).toContain('上下文');
            expect(messages).toContain('问题');
            expect(messages).toContain('反面');
            expect(messages).toContain('关联');
            expect(messages).not.toContain('方案"');  // 方案已存在，不应出现
        });
    });

    // ─────────────────────────────────────────────
    // 标题匹配严格度：E5, E6, E7, E10
    // ─────────────────────────────────────────────
    describe('标题匹配严格度', () => {
        it('accepts ## 方案 with trailing whitespace (E6, D3=B)', () => {
            const body = FULL_BODY.replace('## 方案\n', '## 方案   \n');
            const entry = makeEntry({ body });
            expect(sectionsPresent(entry, emptyContext)).toHaveLength(0);
        });

        it('rejects ### 方案 (E5, D5=A)', () => {
            const body = FULL_BODY.replace('## 方案\n', '### 方案\n');
            const entry = makeEntry({ body });
            const issues = sectionsPresent(entry, emptyContext);
            expect(issues).toHaveLength(1);
            expect(issues[0]?.message).toContain('方案');
        });

        it('rejects # 方案 (H1 不是章节)', () => {
            const body = FULL_BODY.replace('## 方案\n', '# 方案\n');
            const entry = makeEntry({ body });
            const issues = sectionsPresent(entry, emptyContext);
            expect(issues).toHaveLength(1);
            expect(issues[0]?.message).toContain('方案');
        });

        it('rejects ## 方案说明 (E7, D3=B)', () => {
            const body = FULL_BODY.replace('## 方案\n', '## 方案说明\n');
            const entry = makeEntry({ body });
            const issues = sectionsPresent(entry, emptyContext);
            expect(issues).toHaveLength(1);
            expect(issues[0]?.message).toContain('方案');
        });

        it('does not match ## 方案 appearing mid-line', () => {
            // 这一行看起来是"行首 ##"，实际是文本中间
            const entry = makeEntry({ body: '有些方案 ## 方案\n' });
            const issues = sectionsPresent(entry, emptyContext);
            // 5 个章节都应该被认为缺失
            expect(issues).toHaveLength(5);
        });
    });

    // ─────────────────────────────────────────────
    // 重复章节：E8
    // ─────────────────────────────────────────────
    describe('重复章节', () => {
        it('reports duplicate when ## 方案 appears twice (E8, D4=A)', () => {
            const body = FULL_BODY + '\n## 方案\n\n重复的方案\n';
            const entry = makeEntry({ body });
            const issues = sectionsPresent(entry, emptyContext);
            const duplicate = issues.find(
                (i) => i.code === IssueCodeValues.DuplicateSection,
            );
            expect(duplicate).toBeDefined();
            expect(duplicate?.message).toContain('方案');
        });

        it('distinguishes missing from duplicate', () => {
            // 只有 方案 出现两次，其他都缺
            const entry = makeEntry({
                body: '## 方案\n\n...\n\n## 方案\n\n...\n',
            });
            const issues = sectionsPresent(entry, emptyContext);
            const missing = issues.filter(
                (i) => i.code === IssueCodeValues.MissingSection,
            );
            const duplicates = issues.filter(
                (i) => i.code === IssueCodeValues.DuplicateSection,
            );
            expect(missing).toHaveLength(4);
            expect(duplicates).toHaveLength(1);
        });
    });

    // ─────────────────────────────────────────────
    // Issue 元数据
    // ─────────────────────────────────────────────
    describe("Issue 元数据", () => {
      it("all missing sections use error severity (D1=A)", () => {
        const entry = makeEntry({ body: "" });
        const issues = sectionsPresent(entry, emptyContext);
        issues.forEach((i) => {
          expect(i.severity).toBe(SeverityValues.Error);
        });
      });

      it("carries path for locating the problem", () => {
        const entry = makeEntry({ body: "", path: "skills/S12.md" });
        const issues = sectionsPresent(entry, emptyContext);
        issues.forEach((i) => {
          expect(i.path).toBe("skills/S12.md");
        });
      });
    });

    // 追加到现有测试文件末尾

    describe("sectionsPresent — 按 kind 分章节（新增）", () => {
      // ─────────────────────────────────────────────
      // Skill 的章节集（5 章节）
      // ─────────────────────────────────────────────
      it("Skill: passes with 上下文/问题/方案/反面/关联", () => {
        const entry = makeEntry({
          type: "Skill",
          body: "## 上下文\n\n## 问题\n\n## 方案\n\n## 反面\n\n## 关联\n",
        });
        expect(sectionsPresent(entry, emptyContext)).toHaveLength(0);
      });

      it("Skill: fails with ADR sections", () => {
        const entry = makeEntry({
          type: "Skill",
          body: "## 背景\n\n## 决策\n\n## 后果\n\n## 替代方案\n\n## 关联\n",
        });
        const issues = sectionsPresent(entry, emptyContext);
        // 5 个章节都不匹配 —— 全部 MissingSection
        expect(issues.length).toBeGreaterThan(0);
        expect(
          issues.every((i) => i.code === IssueCodeValues.MissingSection),
        ).toBe(true);
      });

      // ─────────────────────────────────────────────
      // Agreement / Workflow / Pattern 的章节集（同 Skill）
      // ─────────────────────────────────────────────
      it.each([
        ["Agreement", "A1"],
        ["Workflow", "W1"],
        ["Pattern", "rooted-graph"],
      ] as const)("%s: uses the pattern-language sections", (type, id) => {
        const entry = makeEntry({
          id,
          type,
          body: "## 上下文\n\n## 问题\n\n## 方案\n\n## 反面\n\n## 关联\n",
        });
        expect(sectionsPresent(entry, emptyContext)).toHaveLength(0);
      });

      // ─────────────────────────────────────────────
      // ADR 的章节集（背景/决策/后果/替代方案/关联）
      // ─────────────────────────────────────────────
      it("ADR: passes with 背景/决策/后果/替代方案/关联", () => {
        const entry = makeEntry({
          id: "ADR-0001",
          type: "Adr",
          body: "## 背景\n\n## 决策\n\n## 后果\n\n## 替代方案\n\n## 关联\n",
        });
        expect(sectionsPresent(entry, emptyContext)).toHaveLength(0);
      });

      it("ADR: fails with pattern-language sections", () => {
        const entry = makeEntry({
          id: "ADR-0001",
          type: "Adr",
          body: "## 上下文\n\n## 问题\n\n## 方案\n\n## 反面\n\n## 关联\n",
        });
        const issues = sectionsPresent(entry, emptyContext);
        // ADR 期望:背景/决策/后果/替代方案/关联
        // 实际给:上下文/问题/方案/反面/关联
        // 关联 匹配 —— 其他 4 个都缺
        expect(issues).toHaveLength(4);
        const messages = issues.map((i) => i.message).join(" ");
        expect(messages).toContain("背景");
        expect(messages).toContain("决策");
        expect(messages).toContain("后果");
        expect(messages).toContain("替代方案");
      });

      it("ADR: reports missing 替代方案", () => {
        const entry = makeEntry({
          id: "ADR-0001",
          type: "Adr",
          body: "## 背景\n\n## 决策\n\n## 后果\n\n## 关联\n",
        });
        const issues = sectionsPresent(entry, emptyContext);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.message).toContain("替代方案");
      });

      it("ADR: duplicate 决策 reports DuplicateSection", () => {
        const entry = makeEntry({
          id: "ADR-0001",
          type: "Adr",
          body: "## 背景\n\n## 决策\n\n## 决策\n\n## 后果\n\n## 替代方案\n\n## 关联\n",
        });
        const issues = sectionsPresent(entry, emptyContext);
        const dup = issues.find(
          (i) => i.code === IssueCodeValues.DuplicateSection,
        );
        expect(dup).toBeDefined();
        expect(dup?.message).toContain("决策");
      });

      // ─────────────────────────────────────────────
      // 每个 kind 的"关联"都必需
      // ─────────────────────────────────────────────
      it.each([
        ["Skill", "S1"],
        ["Agreement", "A1"],
        ["Workflow", "W1"],
        ["Pattern", "rooted-graph"],
        ["Adr", "ADR-0001"],
      ] as const)("%s: 关联 is required", (type, id) => {
        // 构造"没有 ## 关联"的 body
        let body: string;
        if (type === "Adr") {
          body = "## 背景\n\n## 决策\n\n## 后果\n\n## 替代方案\n";
        } else {
          body = "## 上下文\n\n## 问题\n\n## 方案\n\n## 反面\n";
        }
        const entry = makeEntry({ id, type, body });
        const issues = sectionsPresent(entry, emptyContext);
        expect(issues.some((i) => i.message.includes("关联"))).toBe(true);
      });
    });
});