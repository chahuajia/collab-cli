import { Issue } from "@/domain/validation/Issue";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { SeverityValues } from "@/domain/validation/Severity";

/**
 * `collab parse` 的 Issue 工厂。
 *
 * @remarks
 * 与 `apply` 的分工：**`parse` 管"切分对不对"，`apply` 管"路径安不安全、冲突不冲突"**。
 * 两者失败模式不同，所以 Issue 也分开 —— 混在一起就无法定位。
 *
 * **严重程度按 ADR-0012 分配**：单个块的问题一律 Warning（跳过它，别废掉整批），
 * 只有"一个合法块都没有"才是 Error。判据由 `Issue.isBlocking()` 给出。
 */
export const ParseIssues = {
  /** 一个合法块都没有 —— 整批拒收（唯一还阻断的形态）。 */
  invalid(reason: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.ParseInvalid,
      message: reason,
      suggestion:
        'a block is a YAML frontmatter block ("---" … "---") carrying `id` and `type`; the path is derived from them',
    });
  },

  /**
   * 一个块被跳过 —— **宽容 ≠ 静默**（ADR-0012）。
   *
   * @remarks
   * 它是 **Warning 级**：跳过不阻断整批，但**必须报出来**。
   * 判据据此从 `issues.length > 0` 改为 `issues.some(isBlocking)` ——
   * 否则一旦开始宽容，`parse` 会因为"有 warning"而整体失败，等于没宽容。
   */
  skipped(reason: string, snippet: string): Issue {
    return Issue.of({
      severity: SeverityValues.Warning,
      code: IssueCodeValues.ParseSkippedBlock,
      message: `skipped a block: ${reason}`,
      suggestion: `first line: ${snippet}`,
    });
  },

  /** 块内容为空或纯空白 —— 多半是粘贴截断。 */
  emptyBlock(path: string): Issue {
    return Issue.of({
      severity: SeverityValues.Warning,
      code: IssueCodeValues.ParseEmptyBlock,
      message: "block content is empty or whitespace-only",
      path,
      suggestion: "the paste was probably truncated — re-copy the full output",
    });
  },

  /**
   * 同一个派生路径出现两次 —— **保留最后一个**（ADR-0012 四）。
   *
   * @remarks
   * 硬拒会让整批作废：AI 输出里"修订版我又写了一遍"是常见形态。
   */
  duplicatePath(path: string): Issue {
    return Issue.of({
      severity: SeverityValues.Warning,
      code: IssueCodeValues.ParseDuplicatePath,
      message: "the same path appears more than once — kept the last version",
      path,
      suggestion: "delete the earlier copy from the paste if that was not intended",
    });
  },

  /**
   * 标记声明的路径与 frontmatter 派生的路径不一致 —— **以 frontmatter 为准**（ADR-0012 二）。
   *
   * @remarks
   * 两者都合法，但只有一个是真的。挑 frontmatter 是因为它**自描述**：路径能从它
   * 派生出来，而标记只是一句散文。
   */
  pathMismatch(markerPath: string, derivedPath: string): Issue {
    return Issue.of({
      severity: SeverityValues.Warning,
      code: IssueCodeValues.ParsePathMismatch,
      message: `"===== FILE: ${markerPath} =====" disagrees with the frontmatter — using "${derivedPath}"`,
      suggestion:
        "the marker is only a human hint; the frontmatter (`type` + `id`) is the contract",
    });
  },
} as const;
