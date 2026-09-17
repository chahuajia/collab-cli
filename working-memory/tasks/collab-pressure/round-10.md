# 第 10 轮暴露点

**日期**：2026-09-17 ｜ **场景**：CLI `collab catalog` ↔ MCP `collab_catalog` 同形

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | CLI 写 catalog.json → MCP 条目与 summary 一致（忽略 generatedAt） | 双入口同投影 |
| C2 | MCP 仍不写盘 | 只读工具无副作用 |
| C3 | MCP type 过滤 ⊆ 磁盘 catalog entries | 过滤是子集 |
| C4 | 工作区新增条目、磁盘 catalog 过期 → MCP 仍 live、validate 报 CATALOG_STALE | live vs 落盘分离 |
