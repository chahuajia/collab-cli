// src/domain/validation/Issue.__tests__.ts
import { describe, it, expect } from 'vitest';
import {Issue} from "@/domain/validation/Issue";



describe('Issue', () => {
    describe('isBlocking', () => {
        it('returns true for error severity', () => {
            const issue = Issue.emptyId();
            expect(issue.isBlocking()).toBe(true);
        });

        it('returns false for warning severity', () => {
            const issue = Issue.missingSection('path', '上下文', 'warning');
            expect(issue.isBlocking()).toBe(false);
        });
    });

    describe('equals', () => {
        it('returns true for same props', () => {
            const a = Issue.emptyId();
            const b = Issue.emptyId();
            expect(a.equals(b)).toBe(true);
        });

        it('returns false for different code', () => {
            const a = Issue.emptyId();
            const b = Issue.invalidDate('bad');
            expect(a.equals(b)).toBe(false);
        });
    });

    describe('withSuggestion', () => {
        it('returns new instance with suggestion', () => {
            const original = Issue.emptyId();
            const updated = original.withSuggestion('fix it');
            expect(updated.suggestion).toBe('fix it');
            expect(original.suggestion).toBeUndefined();  // 不可变
        });
    });
});