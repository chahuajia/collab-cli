# 第 5 轮暴露报告

**日期**：2026-09-17 ｜ **621/0** 绿（+4 tests）

| # | 结果 | 证据 |
| :-- | :--- | :--- |
| C1 | ✅ | validate → fix → validate 0 issues |
| C2 | ✅ | fix --dry-run 不写盘，validate 仍报 ID_NOT_IN_ALIASES |
| C3 | ✅ | 无 frontmatter → fix 不碰 → validate 仍失败 |
| C4 | ✅ | 双条目一次 fix → validate 2 entries 0 issues |

拦截 **0** · gap **0**
