// src/domain/validation/ValidationReport.ts
import {SeverityValues} from "@/domain/validation/Severity";
import type {Issue} from "@/domain/validation/Issue";
import type {IssueCode} from "@/domain/validation/IssueCode";

/**
 * 校验报告值对象。
 *
 * @remarks
 * 职责：把一堆 Issue 按需要分组、过滤、统计。
 * 不负责：输出（那是 Reporter 的职责）、持久化、排序。
 *
 * 不可变：`of` 是唯一构造方式，所有查询方法返回只读视图。
 */
export class ValidationReport {
    private constructor(private readonly _issues: readonly Issue[]) {}

    /**
     * 从 Issue 数组构造报告。
     */
    static of(issues: readonly Issue[]): ValidationReport {
        return new ValidationReport([...issues]);
    }

    /**
     * 返回全部 Issue。
     */
    get issues(): readonly Issue[] {
        return this._issues;
    }

    /**
     * 是否有阻断性 Issue（severity === error）。
     *
     * @remarks
     * 用于 CLI 的退出码判定：
     * - true → 退出码 1
     * - false → 退出码 0
     */
    hasBlocking(): boolean {
        return this._issues.some((i) => i.isBlocking());
    }

    /**
     * 所有 error。
     */
    errors(): readonly Issue[] {
        return this._issues.filter((i) => i.severity === SeverityValues.Error);
    }

    /**
     * 所有 warning。
     */
    warnings(): readonly Issue[] {
        return this._issues.filter((i) => i.severity === SeverityValues.Warning);
    }

    /**
     * 按 IssueCode 分组。
     */
    groupByCode(): ReadonlyMap<IssueCode, readonly Issue[]> {
        const map = new Map<IssueCode, Issue[]>();
        for (const issue of this._issues) {
            const existing = map.get(issue.code);
            if (existing) {
                existing.push(issue);
            } else {
                map.set(issue.code, [issue]);
            }
        }
        return map;
    }

    /**
     * Issue 总数。
     */
    count(): number {
        return this._issues.length;
    }
}