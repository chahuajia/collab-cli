// src/domain/entry/ISODate.__tests__.ts
import { describe, it, expect } from 'vitest';
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import { ISODate } from '../ISODate.js';


describe('ISODate', () => {
    describe('create', () => {
        it.each([
            ['2026-09-11', true],
            ['2026-01-01', true],
            ['2026-12-31', true],
            ['2026-2-1', false],       // 格式不符
            ['2026/09/11', false],     // 分隔符错
            ['2026-13-01', false],     // 月份越界
            ['2026-02-30', false],     // 不存在的日期
            ['2026-09-11T00:00:00', false], // 含时间
            ['', false],               // 空
        ])('validates %s => %s', (input, expected) => {
            const result = ISODate.create(input);
            expect(result.ok).toBe(expected);
            if (!result.ok) {
                expect(result.error.code).toBe(IssueCodeValues.InvalidDate);
            }
        });
    });

    describe('isAfter', () => {
        it('returns true when a is later', () => {
            const a = ISODate.create('2026-09-11');
            const b = ISODate.create('2026-09-10');
            if (a.ok && b.ok) {
                expect(ISODate.isAfter(a.value, b.value)).toBe(true);
            }
        });

        it('returns false when a is earlier', () => {
            const a = ISODate.create('2026-09-10');
            const b = ISODate.create('2026-09-11');
            if (a.ok && b.ok) {
                expect(ISODate.isAfter(a.value, b.value)).toBe(false);
            }
        });
    });
});