// src/application/ValidateUseCase.ts
import type { Entry } from '@/domain/entry/Entry';
import type { WorkspaceLoader } from '@/domain/entry/WorkspaceLoader';
import type { Issue } from '@/domain/validation/Issue';
import type {Rule, RuleContext} from "@/domain/validation/Rule";

/***
 * 校验工作区的用例。
 *
 * @remarks
 * 编排：加载工作区 → 逐条跑规则 → 汇总报告。
 * 规则由构造时注入，便于测试。
 */
export class ValidateUseCase {
    constructor(
        private readonly loader: WorkspaceLoader,
        private readonly rules: readonly Rule[],
    ) {}

    execute(): { entries: Entry[]; issues: Issue[] } {
        const workspace = this.loader.load();
        const entries: Entry[] = [];
        const issues: Issue[] = [];

        const context: RuleContext = {
            allEntries: workspace.entries
                .map((e) => e.entry)
                .filter((e): e is Entry => e !== null),
            allEntryIds: new Set(
                workspace.entries
                    .map((e) => e.entry?.frontmatter.id)
                    .filter((id): id is NonNullable<typeof id> => id !== undefined),
            ),
        };

        for (const loaded of workspace.entries) {
            issues.push(...loaded.parseIssues);
            if (loaded.entry) {
                entries.push(loaded.entry);
                for (const rule of this.rules) {
                    issues.push(...rule(loaded.entry, context));
                }
            }
        }

        return { entries, issues };
    }
}