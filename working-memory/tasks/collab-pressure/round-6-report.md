# 第 6 轮暴露报告

**日期**：2026-09-17 ｜ **625/0** 绿（+4 tests）

| # | 结果 | 证据 |
| :-- | :--- | :--- |
| C1 | ✅ | 空 index + new → MISSING_FROM_INDEX → index → 0 issues |
| C2 | ✅ | new --dry-run 不写盘，validate 仍 0 entries |
| C3 | ✅ | 自动 id + index → validate 全绿 |
| C4 | ✅ | 双 new → 一次 index → 2 entries 0 issues |

拦截 **0** · gap **0**

**发现**：无 index 文件时先报 `MISSING_INDEX`（非 C1 路径）；有空 index 未登记才走 `MISSING_FROM_INDEX`。
