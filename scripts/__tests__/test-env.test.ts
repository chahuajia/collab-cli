import { describe, expect, it } from "vitest";

/**
 * 守卫：测试进程必须是**隔离**的。
 *
 * @remarks
 * 2026-10-06 实测事故：开发机用户级设了 `COLLAB_DIR=<共享库>`，
 * 而它优先级高于"向上找 `.git`" → 测试里不带 `--dir` 的命令全指向真库，
 * 结果 `collab new` 往真库写条目、`collab commit` 把真库文件 `git add` 进暂存区。
 *
 * 真正干活的是 `scripts/vitest.setup.ts`（vitest.config.ts 的 `setupFiles`）。
 * 这条测试钉住"它确实生效了" —— 有人删掉 setupFiles 时，这里会红。
 */
const REDIRECTING_ENV_VARS = [
  "COLLAB_DIR",
  "COLLAB_PROJECTS_DIR",
  "COLLAB_CLI_DIR",
  "COLLAB_KB_DIR",
  "EVOLUTIONARY_DIR",
] as const;

describe("测试环境隔离", () => {
  it("会改写工作区/仓指向的环境变量都不在测试进程里", () => {
    const leaked = REDIRECTING_ENV_VARS.filter((name) => process.env[name] !== undefined);
    expect(leaked, "setupFiles 没生效？见 scripts/vitest.setup.ts").toEqual([]);
  });

  it("`COLLAB_REAL_KB` 不受影响（真库测试要它，CI 也靠它接线）", () => {
    // 只断言"我们没把它列入删除名单"，不断言它的值（本机可能没有、CI 一定有）
    expect(REDIRECTING_ENV_VARS).not.toContain("COLLAB_REAL_KB");
  });
});
