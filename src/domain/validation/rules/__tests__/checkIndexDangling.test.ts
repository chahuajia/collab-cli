// src/domain/validation/rules/__tests__/checkIndexDangling.test.ts
import { describe, it, expect } from 'vitest';
import {makeEntry} from "@/domain/entry/__tests__/testHelpers";
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {checkIndexDangling} from "@/domain/validation/rules/checkIndexDangling";
import type {Entry} from "@/domain/entry/Entry";
import type {RuleContext} from "@/domain/validation/Rule";


function ctx(
    entries: readonly Entry[],
    indexFiles: Map<string, string>,
): RuleContext {
    return {
        allEntries: entries,
        allEntryIds: new Set(entries.map((e) => e.frontmatter.id)),
        indexFiles,
    };
}

describe('checkIndexDangling', () => {
    it('passes when all index references exist', () => {
        const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
        const context = ctx([entry], new Map([
            ['skills', '| [[S12]] |'],
        ]));
        expect(checkIndexDangling(context)).toHaveLength(0);
    });

    it('reports DanglingIndexEntry for non-existent ref', () => {
        const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
        const context = ctx([entry], new Map([
            ['skills', '| [[S99]] |'],
        ]));
        const issues = checkIndexDangling(context);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.code).toBe(IssueCodeValues.DanglingIndexEntry);
        expect(issues[0]?.message).toContain('S99');
    });

    it('ignores cross-directory references (D5=B)', () => {
        // skills/_index.md 引用 [[W1]] —— W1 在其他目录，不报
        const entries = [
            makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' }),
            makeEntry({ id: 'W1', type: 'Workflow', path: 'workflows/W1.md' }),
        ];
        const context = ctx(entries, new Map([
            ['skills', '| [[S12]] | [[W1]] |'],
        ]));
        expect(checkIndexDangling(context)).toHaveLength(0);
    });

    it('ignores refs starting with underscore (D8=B)', () => {
        const entries = [
            makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' }),
        ];
        const context = ctx(entries, new Map([
            ['skills', '| [[S12]] | [[_index]] |'],
        ]));
        expect(checkIndexDangling(context)).toHaveLength(0);
    });

    it('reports multiple dangling refs, deduplicated', () => {
        const entries = [
            makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' }),
        ];
        const context = ctx(entries, new Map([
            ['skills', '| [[S99]] | [[S98]] | [[S99]] |'],
        ]));
        const issues = checkIndexDangling(context);
        expect(issues).toHaveLength(2);
    });

    it('reports dangling per-directory', () => {
        const entries = [
            makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' }),
            makeEntry({ id: 'W1', type: 'Workflow', path: 'workflows/W1.md' }),
        ];
        const context = ctx(entries, new Map([
            ['skills', '| [[S99]] |'],
            ['workflows', '| [[W99]] |'],
        ]));
        const issues = checkIndexDangling(context);
        expect(issues).toHaveLength(2);
    });

    it('handles empty index content', () => {
        const entries = [
            makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' }),
        ];
        const context = ctx(entries, new Map([['skills', '']]));
        expect(checkIndexDangling(context)).toHaveLength(0);
    });

    it('cross-directory: ref matches existing entry in another dir → not dangling', () => {
        // 边界：references 存在但不在本目录下 —— 不是 dangling（D5=B）
        const entries = [
            makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' }),
            makeEntry({ id: 'W1', type: 'Workflow', path: 'workflows/W1.md' }),
        ];
        const context = ctx(entries, new Map([
            ['skills', '| [[W1]] |'],
        ]));
        // W1 存在于 allEntryIds 但不在 skills/ 下
        // D5=B 说这种情况忽略（不是 dangling）
        expect(checkIndexDangling(context)).toHaveLength(0);
    });

    it('reports dangling only when ref looks like it belongs here', () => {
        // S99 以 S 开头——看起来像 skill——但不存在 → dangling
        // X99 不像本目录的 id → 忽略（交给 linksResolve）
        const entries = [
            makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' }),
        ];
        const context = ctx(entries, new Map([
            ['skills', '| [[S99]] | [[X99]] |'],
        ]));
        const issues = checkIndexDangling(context);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.message).toContain('S99');
    });
});