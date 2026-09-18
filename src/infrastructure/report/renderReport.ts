import { SeverityValues } from "@/domain/validation/Severity";
import type { Issue } from "@/domain/validation/Issue";
import type { ValidationReport } from "@/domain/validation/ValidationReport";


export interface RenderOptions {
  readonly useColor: boolean;
}

// ─────────────────────────────────────────────
// 颜色工具
// ─────────────────────────────────────────────

const ANSI = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
  reset: "\x1b[0m",
} as const;

type ColorName = keyof typeof ANSI;

function paint(text: string, color: ColorName, useColor: boolean): string {
  if (!useColor) return text;
  return `${ANSI[color]}${text}${ANSI.reset}`;
}

// ─────────────────────────────────────────────
// 人类可读报告（D1 / D2 / D5 / D6 / D7）
// ─────────────────────────────────────────────

/**
 * 渲染人类可读的校验报告。
 *
 * @remarks
 * 结构：
 * 1. 摘要行（✔/✖/⚠ + entry 数 + issue 数）
 * 2. 按文件分组的 Issue 列表
 * 3. 末尾汇总（N errors, M warnings）
 */
export function renderHumanReport(
  report: ValidationReport,
  entryCount: number,
  options: RenderOptions,
): string {
  const { useColor } = options;
  const errors = report.errors();
  const warnings = report.warnings();
  const totalIssues = report.count();

  const lines: string[] = [];

  // 1. 摘要行
  const summaryIcon =
    errors.length > 0
      ? paint("✖", "red", useColor)
      : warnings.length > 0
        ? paint("⚠", "yellow", useColor)
        : paint("✔", "green", useColor);

  lines.push(
    `${summaryIcon} COLLABORATION validated: ${entryCount} entries, ${totalIssues} issues`,
  );
  lines.push("");

  // 2. 按文件分组
  if (totalIssues > 0) {
    const groups = groupByPath(report.issues);
    for (const [filePath, issues] of groups) {
      const groupIcon = issues.some((i) => i.isBlocking())
        ? paint("✖", "red", useColor)
        : paint("⚠", "yellow", useColor);
      lines.push(`${groupIcon} ${filePath}`);

      for (const issue of issues) {
        lines.push(renderIssueLine(issue, useColor));
        if (issue.suggestion) {
          lines.push(`    → ${issue.suggestion}`);
        }
      }
      lines.push("");
    }
  }

  // 3. 汇总
  lines.push(
    `Summary: ${errors.length} error${errors.length === 1 ? "" : "s"}, ` +
      `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`,
  );

  return lines.join("\n") + "\n";
}

function renderIssueLine(issue: Issue, useColor: boolean): string {
  const severityTag =
    issue.severity === SeverityValues.Error
      ? paint("[ERROR]", "red", useColor)
      : paint("[WARNING]", "yellow", useColor);
  return `  ${severityTag} ${issue.code}: ${issue.message}`;
}

/**
 * 按 `issue.path` 分组。
 *
 * @remarks
 * 保持 `path` 在报告中的"首次出现顺序"——不排序。
 * 无 path 的 issue 归到 `(no path)` 组。
 */
function groupByPath(issues: readonly Issue[]): Map<string, Issue[]> {
  const groups = new Map<string, Issue[]>();
  for (const issue of issues) {
    const key = issue.path ?? "(no path)";
    const arr = groups.get(key);
    if (arr) arr.push(issue);
    else groups.set(key, [issue]);
  }
  return groups;
}

// ─────────────────────────────────────────────
// JSON 报告（D3=A）
// ─────────────────────────────────────────────
const JSON_INDENT = 2;
/**
 * 渲染 JSON 格式的校验报告。
 *
 * @remarks
 * 用于 CI 和脚本调用。
 * 结尾带换行——符合"每行一个 JSON"的 shell 友好约定。
 */
export function renderJsonReport(
  report: ValidationReport,
  entryCount: number,
): string {
  const errors = report.errors();
  const warnings = report.warnings();

  const payload = {
    entries: entryCount,
    issues: report.issues.map((issue) => {
      const obj: Record<string, unknown> = {
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
      };
      if (issue.path !== undefined) obj.path = issue.path;
      if (issue.suggestion !== undefined) obj.suggestion = issue.suggestion;
      if (issue.docs !== undefined) obj.docs = issue.docs;
      return obj;
    }),
    summary: {
      errors: errors.length,
      warnings: warnings.length,
    },
  };

  return JSON.stringify(payload, null, JSON_INDENT) + "\n";
}
