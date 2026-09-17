# 第 16 轮暴露报告

**日期**：2026-09-17 ｜ **666/0** 绿（+4 tests）

| # | 结果 | 证据 |
| :-- | :--- | :--- |
| C1 | ✅ | stdout 含 `applied` + `validate-failed` 两段 JSON |
| C2 | ✅ | validate-failed issues 含 DEAD_LINK |
| C3 | ✅ | 落盘不回滚 |
| C4 | ✅ | 后续 validate --json 仍报 DEAD_LINK |

拦截 **0** · gap **1**（候选）

**发现（gap 候选）**：`--json` 失败时 stdout 先 emit `applied` 再 emit `validate-failed`——脚本应取末段或按 status 过滤。
