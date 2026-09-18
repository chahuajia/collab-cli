import { describe, it, expect } from 'vitest';
import {Issue} from "@/domain/validation/Issue";
import {IssueCodeValues} from "@/domain/validation/IssueCode";
import {SeverityValues} from "@/domain/validation/Severity";

describe('sectionsPresent', () => {
    it('missingSection produces error severity', () => {
        const issue = Issue.missingSection('path', '上下文');
        expect(issue.severity).toBe(SeverityValues.Error);
    });

    it('duplicateSection includes section name in message', () => {
        const issue = Issue.duplicateSection('path', '方案');
        expect(issue.message).toContain('方案');
        expect(issue.code).toBe(IssueCodeValues.DuplicateSection);
    });
})


