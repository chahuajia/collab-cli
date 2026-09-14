// src/domain/validation/rules/__tests__/checkIndexForward.test.ts
import { describe, it, expect } from 'vitest';
import {makeEntry} from "@/domain/entry/__tests__/testHelpers";
import { makeRuleContext } from "@/domain/validation/__tests__/testHelpers";
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {checkIndexForward} from "@/domain/validation/rules/checkIndexForward";
describe('checkIndexForward', () => {
    it('passes when entry is listed in its directory index', () => {
        const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
        const context = makeRuleContext({
            entries:[entry],
            indexFiles: new Map([['skills', '| [[S12]] | skill |']])
        });
        expect(checkIndexForward(entry, context)).toHaveLength(0);
    });

    it('reports MissingFromIndex when entry is not listed', () => {
        const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
        const context = makeRuleContext({
            entries:[entry],
            indexFiles: new Map([
                ['skills', '| [[S13]] | another skill |'],
            ])
        });

        const issues = checkIndexForward(entry, context);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.code).toBe(IssueCodeValues.MissingFromIndex);
        expect(issues[0]?.message).toContain('S12');
    });

    it('ignores entry whose directory has no index', () => {
        // 没有 index 的目录由 checkIndexExists 负责，这里不报
        const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
        const context = makeRuleContext({
            entries:[entry],
            indexFiles: new Map()
        });


        expect(checkIndexForward(entry, context)).toHaveLength(0);
    });

    it('matches long-form references ([[patterns/rooted-graph]])', () => {
        const entry = makeEntry({
            id: 'rooted-graph',
            type: 'Pattern',
            path: 'patterns/rooted-graph.md',
        });
        const context = makeRuleContext({
            entries:[entry],
            indexFiles: new Map([
                ['patterns', '| [[patterns/rooted-graph]] | pattern |'],
            ])
        });
        expect(checkIndexForward(entry, context)).toHaveLength(0);
    });

    it('does not report duplicates within index content', () => {
        const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
        const context = makeRuleContext({
            entries:[entry],
            indexFiles: new Map([
                ['skills', '[[S12]] [[S12]] [[S12]]'],
            ])
        });
        expect(checkIndexForward(entry, context)).toHaveLength(0);
    });
});