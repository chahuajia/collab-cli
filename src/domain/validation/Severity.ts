// src/domain/validation/Severity.ts
import type { ValueOf } from '../../shared/types.js';

/**
 * Issue 严重程度值域。
 */
export const SeverityValues = {
    Error: 'error',
    Warning: 'warning',
    Info: 'info',
} as const;

export type Severity = ValueOf<typeof SeverityValues>;