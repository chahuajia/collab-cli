// src/domain/validation/rules/__tests__/checkIndexExists.test.ts
import { describe, it, expect } from 'vitest';
import {makeEntry} from "@/domain/entry/__tests__/testHelpers";
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {checkIndexExists} from "@/domain/validation/rules/checkIndexExists";
import type {Entry} from "@/domain/entry/Entry";
import type {RuleContext} from "@/domain/validation/Rule";


function ctx(entries: readonly Entry[], indexDirs: readonly string[]): RuleContext {
    return {
        allEntries: entries,
        allEntryIds: new Set(entries.map((e) => e.frontmatter.id)),
        indexFiles: new Map(indexDirs.map((d) => [d, ''])),
    };
}

describe('checkIndexExists', () => {
    it('passes when all directories have _index.md', () => {
        const entries = [
            makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' }),
            makeEntry({ id: 'W1', type: 'Workflow', path: 'workflows/W1.md' }),
        ];
        const context = ctx(entries, ['skills', 'workflows']);
        expect(checkIndexExists(context)).toHaveLength(0);
    });

    it('reports missing index for a directory', () => {
        const entries = [
            makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' }),
        ];
        const context = ctx(entries, []);
        const issues = checkIndexExists(context);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.code).toBe(IssueCodeValues.MissingIndex);
        expect(issues[0]?.path).toBe('skills');
    });

    it('reports one issue per missing directory (not per entry)', () => {
        const entries = [
            makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' }),
            makeEntry({ id: 'S13', type: 'Skill', path: 'skills/S13.md' }),
            makeEntry({ id: 'S14', type: 'Skill', path: 'skills/S14.md' }),
        ];
        const context = ctx(entries, []);
        const issues = checkIndexExists(context);
        expect(issues).toHaveLength(1); // 只报一次，不是三次
    });

    it('handles nested directory (meta/decision-records)', () => {
        const entries = [
            makeEntry({ id: 'ADR-0001', type: 'Adr', path: 'meta/decision-records/ADR-0001.md' }),
        ];
        const context = ctx(entries, []);
        const issues = checkIndexExists(context);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.path).toBe('meta/decision-records');
    });

    it('passes when workspace has no entries', () => {
        expect(checkIndexExists(ctx([], []))).toHaveLength(0);
    });
});