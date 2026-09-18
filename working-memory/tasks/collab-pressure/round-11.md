# 第 11 轮暴露点

**日期**：2026-09-17 ｜ **场景**：round-8 发布链补 `catalog` 步骤

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | 有 baseline catalog → new+index+commit 被 CATALOG_STALE 拦 | round-8 盲区 |
| C2 | + catalog → validate 归零 | catalog 是发布链必要步 |
| C3 | + commit 成功 | 门禁顺序正确 |
| C4 | + push --dry-run 预览 | 全链可发布 |
