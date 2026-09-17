# 第 15 轮暴露点

**日期**：2026-09-17 ｜ **场景**：`fix` → `index` → `catalog` → `validate` 修复链

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | 缺 aliases + 未登记 index + catalog 过期 → validate 多 issue | 复合故障 |
| C2 | 仅 fix 不够 → 仍失败 | 单命令不越权 |
| C3 | fix → index → catalog → validate 归零 | 修复链闭环 |
| C4 | fix --dry-run 不推进链 | 预览对称 |
