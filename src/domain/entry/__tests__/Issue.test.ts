// src/domain/validation/__tests__/Issue.test.ts
import { describe, it, expect } from 'vitest';
import {Issue} from "@/domain/validation/Issue";
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {SeverityValues} from "@/domain/validation/Severity";


describe('Issue', () => {
    describe('工厂方法', () => {
        it('emptyId produces error severity', () => {
            const issue = Issue.emptyId();
            expect(issue.severity).toBe(SeverityValues.Error);
            expect(issue.code).toBe(IssueCodeValues.EmptyId);
        });

        it('idPrefixMismatch includes prefix in message', () => {
            const issue = Issue.idPrefixMismatch('X12', 'skill', 'S');
            expect(issue.message).toContain('"S"');
            expect(issue.message).toContain('"X12"');
        });

        it('invalidDate includes raw value', () => {
            const issue = Issue.invalidDate('2026-13-01');
            expect(issue.message).toContain('2026-13-01');
        });

        it('missingSection with warning severity', () => {
            const issue = Issue.missingSection('path', '上下文');
            expect(issue.severity).toBe(SeverityValues.Error);
        });
    });

    describe('行为', () => {
        it('isBlocking returns true for error', () => {
            expect(Issue.emptyId().isBlocking()).toBe(true);
        });

        it("isBlocking returns true for Error", () => {
          const issue = Issue.missingSection("path", "上下文");
          expect(issue.isBlocking()).toBe(true);
        });

        it('withSuggestion returns new instance (immutable)', () => {
            const original = Issue.emptyId();
            const updated = original.withSuggestion('fix it');
            expect(updated.suggestion).toBe('fix it');
            expect(original.suggestion).toBeUndefined();
        });

        it('equals returns true for same props', () => {
            const a = Issue.emptyId();
            const b = Issue.emptyId();
            expect(a.equals(b)).toBe(true);
        });

        it('equals returns false for different code', () => {
            const a = Issue.emptyId();
            const b = Issue.invalidDate('bad');
            expect(a.equals(b)).toBe(false);
        });
    });

    describe('format', () => {
        it('includes severity, code, message', () => {
            const issue = Issue.emptyId();
            const formatted = issue.format();
            expect(formatted).toContain('[ERROR]');
            expect(formatted).toContain('EMPTY_ID');
        });

        it('includes path when present', () => {
            const issue = Issue.missingFrontmatter('a.md');
            expect(issue.format()).toContain('a.md');
        });
    });
});