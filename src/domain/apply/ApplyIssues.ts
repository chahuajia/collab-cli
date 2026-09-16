import { AllowedBundleTopLevelDirs } from "@/domain/apply/BundlePolicy";
import { Issue } from "@/domain/validation/Issue";
import { IssueCodeValues } from "@/domain/validation/IssueCode";
import { SeverityValues } from "@/domain/validation/Severity";

/**
 * `collab apply` 的 Issue 工厂。
 *
 * @remarks
 * 集中在此处（S14）：业务代码里不出现裸的 Issue 字面量。
 * 与校验规则用的 `Issue.*` 工厂分开 —— 那是"知识库不合法"，
 * 这里是"bundle 不能被接受"，两者的受众与修复动作不同。
 *
 * 全部为 `error`：apply 的预检是"全有或全无"，
 * 任何一条不过都意味着"一个文件都不写"。
 */
export const ApplyIssues = {
  /**
   * bundle 本身不可用（JSON 不可解析 / 形状不符 / 空的 files）。
   */
  invalid(reason: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.BundleInvalid,
      message: reason,
      suggestion: "fix the bundle and retry",
    });
  },

  /**
   * 路径不安全（绝对路径 / 含 `..` / 空段 / 不指向文件）。
   */
  unsafePath(rawPath: string, reason: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.BundlePathInvalid,
      message: `unsafe path "${rawPath}": ${reason}`,
      path: rawPath,
    });
  },

  /**
   * 路径不在允许的顶层目录白名单内。
   */
  pathNotAllowed(rawPath: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.BundlePathInvalid,
      message: `path "${rawPath}" is outside the allowed directories`,
      path: rawPath,
      suggestion: `allowed top-level directories: ${AllowedBundleTopLevelDirs.join(", ")}`,
    });
  },

  /**
   * 内容为空或纯空白。
   *
   * @remarks
   * 这条是 `apply` 存在的首要理由之一 —— 回归 2026-09-15 的
   * "37 个文件里 35 个 0 字节"事故。
   */
  emptyContent(path: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.BundleEmptyContent,
      message: "content is empty or whitespace-only",
      path,
      suggestion: "remove the file from the bundle, or provide real content",
    });
  },

  /**
   * 声明的 sha256 与内容实际哈希不符（bundle 被篡改或损坏）。
   */
  hashMismatch(path: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.BundleHashMismatch,
      message: "sha256 does not match the content",
      path,
      suggestion: "regenerate the bundle (the content and its hash disagree)",
    });
  },

  /**
   * `create` 但目标已存在。
   */
  createTargetExists(path: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.BundleConflict,
      message: "file already exists, but the bundle says create",
      path,
      suggestion: 'change the action to "replace", or delete the file first',
    });
  },

  /**
   * `replace` 但目标不存在。
   */
  replaceTargetMissing(path: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.BundleConflict,
      message: "file does not exist, but the bundle says replace",
      path,
      suggestion: 'change the action to "create"',
    });
  },

  /**
   * `replace` 的 `base_sha256` 与文件当前内容不符。
   */
  baseHashMismatch(path: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.BundleConflict,
      message:
        "base_sha256 does not match the current file (the file was modified externally)",
      path,
      suggestion: "re-read the file, rebase the bundle, then retry",
    });
  },

  /**
   * `delete` 但目标不存在。
   */
  deleteTargetMissing(path: string): Issue {
    return Issue.of({
      severity: SeverityValues.Error,
      code: IssueCodeValues.BundleConflict,
      message: "file does not exist, but the bundle says delete",
      path,
      suggestion: "remove the entry from the bundle",
    });
  },
} as const;
