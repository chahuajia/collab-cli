import { Issue } from "@/domain/validation/Issue";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { SeverityValues } from "@/domain/validation/Severity";

/**
 * `collab parse` 的 Issue 工厂。
 *
 * @remarks
 * 与 `apply` 的分工：**`parse` 管"切分对不对"，`apply` 管"路径安不安全、冲突不冲突"**。
 * 两者失败模式不同，所以 Issue 也分开 —— 混在一起就无法定位。
 */
export const ParseIssues = {
  /** 文本结构不合法（块外有内容 / 未闭合 / 一个块都没有）。 */
  invalid(reason: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.ParseInvalid,
      message: reason,
      suggestion:
        'expected blocks: "===== FILE: <path> =====" ... "===== END FILE ====="',
    });
  },

  /** 块内容为空或纯空白 —— 多半是粘贴截断。 */
  emptyBlock(path: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.ParseEmptyBlock,
      message: "block content is empty or whitespace-only",
      path,
      suggestion: "the paste was probably truncated — re-copy the full output",
    });
  },

  /** 同一个 path 出现两次。 */
  duplicatePath(path: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.ParseDuplicatePath,
      message: "the same path appears more than once",
      path,
      suggestion: "keep only the final version of the file",
    });
  },
} as const;
