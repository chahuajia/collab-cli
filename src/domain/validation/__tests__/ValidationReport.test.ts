// src/domain/validation/__tests__/ValidationReport.test.ts
import { describe, it, expect } from 'vitest';
import {Issue} from "@/domain/validation/Issue";
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {ValidationReport} from "@/domain/validation/ValidationReport";


describe('ValidationReport', () => {
    describe('of', () => {
        it('constructs from issues', () => {
            const report = ValidationReport.of([Issue.emptyId()]);
            expect(report.count()).toBe(1);
        });

        it('copies input (immutable)', () => {
            const issues = [Issue.emptyId()];
            const report = ValidationReport.of(issues);
            issues.push(Issue.invalidDate('bad'));
            expect(report.count()).toBe(1);
        });

        it('handles empty array', () => {
            expect(ValidationReport.of([]).count()).toBe(0);
        });
    });

    describe('hasBlocking', () => {
        it('returns true when any issue is error', () => {
            const report = ValidationReport.of([
                Issue.emptyId(),                              // error
                Issue.missingSection('path', '方案'),          // error
            ]);
            expect(report.hasBlocking()).toBe(true);
        });

        it('returns false when all issues are warnings', () => {
            const report = ValidationReport.of([]);
            expect(report.hasBlocking()).toBe(false);
        });

        it('returns false for empty report', () => {
            expect(ValidationReport.of([]).hasBlocking()).toBe(false);
        });
    });

    describe('errors / warnings', () => {
        it('separates by severity', () => {
            const report = ValidationReport.of([
                Issue.emptyId(),
                Issue.emptyId(),
            ]);
            expect(report.errors()).toHaveLength(2);
            expect(report.warnings()).toHaveLength(0);
        });

        it('returns empty arrays when no issues match', () => {
            const report = ValidationReport.of([]);
            expect(report.errors()).toEqual([]);
            expect(report.warnings()).toEqual([]);
        });
    });

    describe('groupByCode', () => {
        it('groups issues by code', () => {
            const report = ValidationReport.of([
                Issue.emptyId(),
                Issue.emptyId(),
                Issue.invalidDate('bad'),
            ]);
            const byCode = report.groupByCode();
            expect(byCode.get(IssueCodeValues.EmptyId)).toHaveLength(2);
            expect(byCode.get(IssueCodeValues.InvalidDate)).toHaveLength(1);
        });

        it('returns empty map for empty report', () => {
            expect(ValidationReport.of([]).groupByCode().size).toBe(0);
        });
    });

    describe('issues getter', () => {
        it('returns the same issues in insertion order', () => {
            const a = Issue.emptyId();
            const b = Issue.invalidDate('bad');
            const report = ValidationReport.of([a, b]);
            expect(report.issues).toEqual([a, b]);
        });
    });
});