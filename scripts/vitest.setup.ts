// scripts/vitest.setup.ts

/**
 * 测试进程的**环境卫生**：删掉会改写"工作区 / 仓指向"的环境变量。
 *
 * @remarks
 * **为什么必须有这一层（2026-10-06 实测事故）**：
 *
 * 开发机在**用户级**设了 `COLLAB_DIR=<共享知识库>`（合理需求：让 `collab` 在任何目录都能找到库）。
 * 而 `findCollabRoot` 的优先级是 **`--dir` > `COLLAB_DIR` > 向上找 `.git`** ——
 * 于是测试进程里那些**不带 `--dir`、靠 cwd 找临时工作区**的用例，
 * 通通指向了**真知识库**：
 *
 * - `collab new` 往真库里写了条目（这次被"拿不到作者标识"挡住了一半）；
 * - `collab commit` 把真库的文件 **`git add`** 进了暂存区；
 * - 全量 `pnpm run check` 的结论变成 **83 条失败 + 真库被暂存了 7 项改动**。
 *
 * 同一个形状的教训本仓已经吃过一次（测试默默依赖"作者机器上恰好有两个业务仓"）。
 * 那次是在**每个 harness 里**钉环境；这次改成**进程级**：setup 文件先删干净，
 * 任何测试再也继承不到开发机的指向。个别测试要用的（`COLLAB_REAL_KB`）**不在删除名单**里。
 *
 * 出声：删了什么就打印什么 —— 静默地"纠正"环境同样会让人误判。
 */

/** 会改写"工作区 / 仓指向"的变量。**不含 `COLLAB_REAL_KB`** —— 那条是真库测试要用的。 */
const REDIRECTING_ENV_VARS = [
  "COLLAB_DIR",
  "COLLAB_PROJECTS_DIR",
  "COLLAB_CLI_DIR",
  "COLLAB_KB_DIR",
  "EVOLUTIONARY_DIR",
] as const;

const removed: string[] = [];
for (const name of REDIRECTING_ENV_VARS) {
  if (process.env[name] !== undefined) {
    delete process.env[name];
    removed.push(name);
  }
}

if (removed.length > 0) {
  console.warn(
    `[vitest.setup] 测试进程已删除会改写工作区/仓指向的环境变量：${removed.join(", ")}` +
      `（开发机上的值不动 —— 只是不让测试继承它）`,
  );
}
