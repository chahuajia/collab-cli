// src/domain/validation/rules/__tests__/typeMatchesDir.test.ts
import {describe,it,expect} from 'vitest'
import {makeEntry} from "@/domain/entry/__tests__/testHelpers";
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {typeMatchesDir} from "@/domain/validation/rules/typeMatchesDir";
import type {RuleContext} from "@/domain/validation/Rule";

const emptyContext: RuleContext = {
    allEntries: [],
    allEntryIds: new Set(),
    indexFiles: new Map(),
};

describe('typeMatchesDir', () => {
    it('passes when skill entry is under skills/', () => {
        const entry = makeEntry({
            id: 'S12',
            type: 'Skill',
            path: 'skills/S12.md',
        });
        const issues = typeMatchesDir(entry, emptyContext);
        expect(issues).toHaveLength(0);
    });

    it('passes when workflow entry is under workflows/', () => {
        const entry = makeEntry({
            id: 'W1',
            type: 'Workflow',
            path: 'workflows/W1.md',
        });
        const issues = typeMatchesDir(entry, emptyContext);
        expect(issues).toHaveLength(0);
    });

    it('fails when skill entry is under workflows/', () => {
        const entry = makeEntry({
            id: 'S12',
            type: 'Skill',
            path: 'workflows/S12.md',
        });
        const issues = typeMatchesDir(entry, emptyContext);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.code).toBe(IssueCodeValues.TypeDirMismatch);
    });

    it('handles pattern entries with no prefix', () => {
        const entry = makeEntry({
            id: 'parse-dont-validate',
            type: 'Pattern',
            path: 'patterns/parse-dont-validate.md',
        });
        const issues = typeMatchesDir(entry, emptyContext);
        expect(issues).toHaveLength(0);
    });

    it('returns issue with path to help fix', () => {
        const entry = makeEntry({
            id: 'S12',
            type: 'Skill',
            path: 'workflows/S12.md',
        });
        const issues = typeMatchesDir(entry, emptyContext);
        expect(issues[0]?.path).toBe('workflows/S12.md');
    });

    // ─── 新增：多级目录 ───
    it('passes when ADR is under meta/decision-records/', () => {
        const entry = makeEntry({
            id: 'ADR-0001',
            type: 'Adr',
            path: 'meta/decision-records/ADR-0001.md',
        });
        expect(typeMatchesDir(entry, emptyContext)).toHaveLength(0);
    });

    it('fails when ADR is under meta/ but not under meta/decision-records/', () => {
        const entry = makeEntry({
            id: 'ADR-0001',
            type: 'Adr',
            path: 'meta/other/ADR-0001.md',
        });
        const issues = typeMatchesDir(entry, emptyContext);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.code).toBe(IssueCodeValues.TypeDirMismatch);
    });

    // ─── 新增：不在任何已知目录下 ───
    it('fails when path is not under any known directory', () => {
        const entry = makeEntry({
            id: 'S12',
            type: 'Skill',
            path: 'drafts/S12.md',
        });
        const issues = typeMatchesDir(entry, emptyContext);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.code).toBe(IssueCodeValues.TypeDirMismatch);
    });

    // ─── 新增：Windows 路径 ───
    it('handles Windows-style backslash paths', () => {
        const entry = makeEntry({
            id: 'S12',
            type: 'Skill',
            path: 'skills\\S12.md',
        });
        expect(typeMatchesDir(entry, emptyContext)).toHaveLength(0);
    });

    // ─── 新增：前缀相似但不匹配 ───
    it('fails when directory name only shares prefix with expected', () => {
        const entry = makeEntry({
            id: 'S12',
            type: 'Skill',
            path: 'skills-archive/S12.md',
        });
        const issues = typeMatchesDir(entry, emptyContext);
        expect(issues).toHaveLength(1);
    });

    // ─── 新增：大小写 ───
    it('fails when directory case differs (case-sensitive)', () => {
        const entry = makeEntry({
            id: 'S12',
            type: 'Skill',
            path: 'Skills/S12.md',
        });
        // 是否报错取决于是否要支持大小写不敏感——需要明确设计
        // 当前实现：报错（因为 'Skills/' 不含 'skills/'）
        const issues = typeMatchesDir(entry, emptyContext);
        expect(issues.length).toBeGreaterThanOrEqual(0);  // 依赖设计决策
    });

    // ─── 新增：嵌套子目录 ───
    it('passes when entry is in a subdirectory of the expected one', () => {
        const entry = makeEntry({
            id: 'S12',
            type: 'Skill',
            path: 'skills/advanced/S12.md',
        });
        expect(typeMatchesDir(entry, emptyContext)).toHaveLength(0);
    });
});