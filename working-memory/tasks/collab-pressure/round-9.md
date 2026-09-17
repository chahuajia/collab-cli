# 第 9 轮暴露点

**日期**：2026-09-17 ｜ **场景**：`collab catalog` ↔ `CATALOG_STALE` ↔ validate/commit 门禁

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | baseline catalog → new + index → validate 报 `CATALOG_STALE` | index 不能代替 catalog |
| C2 | `collab catalog` → validate 归零 | 生成命令闭环 |
| C3 | `catalog --stdout` 不落盘 → validate 仍失败 | 只读预览对称 |
| C4 | stale catalog 下 commit 被拦 | 延伸 round-7 门禁 |
