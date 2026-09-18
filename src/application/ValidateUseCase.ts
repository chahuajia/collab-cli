// src/application/ValidateUseCase.ts
import {catalogIsFresh} from "@/application/catalogIsFresh";
import {contractDirs} from "@/application/contractDirs";
import {checkIndexDangling} from "@/domain/validation/rules/checkIndexDangling";
import {checkIndexExists} from "@/domain/validation/rules/checkIndexExists";
import {checkIndexForward} from "@/domain/validation/rules/checkIndexForward";
import {checkIndexRefPreferId} from "@/domain/validation/rules/checkIndexRefPreferId";
import {enforcedShape} from "@/domain/validation/rules/enforcedShape";
import {idIsAlias} from "@/domain/validation/rules/idIsAlias";
import {idMatchesFileName} from "@/domain/validation/rules/idMatchesFileName";
import {linksResolve} from "@/domain/validation/rules/linksResolve";
import {linksResolveInRootDocs} from "@/domain/validation/rules/linksResolveInRootDocs";
import {routingToGraduated} from "@/domain/validation/rules/routingToGraduated";
import {sectionsPresent} from "@/domain/validation/rules/sectionsPresent";
import {typeMatchesDir} from "@/domain/validation/rules/typeMatchesDir";
import {ValidationReport} from "@/domain/validation/ValidationReport";
import type {Entry} from "@/domain/entry/Entry";
import type {WorkspaceLoader} from "@/domain/entry/WorkspaceLoader";
import type {Issue} from "@/domain/validation/Issue";
import type {RuleContext, RuleRegistry} from "@/domain/validation/Rule";

/**
 * 内容规则集：**不依赖 `_index.md`** 的规则。
 *
 * @remarks
 * 用于"条目刚落盘、索引还没刷新"的场合（`collab apply` 的门禁）。
 * 索引相关规则（`checkIndexForward` / `checkIndexExists` / `checkIndexDangling`）
 * 要求"每条目都已登记在册"——对一批**刚刚落盘**的条目来说，
 * 这个要求只能靠同批次的 `_index.md` 更新满足，否则新建条目必然失败。
 *
 * 见 anchors："产物必须通过 `collab validate`（无 index 相关规则）"。
 */
export const contentRules: RuleRegistry = {
    perEntry: [
        idMatchesFileName,
        idIsAlias,
        typeMatchesDir,
        sectionsPresent,
        linksResolve,
        // `enforced` 的形态（`<repo>:<path>`）。不依赖索引，故进 contentRules ——
        // 一条刚写下的条目也该被查。存在性检查归 `collab retire`（它有 IO）。
        enforcedShape,
    ],
    global: [],
};

/**
 * 标准规则集：内容规则 + 索引规则。
 *
 * @remarks
 * 生产环境默认使用的规则集（`validate` / `commit` / `push`）。
 * 以 `contentRules` 为基，避免两份"内容规则"各自漂移。
 * 测试时可注入自定义 `RuleRegistry` 覆盖。
 */
export const standardRules: RuleRegistry = {
    perEntry: [...contentRules.perEntry, checkIndexForward],
    global: [
        checkIndexExists,
        checkIndexDangling,
        checkIndexRefPreferId,
        catalogIsFresh,
        contractDirs,
        linksResolveInRootDocs,
        // 路由面（症状表 / domain 索引）不得指向已毕业条目 ——
        // 否则收一份"读了没用"的税（见 routingToGraduated 的注释）。
        routingToGraduated,
    ],
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
            catalogJson: workspace.catalogJson,
            rootDocs: workspace.rootDocs,
            extraDocs: workspace.extraDocs,
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
