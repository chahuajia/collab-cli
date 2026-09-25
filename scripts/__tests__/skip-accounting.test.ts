import { describe, expect, it } from "vitest";
import {
  collectSkips,
  isAllowed,
  parseVitestReport,
  passedCount,
  skippedCount,
  unattributedSkips,
  unlistedSkips,
} from "../lib/skip-accounting.js";
import type { Allowlist, VitestReport } from "../lib/skip-accounting.js";

/**
 * `test:ci` 的判定逻辑。
 *
 * @remarks
 * 这些函数原先埋在 `assert-no-skips.mjs` 里（与起进程、读文件混在一起），
 * 于是**门禁的判据本身**没有任何测试 —— 而它的输出正是"验过了"与"根本没验"
 * 的分界线。拆出来之后，边界情形可以用一份 JSON 直接钉住。
 */

const ROOT = "D:/repo";

function report(overrides: Partial<VitestReport>): VitestReport {
  return { testResults: [], ...overrides };
}

function file(name: string, assertions: readonly { status: string; fullName?: string }[]) {
  return {
    name: `${ROOT}/src/${name}`,
    assertionResults: assertions.map((a) => ({
      status: a.status,
      fullName: a.fullName ?? a.status,
    })),
  };
}

describe("skip-accounting", () => {
  it("parseVitestReport：读得懂就受信，读不懂就 null（不用 as 硬说）", () => {
    expect(parseVitestReport(null)).toBeNull();
    expect(parseVitestReport("not a report")).toBeNull();
    expect(parseVitestReport([1, 2, 3])).toBeNull();

    const parsed = parseVitestReport({
      numPassedTests: 3,
      numPendingTests: 1,
      testResults: [{ name: "a.test.ts", assertionResults: [{ status: "pending", fullName: "x" }] }],
    });
    expect(parsed?.numPassedTests).toBe(3);
    expect(parsed?.numPendingTests).toBe(1);
    expect(parsed?.testResults?.[0]?.assertionResults?.[0]?.fullName).toBe("x");
  });

  it("parseVitestReport：字段形状不对时降级，不抛", () => {
    const parsed = parseVitestReport({ numPassedTests: "3", testResults: "nope" });
    expect(parsed?.numPassedTests).toBeUndefined();
    expect(parsed?.testResults).toEqual([]);
  });

  it("数通过 / 跳过：用 jest 的字段名（pending + todo，不是 numSkipped）", () => {
    const r = report({ numPassedTests: 12, numPendingTests: 2, numTodoTests: 1 });
    expect(passedCount(r)).toBe(12);
    expect(skippedCount(r)).toBe(3);
  });

  it("收集跳过：路径转成相对仓库根", () => {
    const r = report({
      testResults: [file("cli/a.test.ts", [{ status: "passed" }, { status: "pending", fullName: "x > y" }])],
    });
    expect(collectSkips(r, ROOT)).toEqual([{ file: "src/cli/a.test.ts", name: "x > y" }]);
  });

  it("未声明就红：这是门禁的全部意义", () => {
    const r = report({
      testResults: [file("cli/a.test.ts", [{ status: "skipped", fullName: "needs real KB" }])],
    });
    expect(unlistedSkips(r, { allowed: [] }, ROOT)).toHaveLength(1);
  });

  it("已声明的跳过放行（按文件 + 名字片段）", () => {
    const r = report({
      testResults: [file("cli/a.test.ts", [{ status: "skipped", fullName: "needs real KB > case 1" }])],
    });
    const allowlist: Allowlist = {
      allowed: [{ file: "src/cli/a.test.ts", name: "needs real KB" }],
    };
    expect(unlistedSkips(r, allowlist, ROOT)).toEqual([]);
  });

  it("豁免不跟着文件走：换文件必须重新声明", () => {
    const allowlist: Allowlist = { allowed: [{ file: "src/cli/a.test.ts" }] };
    const skip = { file: "src/cli/b.test.ts", name: "anything" };
    expect(isAllowed(skip, allowlist)).toBe(false);
  });

  it("归因缺口：报告说跳了 N 个，却只枚举出 M 个 → 不可审计", () => {
    // 整个文件被 skip 时，assertionResults 为空
    const r = report({ numPendingTests: 3, testResults: [{ name: `${ROOT}/src/cli/a.test.ts` }] });
    expect(unattributedSkips(r, ROOT)).toBe(3);
  });

  it("全绿：0 跳过、0 未声明", () => {
    const r = report({
      numPassedTests: 5,
      testResults: [file("cli/a.test.ts", [{ status: "passed" }, { status: "passed" }])],
    });
    expect(unlistedSkips(r, { allowed: [] }, ROOT)).toEqual([]);
    expect(unattributedSkips(r, ROOT)).toBe(0);
  });
});
