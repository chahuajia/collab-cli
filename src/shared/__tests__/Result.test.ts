// src/shared/__tests__/Result.test.ts
import { describe, it, expect } from 'vitest';
import { Ok, Err, type Result } from "@/shared/Result";

describe('Result', () => {
    describe('Ok', () => {
        it('creates a success result', () => {
            const r = Ok(42);
            expect(r.ok).toBe(true);
            if (r.ok) expect(r.value).toBe(42);
        });
    });

    describe('Err', () => {
        it('creates a failure result', () => {
            const r = Err('error');
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.error).toBe('error');
        });
    });

    describe('discriminated union', () => {
        it('narrows type with if (r.ok)', () => {
            const r: Result<number, string> = Ok(42);
            if (r.ok) {
              expect(r.value).toBe(42);
            }
        });
    });
});