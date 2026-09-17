# 第 6 轮暴露点

**日期**：2026-09-17 ｜ **场景**：`collab new` → `collab index` → `collab validate` 工作流

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | 有空 index、条目未登记 → validate 报 `MISSING_FROM_INDEX` → index → 归零 | 文档提醒的下一步真能闭环 |
| C2 | `--dry-run` 不写盘 → validate 无新条目 | 与 index/apply/fix 对称 |
| C3 | 自动 id + index → validate 全绿 | 零手工 id 路径 |
| C4 | 连续 new 两条 → 一次 index 同步两条 | 批处理不遗漏 |
