// src/domain/entry/EntryId.__tests__.ts
import { describe, it, expect } from 'vitest';
import { IssueCodeValues } from '../../validation/IssueCode';
import { EntryId } from '../EntryId';
import { EntryTypeValues } from '../types';

describe('EntryId', () => {
    describe('create', () => {
        it('accepts skill id with S prefix', () => {
            const result = EntryId.create('S12', EntryTypeValues.Skill);
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.value).toBe('S12');
        });

        it('rejects skill id without S prefix', () => {
            const result = EntryId.create('X12', EntryTypeValues.Skill);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe(IssueCodeValues.IdPrefixMismatch);
            }
        });

        it('rejects empty id', () => {
            const result = EntryId.create('', EntryTypeValues.Skill);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe(IssueCodeValues.EmptyId);
            }
        });

        it('accepts pattern id without prefix', () => {
            const result = EntryId.create('parse-dont-validate', EntryTypeValues.Pattern);
            expect(result.ok).toBe(true);
        });

        it('accepts ADR id with ADR- prefix', () => {
            const result = EntryId.create('ADR-0001', EntryTypeValues.Adr);
            expect(result.ok).toBe(true);
        });
    });
});