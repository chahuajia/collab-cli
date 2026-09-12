import {describe, it, expect} from 'vitest';
import {ValidateUseCase} from "@/application/ValidateUseCase";
import {Issue} from "@/domain/validation/Issue";
import type {Workspace, WorkspaceLoader} from "@/domain/entry/WorkspaceLoader";



function fakeLoader(workspace: Workspace): WorkspaceLoader {
    return {
        load: () => workspace,
    };
}

describe('ValidateUseCase', () => {
    it('returns empty issues for empty workspace', () => {
        const useCase = new ValidateUseCase(
            fakeLoader({entries: []}),
            [],
        );
        const result = useCase.execute();
        expect(result.issues).toEqual([]);
    });

    it('collects parse issues from loaded entries', () => {
        const useCase = new ValidateUseCase(
            fakeLoader({
                entries: [
                    {
                        path: 'a.md',
                        entry: null,
                        parseIssues: [Issue.missingFrontmatter('a.md')],
                    },
                ],
            }),
            [],  // 无规则
        );
        const result = useCase.execute();
        expect(result.issues).toHaveLength(1);
    });

    it('runs injected rules on loaded entries', () => {
        // 这里留个空，等你实现 Entry 后再补真实 entry fixture
    });
});