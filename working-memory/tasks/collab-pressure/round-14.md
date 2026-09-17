# 第 14 轮暴露点

**日期**：2026-09-17 ｜ **场景**：MCP `parse` → `apply_plan` → CLI `apply` Agent 写入链

| # | 暴露点 | 预期 |
| :-- | :--- | :--- |
| C1 | MCP parse → apply_plan 预演 → CLI apply --index → validate 绿 | MCP/CLI 写入闭环 |
| C2 | apply_plan `wrote: 0` → CLI apply 后才落盘 | 预演与执行分离 |
| C3 | apply_plan 拒 stale base → CLI apply 同拒 | 乐观锁跨边界 |
| C4 | 落盘后 MCP content validate 绿 | 写后可读可验 |
