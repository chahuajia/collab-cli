// src/domain/validation/Issue.ts
import {type IssueCode, IssueCodeValues} from '@/domain/validation/IssueCode.js';
import {type Severity, SeverityValues} from '@/domain/validation/Severity.js';
import type {EntryKind} from '@/domain/entry/types';

const basename = (path: string) => path.split('/').pop();

/**
 * Issue 的属性。
 */
export interface IssueProps {
    readonly severity: Severity;
    readonly code: IssueCode;
    readonly message: string;
    readonly path?: string;
    readonly suggestion?: string;
    readonly docs?: string;
}

/**
 * 校验问题值对象。
 *
 * @remarks
 * 它是值对象，不是实体：
 * - 没有身份，两个字段完全相同的 Issue 是同一个。
 * - 不可变，所有修改方法返回新实例。
 * - 有行为：`isBlocking`、`format`、`withSuggestion`。
 *
 * 构造只能通过 `Issue.of` 或 `Issues` 工厂，防止散落的字面量。
 */
export class Issue {
    private constructor(private readonly props: IssueProps) {
    }

    /**
     * 构造 Issue。
     *
     * @remarks
     * 通常不应直接调用，优先用 `Issues` 工厂中语义化的方法。
     */
    static of(props: IssueProps): Issue {
        return new Issue(props);
    }

    /**
     * 是否阻断流程（severity === Error）。
     */
    isBlocking(): boolean {
        return this.props.severity === SeverityValues.Error;
    }

    /**
     * 附加修复建议，返回新实例。
     */
    withSuggestion(suggestion: string): Issue {
        return new Issue({...this.props, suggestion});
    }

    /**
     * 值相等比较。
     */
    equals(other: Issue): boolean {
        if (this === other) return true;

        const props = this.props;
        const otherProps = other.props;
        return (
            props.severity === otherProps.severity &&
            props.code === otherProps.code &&
            props.message === otherProps.message &&
            props.path === otherProps.path
        );
    }

    /**
     * 格式化为单行字符串，用于控制台输出。
     */
    format(): string {
        const loc = this.props.path ? ` at ${this.props.path}` : '';
        const suggest = this.props.suggestion ? `\n  → ${this.props.suggestion}` : '';
        return `[${this.props.severity.toUpperCase()}] ${this.props.code}: ${this.props.message}${loc}${suggest}`;
    }

    get severity(): Severity {
        return this.props.severity;
    }

    get code(): IssueCode {
        return this.props.code;
    }

    get message(): string {
        return this.props.message;
    }

    get path(): string | undefined {
        return this.props.path;
    }

    get suggestion(): string | undefined {
        return this.props.suggestion;
    }

    get docs(): string | undefined {
        return this.props.docs;
    }


    static emptyId(): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.EmptyId,
            message: 'entry id must not be empty',
        })
    }

    static idPrefixMismatch(id: string, type: EntryKind, prefix: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.IdPrefixMismatch,
            message: `id "${id}" must start with "${prefix}" for type "${type}"`,
            suggestion: `rename to "${prefix}${id}" or change type`,
        })
    }

    static invalidDate(raw: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.InvalidDate,
            message: `"${raw}" is not a valid ISO date`,
            suggestion: 'use YYYY-MM-DD with a real calendar date',
        })
    }

    static dateOrderInvalid(created: string, updated: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.DateOrderInvalid,
            message: `created (${created}) is after updated (${updated})`,
        })
    }

    static missingFrontmatter(path: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.MissingFrontmatter,
            message: 'missing YAML frontmatter',
            path,
            docs: 'skills/S9-yaml-metadata',
        })
    }

    static invalidYaml(path: string, reason: string): Issue {
        return Issue.of({

            severity: SeverityValues.Error,
            code: IssueCodeValues.InvalidYaml,
            message: `YAML parse error: ${reason}`,
            path,
        })
    }

    static invalidShape(path: string, reason: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.InvalidShape,
            message: reason,
            path,
        })
    }

    /**
     * 类型与目录不匹配。
     *
     * @param path - 条目路径
     * @param actualType - 条目的实际类型
     * @param expectedDir - 期望所在的目录
     */
    static typeDirMismatch(path: string, actualType: EntryKind, expectedDir: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.TypeDirMismatch,
            message: `entry of type "${actualType}" must be under "${expectedDir}/", but found at "${path}"`,
            path,
            suggestion: `move to "${expectedDir}/${basename(path)}" or change the type`,
        })
    }

    static missingSection(path: string, section: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.MissingSection,
            message: `missing "## ${section}" section`,
            path,
            docs: 'skills/S8-pattern-language-format',
        })
    }

    static deadLink(path: string, ref: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.DeadLink,
            message: `dead link [[${ref}]]`,
            path,
            suggestion:
                'use id anchor [[<id>]] (immutable — ADR-0009); or link by file name; or create the entry / remove the link',
        })
    }

    static duplicateId(id: string, firstPath: string, secondPath: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.DuplicateId,
            message: `id "${id}" appears in both ${firstPath} and ${secondPath}`,
        })
    }

    static duplicateSection(path: string, section: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.DuplicateSection,
            message: `section "## ${section}" appears more than once`,
            path,
            suggestion: 'merge the duplicated sections into one',
        });
    }

    static missingIndex(dir: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.MissingIndex,
            message: `directory "${dir}" has no "_index.md"`,
            path: dir,
            suggestion: `create "${dir}/_index.md"`,
        });
    }

    static missingFromIndex(entryPath: string, id: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.MissingFromIndex,
            message: `entry "${id}" is not listed in the directory index`,
            path: entryPath,
            suggestion: `add "[[${id}]]" to the corresponding _index.md`,
        });
    }

    static danglingIndexEntry(indexPath: string, ref: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.DanglingIndexEntry,
            message: `_index.md lists "[[${ref}]]" but no such entry exists`,
            path: indexPath,
            suggestion: 'create the entry or remove the reference',
        });
    }

    /**
     * `_index.md` 表格行用了文件名锚，推荐 id 锚。
     *
     * @remarks
     * 非阻断 —— 文件名形式仍合法；新行由 `collab index` 已写 id 形式。
     */
    static indexRefPreferId(
        indexPath: string,
        ref: string,
        id: string,
    ): Issue {
        return Issue.of({
            severity: SeverityValues.Warning,
            code: IssueCodeValues.IndexRefPreferId,
            message: `_index.md lists "[[${ref}]]" — prefer id anchor "[[${id}]]"`,
            path: indexPath,
            suggestion: `change the table link to [[${id}]] (immutable — ADR-0009)`,
        });
    }

    /**
     * id 不是文件名的前缀。
     *
     * @remarks
     * id 与文件名必须同源，两种锚（id / 文件名）才都能被解析：
     * 文件要么叫 `<id>.md`，要么叫 `<id>-<slug>.md`。
     */
    static idFileNameMismatch(path: string, id: string, fileName: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.IdFileNameMismatch,
            message: `id "${id}" is not a prefix of the file name "${fileName}"`,
            path,
            suggestion: `rename the file to "${id}.md" or "${id}-<slug>.md", or change id to a prefix of "${fileName}"`,
        });
    }

    /**
     * id 没有登记进 `aliases`。
     *
     * @remarks
     * 渲染层靠 `aliases` 解析 id 形式的链接 —— 缺了它，`[[<id>]]` 会静默断链。
     */
    static idNotInAliases(path: string, id: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.IdNotInAliases,
            message: `id "${id}" is not listed in aliases — id-form links ([[${id}]]) would not resolve in the renderer`,
            path,
            suggestion: `add "${id}" to the frontmatter aliases`,
        });
    }

    /**
     * `catalog.json` 与工作区不一致。
     *
     * @remarks
     * catalog 是**生成物** —— 手写或过期都会让它变成"第二份真相源"。
     */
    static catalogStale(reason: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.CatalogStale,
            message: `catalog.json is out of date: ${reason}`,
            path: "catalog.json",
            suggestion: "run `collab catalog` to regenerate it",
        });
    }

    /**
     * 顶层目录未在基座契约里声明。
     *
     * @remarks
     * 新目录 = 新 kind = **基座变更** —— 需要 ADR + 迁移脚本，不能悄悄加。
     */
    static undeclaredDir(dir: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.UndeclaredDir,
            message: `"${dir}/" is not declared in the base contract (see meta/base-contract.md)`,
            path: dir,
            suggestion:
                "adding a top-level directory is a BASE change: it needs an ADR + a migration script; or move the file into a declared directory",
        });
    }

    /**
     * `enforced` 的值形态不合法。
     *
     * @remarks
     * 只查**语法**（`<repo>:<path>`）—— 文件是否真存在由 `collab retire`
     * 在写入时查（它才有 IO）。validate 保持密闭。
     */
    static enforcedShapeInvalid(path: string, value: string, reason: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.EnforcedShapeInvalid,
            message: `enforced "${value}" is not a valid "<repo>:<path>" reference: ${reason}`,
            path,
            suggestion:
                'use the form "evolutionary:backend/src/test/java/.../SomeTest.java"',
        });
    }

    /**
     * 路由面指向一条**已毕业**的条目，却没有标注。
     *
     * @remarks
     * 毕业的条目已退出 `catalog.json` —— 它不需要再被读（内容活在测试里）。
     * 症状表若还写"读它"，就是在收一份**读了没用**的税。
     * `_index.md` 保留毕业条目是**对的**（索引 ≠ 路由表），所以本规则只管路由面。
     */
    static routingToGraduated(path: string, id: string, enforced: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.RoutingToGraduated,
            message: `routing surface points at "${id}", which has graduated (enforced by ${enforced}) — it is no longer in catalog.json`,
            path,
            suggestion: `mark the line as graduated (e.g. "已毕业 → ${enforced}"), or point at the artifact instead of the entry`,
        });
    }

    /**
     * `enforced` 指向的产物不存在。
     *
     * @remarks
     * **毕业的依据没了。** 条目已因"内容活在某个测试里"而退出路由索引，
     * 而那个测试被删/改名后 —— 条目**既不在索引里、其固化也没了**：
     * 知识静默丢失。对照 OKF/Kage 的"来源漂移则保留但撤回（withheld），
     * 而非静默返回过期内容"。
     *
     * 只在 `validate --check-enforced` 下报（要读跨仓文件系统，破坏密闭性）。
     */
    static enforcedTargetMissing(path: string, value: string, looked: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.EnforcedTargetMissing,
            message: `enforced target does not exist: "${value}" (looked at ${looked}) — the entry graduated on the strength of an artifact that is gone`,
            path,
            suggestion:
                'either re-point `enforced` at the real artifact, or un-graduate (set `enforced: null`) so the entry returns to the routing index — its knowledge is currently unreachable AND unenforced',
        });
    }

    /**
     * 门槛生效日之后创建的条目缺 `falsifier`。
     *
     * @remarks
     * 存量条目豁免（它们写在门槛生效前）—— 这就是"日期截止"而非
     * "全库计数"的理由：后者在任何小于基线的工作区里都是死的。
     */
    static falsifierRequired(path: string, id: string, since: string): Issue {
        return Issue.of({
            severity: SeverityValues.Error,
            code: IssueCodeValues.FalsifierRequired,
            message: `"${id}" was created on/after ${since} but has no \`falsifier\` — state "不读它，模型会照着本地哪个模式写错？"`,
            path,
            suggestion:
                'add `falsifier: <本地哪个模式会被照着写下去>`; must be an imitation-type counterfactual, not "模型不知道 X" (falsified by the D experiment). Empty is better than fabricated — see meta/interceptions.md: 不要编造',
        });
    }
}
