# 第 16 轮暴露报告

**日期**：2026-09-17 ｜ **666/0** 绿（+4 tests）

| # | 结果 | 证据 |
| :-- | :--- | :--- |
| C1 | ✅ | stdout 含 `applied` + `validate-failed` 两段 JSON |
| C2 | ✅ | validate-failed issues 含 DEAD_LINK |
| C3 | ✅ | 落盘不回滚 |
| C4 | ✅ | 后续 validate --json 仍报 DEAD_LINK |

拦截 **0** · gap **1**（→ round 17 已修）

**发现**：`--json` 失败时曾双 JSON 输出；round 17 改为 validate 后再 emit 唯一 payload。
