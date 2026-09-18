# 第 7 轮暴露报告

**日期**：2026-09-17 ｜ **629/0** 绿（+4 tests）

| # | 结果 | 证据 |
| :-- | :--- | :--- |
| C1 | ✅ | new + index → commit → git log |
| C2 | ✅ | 未 index → commit validate failed + Aborting |
| C3 | ✅ | commit 后 validate 0 issues |
| C4 | ✅ | new 链 commit 仍只含 COLLABORATION |

拦截 **0** · gap **0**

**发现**：commit 摘要不含 issue code，需单独 `validate` 看 `MISSING_FROM_INDEX`（同 apply --commit）。
