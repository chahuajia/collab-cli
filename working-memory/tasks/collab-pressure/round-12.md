# 第 12 轮暴露点

**日期**：2026-09-17 ｜ **场景**：MCP `search` → `read` → `validate` Agent 发现链

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | search 命中 → read 同 id 全文可读 | 定位到阅读闭环 |
| C2 | content scope 绿、standard scope 红（无 index） | Agent 先读内容、后补索引 |
| C3 | search 零命中 → read 不猜、validate 仍可按 scope 跑 | 空结果不是协议错 |
| C4 | 缺章节条目：read 可读、content validate 报错 | 读≠合法 |
