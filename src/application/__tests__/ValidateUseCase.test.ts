// src/application/__tests__/ValidateUseCase.test.ts
import { describe, it, expect } from 'vitest';
import {ValidateUseCase} from "@/application/ValidateUseCase";
import {makeEntry} from "@/domain/entry/__tests__/testHelpers";
import {Issue} from "@/domain/validation/Issue";
import type {Workspace, WorkspaceLoader} from "@/domain/entry/WorkspaceLoader";
import type {GlobalRule, Rule, RuleContext} from "@/domain/validation/Rule";


function fakeLoader(workspace: Workspace): WorkspaceLoader {
    return { load: () => workspace };
}

function workspace(
    entries: Workspace['entries'] = [],
    indexFiles: ReadonlyMap<string, string> = new Map(),
): Workspace {
    return { entries, indexFiles };
}

describe('ValidateUseCase', () => {
    // ─────────────────────────────────────────────
    // 基础编排
    // ─────────────────────────────────────────────
    describe('基础编排', () => {
        it('empty workspace → empty report', () => {
            const useCase = new ValidateUseCase(fakeLoader(workspace()));
            const { entries, report } = useCase.execute();
            expect(entries).toEqual([]);
            expect(report.count()).toBe(0);
        });

        it('collects parse issues from failed entries', () => {
            const useCase = new ValidateUseCase(fakeLoader(workspace([
                { path: 'a.md', entry: null, parseIssues: [Issue.missingFrontmatter('a.md')] },
            ])));
            const { report } = useCase.execute();
            expect(report.count()).toBe(1);
        });

        it('returns only successfully parsed entries', () => {
            const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
            const useCase = new ValidateUseCase(fakeLoader(workspace([
                { path: 'skills/S12.md', entry, parseIssues: [] },
                { path: 'broken.md', entry: null, parseIssues: [Issue.missingFrontmatter('broken.md')] },
            ])));
            const { entries } = useCase.execute();
            expect(entries).toHaveLength(1);
            expect(entries[0]?.frontmatter.id).toBe('S12');
        });
    });

    // ─────────────────────────────────────────────
    // 规则注入（D1=C）
    // ─────────────────────────────────────────────
    describe('规则注入', () => {
        it('runs injected per-entry rule on each entry', () => {
            const calls: string[] = [];
            const rule: Rule = (entry) => {
                calls.push(entry.frontmatter.id);
                return [];
            };
            const entry1 = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
            const entry2 = makeEntry({ id: 'S13', type: 'Skill', path: 'skills/S13.md' });
            const useCase = new ValidateUseCase(
                fakeLoader(workspace([
                    { path: 'skills/S12.md', entry: entry1, parseIssues: [] },
                    { path: 'skills/S13.md', entry: entry2, parseIssues: [] },
                ])),
                { perEntry: [rule], global: [] },
            );
            useCase.execute();
            expect(calls).toEqual(['S12', 'S13']);
        });

        it('runs injected global rule once', () => {
            let calls = 0;
            const globalRule: GlobalRule = () => {
                calls++;
                return [];
            };
            const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
            const useCase = new ValidateUseCase(
                fakeLoader(workspace([
                    { path: 'skills/S12.md', entry, parseIssues: [] },
                ])),
                { perEntry: [], global: [globalRule] },
            );
            useCase.execute();
            expect(calls).toBe(1);
        });

        it('collects issues from custom rules', () => {
            const rule: Rule = () => [Issue.emptyId()];
            const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
            const useCase = new ValidateUseCase(
                fakeLoader(workspace([
                    { path: 'skills/S12.md', entry, parseIssues: [] },
                ])),
                { perEntry: [rule], global: [] },
            );
            const { report } = useCase.execute();
            expect(report.errors()).toHaveLength(1);
        });
    });

    // ─────────────────────────────────────────────
    // 执行顺序（D3=A）
    // ─────────────────────────────────────────────
    describe('执行顺序', () => {
        it('runs per-entry before global', () => {
            const order: string[] = [];
            const perEntryRule: Rule = (entry) => {
                order.push(`entry:${entry.frontmatter.id}`);
                return [];
            };
            const globalRule: GlobalRule = () => {
                order.push('global');
                return [];
            };
            const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
            const useCase = new ValidateUseCase(
                fakeLoader(workspace([
                    { path: 'skills/S12.md', entry, parseIssues: [] },
                ])),
                { perEntry: [perEntryRule], global: [globalRule] },
            );
            useCase.execute();
            expect(order).toEqual(['entry:S12', 'global']);
        });
    });

    // ─────────────────────────────────────────────
    // RuleContext 构建（D2=A）
    // ─────────────────────────────────────────────
    describe('RuleContext 构建', () => {
        it('builds allEntryIds from successfully parsed entries', () => {
            let capturedIds: ReadonlySet<string> | undefined;
            const rule: GlobalRule = (ctx) => {
                capturedIds = ctx.allEntryIds;
                return [];
            };
            const entry1 = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
            const entry2 = makeEntry({ id: 'S13', type: 'Skill', path: 'skills/S13.md' });
            const useCase = new ValidateUseCase(
                fakeLoader(workspace([
                    { path: 'skills/S12.md', entry: entry1, parseIssues: [] },
                    { path: 'skills/S13.md', entry: entry2, parseIssues: [] },
                    { path: 'broken.md', entry: null, parseIssues: [] },
                ])),
                { perEntry: [], global: [rule] },
            );
            useCase.execute();
            expect(capturedIds).toEqual(new Set(['S12', 'S13']));
        });

        it('passes indexFiles through to context', () => {
            let captured: ReadonlyMap<string, string> | undefined;
            const rule: GlobalRule = (ctx) => {
                captured = ctx.indexFiles;
                return [];
            };
            const indexFiles = new Map([['skills', '| [[S12]] |']]);
            const useCase = new ValidateUseCase(
                fakeLoader(workspace([], indexFiles)),
                { perEntry: [], global: [rule] },
            );
            useCase.execute();
            expect(captured).toBe(indexFiles);
        });

        it('per-entry rules receive same context as global rules', () => {
            let perEntryContext: RuleContext | undefined;
            let globalContext: RuleContext | undefined;
            const perEntryRule: Rule = (_entry, ctx) => {
                perEntryContext = ctx;
                return [];
            };
            const globalRule: GlobalRule = (ctx) => {
                globalContext = ctx;
                return [];
            };
            const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
            const useCase = new ValidateUseCase(
                fakeLoader(workspace([
                    { path: 'skills/S12.md', entry, parseIssues: [] },
                ])),
                { perEntry: [perEntryRule], global: [globalRule] },
            );
            useCase.execute();
            expect(perEntryContext).toBe(globalContext);
        });
    });

    // ─────────────────────────────────────────────
    // 返回值（D6=A）
    // ─────────────────────────────────────────────
    describe('返回值', () => {
        it('returns report with hasBlocking()', () => {
            const rule: Rule = () => [Issue.emptyId()];
            const entry = makeEntry({ id: 'S12', type: 'Skill', path: 'skills/S12.md' });
            const useCase = new ValidateUseCase(
                fakeLoader(workspace([
                    { path: 'skills/S12.md', entry, parseIssues: [] },
                ])),
                { perEntry: [rule], global: [] },
            );
            const { report } = useCase.execute();
            expect(report.hasBlocking()).toBe(true);
        });
    });
});