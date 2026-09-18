# 第 5 轮暴露点

**日期**：2026-09-17 ｜ **场景**：`collab fix` ↔ `collab validate` 规则对齐

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | 缺 aliases → validate 报 `ID_NOT_IN_ALIASES` → fix → validate 归零 | 同一规则两套入口不打架 |
| C2 | `--dry-run` 不写盘 → validate 仍失败 | 预览与 index/apply 对称 |
| C3 | 无 frontmatter → fix 不猜 → validate 仍报错 | 机械修复边界 |
| C4 | 多文件同轮 fix → validate 一次通过 | 批处理不遗漏 |
