// scripts/lib/skip-accounting.ts

/**
 * `test:ci` 的**判定逻辑**（纯函数，不碰文件系统）。
 *
 * @remarks
 * 从 `assert-no-skips.mjs` 里拆出来的：那个脚本把"跑测试"（I/O）与
 * "哪些跳过该被允许"（判定）混在一处，于是这条**门禁的判据本身**没有任何测试 ——
 * 而它的输出正是"验过了"与"根本没验"的分界线。
 *
 * 这里的每个函数都能用一份 JSON 报告直接调用（见 `scripts/__tests__/`）。
 */

/** vitest JSON 报告里的一条断言（沿用 jest 的字段名）。 */
export interface VitestAssertion {
  readonly status?: string | undefined;
  readonly fullName?: string | undefined;
  readonly title?: string | undefined;
  readonly failureMessages?: readonly string[] | undefined;
}

export interface VitestFileResult {
  readonly name?: string | undefined;
  readonly assertionResults?: readonly VitestAssertion[] | undefined;
}

export interface VitestReport {
  readonly testResults?: readonly VitestFileResult[] | undefined;
  /** vitest 用 jest 的字段名：跳过 = pending + todo（**不是** `numSkipped`） */
  readonly numPendingTests?: number | undefined;
  readonly numTodoTests?: number | undefined;
  readonly numPassedTests?: number | undefined;
}

/** 一个被跳过的测试。 */
export interface Skip {
  readonly file: string;
  readonly name: string;
}

/** 允许清单里的一条：按文件，或按"文件 + 名字片段"。 */
export interface AllowEntry {
  readonly file: string;
  readonly name?: string | undefined;
}

export interface Allowlist {
  readonly allowed: readonly AllowEntry[];
}

export const EMPTY_ALLOWLIST: Allowlist = { allowed: [] };

/** 点名失败时只回显前几行 —— 报告是给"知道往哪看"的人用的，不是全文倾倒。 */
const FAILURE_LINES = 3;

/**
 * 把 `JSON.parse` 出来的 `unknown` **解析**成受信形状。
 *
 * @remarks
 * "parse, don't validate"：调用方拿到的要么是 `VitestReport`，要么是 `null` ——
 * 不允许用 `as` 把 `unknown` 硬说成报告（那正是本仓禁止的断言，也是
 * 这个脚本原来唯一没被类型保护的地方）。
 */
export function parseVitestReport(raw: unknown): VitestReport | null {
  if (!isRecord(raw)) return null;
  const files = raw["testResults"];
  return {
    testResults: Array.isArray(files) ? files.map(parseFileResult) : [],
    numPendingTests: readNumber(raw["numPendingTests"]),
    numTodoTests: readNumber(raw["numTodoTests"]),
    numPassedTests: readNumber(raw["numPassedTests"]),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function parseFileResult(value: unknown): VitestFileResult {
  const raw = isRecord(value) ? value : {};
  const assertions = raw["assertionResults"];
  const name = raw["name"];
  return {
    name: typeof name === "string" ? name : undefined,
    assertionResults: Array.isArray(assertions) ? assertions.map(parseAssertion) : [],
  };
}

function parseAssertion(value: unknown): VitestAssertion {
  const raw = isRecord(value) ? value : {};
  const status = raw["status"];
  const fullName = raw["fullName"];
  const title = raw["title"];
  const messages = raw["failureMessages"];
  return {
    status: typeof status === "string" ? status : undefined,
    fullName: typeof fullName === "string" ? fullName : undefined,
    title: typeof title === "string" ? title : undefined,
    failureMessages: Array.isArray(messages)
      ? messages.filter((m): m is string => typeof m === "string")
      : [],
  };
}

/** 把报告里的 `name` 变成相对仓库根的路径（报告里是绝对路径）。 */
function relative(projectRoot: string, name: string | undefined): string {
  const raw = name ?? "(unknown file)";
  return raw.split("\\").join("/").replace(`${projectRoot.split("\\").join("/")}/`, "");
}

function nameOf(assertion: VitestAssertion): string {
  return assertion.fullName ?? assertion.title ?? "(unnamed test)";
}

/**
 * 报告里的失败测试（用于"失败了就点名"，而不是只说"未通过"）。
 *
 * @returns 无失败时返回空数组
 */
export function failedTests(
  report: VitestReport,
  projectRoot: string,
): readonly { readonly file: string; readonly name: string; readonly message: string }[] {
  const failed: { file: string; name: string; message: string }[] = [];
  for (const file of report.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      if (assertion.status !== "failed") continue;
      failed.push({
        file: relative(projectRoot, file.name),
        name: nameOf(assertion),
        message: (assertion.failureMessages ?? [])
          .join("\n")
          .split("\n")
          .slice(0, FAILURE_LINES)
          .join("\n"),
      });
    }
  }
  return failed;
}

/** 报告里所有"被跳过"的测试（pending / skipped / todo）。 */
export function collectSkips(report: VitestReport, projectRoot: string): readonly Skip[] {
  const skips: Skip[] = [];
  for (const file of report.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      const status = assertion.status;
      if (status !== "pending" && status !== "skipped" && status !== "todo") continue;
      skips.push({ file: relative(projectRoot, file.name), name: nameOf(assertion) });
    }
  }
  return skips;
}

/** 报告自称跳过了多少个（pending + todo）。 */
export function skippedCount(report: VitestReport): number {
  return (report.numPendingTests ?? 0) + (report.numTodoTests ?? 0);
}

export function passedCount(report: VitestReport): number {
  return report.numPassedTests ?? 0;
}

/**
 * 这个跳过是否已在允许清单里声明。
 *
 * @remarks
 * 匹配规则：`file` 相同，且（未写 `name` 或 `name` 是本次名字的子串）。
 * 子串匹配是刻意的 —— 测试改名不该让一条已经 review 过的豁免立刻失效，
 * 但**换文件**必须重新声明。
 */
export function isAllowed(skip: Skip, allowlist: Allowlist): boolean {
  return allowlist.allowed.some(
    (entry) =>
      entry.file === skip.file &&
      (entry.name === undefined || skip.name.includes(entry.name)),
  );
}

/** 没被允许的跳过 —— 有它就红。 */
export function unlistedSkips(report: VitestReport, allowlist: Allowlist, projectRoot: string): readonly Skip[] {
  return collectSkips(report, projectRoot).filter((skip) => !isAllowed(skip, allowlist));
}

/**
 * 归因缺口：报告说跳了 N 个，但只对上了 M < N 个。
 *
 * @remarks
 * 通常意味着**整个测试文件被 skip**（断言根本没被枚举）。
 * 归因不了的跳过 = 不可审计 —— 必须红。
 */
export function unattributedSkips(report: VitestReport, projectRoot: string): number {
  return Math.max(0, skippedCount(report) - collectSkips(report, projectRoot).length);
}
