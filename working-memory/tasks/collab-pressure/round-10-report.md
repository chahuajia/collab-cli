# 第 10 轮暴露报告

**日期**：2026-09-17 ｜ **642/0** 绿（+4 tests）

| # | 结果 | 证据 |
| :-- | :--- | :--- |
| C1 | ✅ | CLI catalog.json ≡ MCP entries（忽略 generatedAt） |
| C2 | ✅ | MCP 不写盘 |
| C3 | ✅ | MCP type 过滤 ⊆ 磁盘 entries |
| C4 | ✅ | 磁盘 stale、MCP live total=2、validate CATALOG_STALE |

拦截 **0** · gap **0**
