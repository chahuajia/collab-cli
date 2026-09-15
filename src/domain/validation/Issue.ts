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
            suggestion: 'create the entry or remove the link',
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
}