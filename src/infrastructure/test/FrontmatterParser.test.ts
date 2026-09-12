import { describe, it, expect } from 'vitest';
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {parseFrontmatterInput} from "@/infrastructure/parsing/FrontmatterParser";


describe('parseFrontmatterInput', () => {
    it('parses valid frontmatter', () => {
        const raw = {
            id: 'S12',
            type: 'skill',
            status: 'active',
            created: '2026-09-11',
            updated: '2026-09-11',
        };
        const result = parseFrontmatterInput(raw, 'path.md');
        expect(result.ok).toBe(true);
    });

    it('rejects invalid type', () => {
        const raw = { id: 'S12', type: 'invalid', /* ... */ };
        const result = parseFrontmatterInput(raw, 'path.md');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error[0]?.code).toBe(IssueCodeValues.InvalidShape);
        }
    });
});