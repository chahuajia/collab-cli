import { Issue } from "@/domain/validation/Issue";
import type { Entry } from "@/domain/entry/Entry";
import type { RuleContext } from "@/domain/validation/Rule";

/** `enforced` 的形态：`<repo>:<path>`。 */
const SHAPE = /^[a-z][a-z0-9-]*:[^\s].*$/;

/**
 * `enforced` 的值必须是 `<repo>:<path>` 形态。
 *
 * @remarks
 * **为什么要有这条**：`enforced` 一旦填错，条目会**静默地**退出路由索引，
 * 而它声称的固化根本不存在 —— 那条知识就真的丢了。这不是"格式洁癖"：
 * 它是这个字段唯一的护栏。
 *
 * 实测教训（2026-09-18）：手工毕业时把路径写成
 * `com/evolutionary/DomainFrameworkFreeTest.java`（真实位置在 `architecture/` 子目录），
 * `validate` 报 **0 issue** —— 一个不存在的产物被当成了毕业依据。
 *
 * **只查语法，不查文件是否存在** —— validate 必须**密闭**（不跨仓读文件系统，
 * 否则换个工作区就红）。存在性检查归 `collab retire`：它本来就有 IO，
 * 在**写入那一刻**查最有效（与 `fix.ts` 的"补是机械事实，判断归人"同一分工）。
 */
export function enforcedShape(
  entry: Entry,
  _context: RuleContext,
): readonly Issue[] {
  const value = entry.frontmatter.enforced;
  if (value === null) return [];

  if (value.trim().length === 0) {
    return [
      Issue.enforcedShapeInvalid(entry.path, value, "it is empty; use null to mean 'not enforced'"),
    ];
  }

  if (!SHAPE.test(value)) {
    return [
      Issue.enforcedShapeInvalid(
        entry.path,
        value,
        'expected "<repo>:<path>", e.g. "evolutionary:backend/src/test/java/.../SomeTest.java"',
      ),
    ];
  }

  return [];
}
