# 第 13 轮暴露点

**日期**：2026-09-17 ｜ **场景**：`collab memory` WM 新鲜度（与 validate 正交）

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | 多个 current-state 文件过期 → stderr 全列出 | 不静默遗漏 |
| C2 | `--max-age 0` 对昨日文件失败 | 参数生效 |
| C3 | 修复过期文件 → memory 归零 | 可修复闭环 |
| C4 | memory 失败时 COLLABORATION validate 仍独立 | 两域不打架 |
