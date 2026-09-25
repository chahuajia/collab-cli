# scripts —— 工具链（**不是产品**）

> 这里是开发/门禁用的脚本，**不随包发布**（`files` 里没有 `scripts/`）。
> 产品代码在 `src/`；脚本的类型检查走单独的 `tsconfig.tooling.json`。

## 两个区

| 区 | 是什么 | 谁在跑 |
| :--- | :--- | :--- |
| `*.ts`（顶层） | **活的工具** | `npm run build` / `npm run test:ci` / `npm run memory` |
| `lib/` | 工具共用的**纯逻辑**（有单测） | 被上面两者 import |
| `one-off/` | **跑过的一次性迁移 / 实验**（档案，不接任何门禁） | 只在人手动调用时 |
| `__tests__/` | 工具链自己的测试（`vitest` 会跑；见 `vitest.config.ts`） | `npm run test` |

## 为什么脚本也要分层

2026-09-26 的三次实测（都写进了 `working-memory/tasks/ddd-refactor-cli.md`）：

1. **门禁的判据不能埋在 I/O 里**。`assert-no-skips` 原先把"起 vitest 进程"与
   "哪些跳过该被允许"混在一个 `.mjs` 里，于是这条门禁的判据**没有任何测试** ——
   而它的输出正是"验过了"与"根本没验"的分界线。现在判定在
   `lib/skip-accounting.ts`（纯函数，`__tests__/skip-accounting.test.ts` 覆盖）。
2. **手抄的清单必然漂移**。迁移脚本各自抄过一份 `ENTRY_KIND_DIRS`，其中一份
   **少了 `integrations`** —— 集成层的条目会被它静默跳过。现在目录从
   `@/domain/entry/types` 的 `EntryKindDir` **派生**（`lib/entryFiles.ts`）。
3. **`.mjs` 逃出类型检查**。`scripts/**/*.mjs` 既不被 `tsc` 检查、也不被 `eslint src` 扫到。
   转 TS 后两者都覆盖（`npm run typecheck` 跑两个 project，`npm run lint` 扫 `src` + `scripts`）。

## 跑法

```bash
npm run build          # 内部：tsx scripts/clean-dist.ts && tsc && tsc-alias
npm run test:ci        # 内部：tsx scripts/assert-no-skips.ts
npm run memory         # 内部：tsx scripts/check-freshness.ts（+ `:draft` / `:attest`）
npm run typecheck      # tsc --noEmit && tsc -p tsconfig.tooling.json
tsx scripts/one-off/add-dates.ts <collab-dir> --dry-run   # 迁移脚本：先 dry-run
node scripts/one-off/reach-check.cjs <dist> <KB>          # 实验脚本：三个路径都要给（不留本机默认值）
```

> **`check-freshness` 是 2026-09-26 搬进来的**（原先在 `working-memory/check-freshness.mjs`）：
> 它是 `.mjs` 且在 `scripts/` 之外 —— 正是本页第 3 条说的逃逸层，而且它是**最后一处**。
> 判据拆到了 `lib/freshness.ts`（有单测），三仓路径走
> `@/infrastructure/fs/repoRoots`（**不再有 `D:\actto\...` 这种绝对路径**：
> 那种默认值还随 0.5.1 发到了 npm）。

**迁移脚本的前置警告**：`one-off/` 里的目录清单已经改为派生，但**别直接跑** ——
它们是 2026-09 那几次迁移的现场存档，跑之前先照现契约核对一遍。

> **2026-09-26 追加**：`one-off/` 里的 `reach-check.cjs` 原先在 `working-memory/` 下，
> 且写着作者本机的两个绝对路径。搬过来时改成**必填参数**（不留默认值）——
> 标本可以失效，但不该把某台机器的盘符带进公开仓。
