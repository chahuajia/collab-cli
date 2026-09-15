// src/application/ValidateUseCase.ts
import {checkIndexDangling} from "@/domain/validation/rules/checkIndexDangling";
import {checkIndexExists} from "@/domain/validation/rules/checkIndexExists";
import {checkIndexForward} from "@/domain/validation/rules/checkIndexForward";
import {linksResolve} from "@/domain/validation/rules/linksResolve";
import {sectionsPresent} from "@/domain/validation/rules/sectionsPresent";
import {typeMatchesDir} from "@/domain/validation/rules/typeMatchesDir";
import {ValidationReport} from "@/domain/validation/ValidationReport";
import type {Entry} from "@/domain/entry/Entry";
import type {WorkspaceLoader} from "@/domain/entry/WorkspaceLoader";
import type {Issue} from "@/domain/validation/Issue";
import type {RuleContext, RuleRegistry} from "@/domain/validation/Rule";

/**
 * 标准规则集。
 *
 * @remarks
 * 生产环境默认使用的规则集。
 * 测试时可注入自定义 `RuleRegistry` 覆盖。
 */
export const standardRules: RuleRegistry = {
    perEntry: [
        typeMatchesDir,
        sectionsPresent,
        linksResolve,
        checkIndexForward,
    ],
    global: [checkIndexExists, checkIndexDangling],
};

/**
 * 校验工作区的用例。
 *
 * @remarks
 * 编排职责：
 * 1. 加载工作区（loader）
 * 2. 构建 RuleContext
 * 3. 按条目跑 per-entry 规则
 * 4. 跑 global 规则
 * 5. 汇总为 ValidationReport
 *
 * 不负责具体校验逻辑（那是规则的职责）；
 * 不负责加载数据（那是 loader 的职责）。
 */
export class ValidateUseCase {
    constructor(
        private readonly loader: WorkspaceLoader,
        private readonly rules: RuleRegistry = standardRules,
    ) {}

    /**
     * 执行校验。
     *
     * @returns entries（成功解析的条目）和 report（结构化校验结果）
     */
    execute(): { entries: readonly Entry[]; report: ValidationReport } {
        const workspace = this.loader.load();

        // 1. 分离成功解析的条目与解析期问题
        const entries: Entry[] = [];
        const parseIssues: Issue[] = [];
        for (const loaded of workspace.entries) {
            if (loaded.entry) entries.push(loaded.entry);
            parseIssues.push(...loaded.parseIssues);
        }

        // 2. 构建 RuleContext
        const context: RuleContext = {
            allEntries: entries,
            allEntryIds: new Set(entries.map((e) => e.frontmatter.id)),
            indexFiles: workspace.indexFiles,
            allMarkdownPaths: workspace.allMarkdownPaths,
        };

        // 3. 收集 Issue（先 per-entry，后 global，D3=A）
        const allIssues: Issue[] = [...parseIssues];

        // 3a. per-entry 规则
        for (const entry of entries) {
            for (const rule of this.rules.perEntry) {
                allIssues.push(...rule(entry, context));
            }
        }

        // 3b. global 规则
        for (const rule of this.rules.global) {
            allIssues.push(...rule(context));
        }

        // 4. 汇总
        return {
            entries,
            report: ValidationReport.of(allIssues),
        };
    }
}