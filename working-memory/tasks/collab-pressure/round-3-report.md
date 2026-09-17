# 第 3 轮暴露报告

**日期**：2026-09-17 ｜ **613/0** 绿

| # | 结果 |
| :-- | :--- |
| C1 | ✅ apply 刷 catalog、不刷 index（除非 `--index`） |
| C2 | ✅ contentRules 门禁 exit 0 |
| C3 | ✅ 全量 validate / `--commit` → `MISSING_FROM_INDEX`（commit  stdout 不展开 code，须 `validate` 看详情） |
| C4 | ✅ E8 stale base_sha256 已有覆盖 |

拦截 **0** · gap **0**
