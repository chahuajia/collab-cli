# 压测第 2 轮：MCP validate + 显式 `--dir`

**日期**：2026-09-17 ｜ **复杂点**：MCP 进程 cwd ≠ 知识库根；客户端靠 `dir` 参数跨仓校验

## 暴露点

| # | 检验什么 |
| :-- | :--- |
| **C1** | `integrations/cli-agent-boundaries` / S10：MCP 只读、validate 门禁 |
| **C2** | `dir` 参数覆盖启动时 workspace（无进程级泄漏） |
| **C3** | 真库 113 entries / 0 issues 经 MCP 工具可达 |
| **C4** | `ctx.dir=null` 时仅 `dir` 参数可工作 |
