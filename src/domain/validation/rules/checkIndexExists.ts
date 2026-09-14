// src/domain/validation/rules/checkIndexExists.ts


import {Issue} from "@/domain/validation/Issue";
import {dirOfPath} from "@/domain/validation/rules/_shared";
import type {RuleContext} from "@/domain/validation/Rule";

/**
 * 校验每个条目所在目录都存在 `_index.md`。
 *
 * @remarks
 * 目录级检查——不按条目跑，按"出现了哪些目录"跑。
 * 同一目录下多个条目只报一次。
 *
 * @param context - 提供 allEntries 和 indexFiles
 */
export function checkIndexExists(context: RuleContext): readonly Issue[] {
    const dirs = new Set<string>();
    for (const entry of context.allEntries) {
        const dir = dirOfPath(entry.path);
        if (dir) dirs.add(dir);
    }

    const issues: Issue[] = [];
    for (const dir of dirs) {
        if (!context.indexFiles.has(dir)) {
            issues.push(Issue.missingIndex(dir));
        }
    }
    return issues;
}