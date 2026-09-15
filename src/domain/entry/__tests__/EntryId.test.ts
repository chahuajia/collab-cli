// src/domain/entry/__tests__/EntryId.test.ts
import { describe, it, expect } from 'vitest';
import {EntryId} from "@/domain/entry/EntryId";
import {EntryKindValues} from "@/domain/entry/types";
import {IssueCodeValues} from "@/domain/validation/IssueCode";


describe('EntryId', () => {
    describe('create', () => {
        it('accepts skill id with S prefix', () => {
            console.log(EntryId, 'EntryId', typeof EntryId )
            const result = EntryId.create('S12', EntryKindValues.Skill);
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe('S12');
        });

        it('accepts agreement id with A prefix', () => {
            const result = EntryId.create('A8', EntryKindValues.Agreement);
            expect(result.ok).toBe(true);
        });

        it('accepts ADR id with ADR- prefix', () => {
            const result = EntryId.create('ADR-0001', EntryKindValues.Adr);
            expect(result.ok).toBe(true);
        });

        it('accepts pattern id without prefix', () => {
            const result = EntryId.create('parse-dont-validate', EntryKindValues.Pattern);
            expect(result.ok).toBe(true);
        });

        it('rejects skill id without S prefix', () => {
            const result = EntryId.create('X12', EntryKindValues.Skill);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe(IssueCodeValues.IdPrefixMismatch);
            }
        });

        it('rejects empty id', () => {
            const result = EntryId.create('', EntryKindValues.Skill);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe(IssueCodeValues.EmptyId);
            }
        });
    });

    describe('equals', () => {
        it('returns true for same value', () => {
            const a = EntryId.create('S12', EntryKindValues.Skill);
            const b = EntryId.create('S12', EntryKindValues.Skill);
            if (a.ok && b.ok) {
                expect(EntryId.equals(a.value, b.value)).toBe(true);
            }
        });

        it('returns false for different values', () => {
            const a = EntryId.create('S12', EntryKindValues.Skill);
            const b = EntryId.create('S13', EntryKindValues.Skill);
            if (a.ok && b.ok) {
                expect(EntryId.equals(a.value, b.value)).toBe(false);
            }
        });
    });
});