# 压测第 4 轮：parse → apply 联动

**日期**：2026-09-17 ｜ **复杂点**：文本协议进料 · buildBundle 唯一生产者 · MCP/CLI 同形

## 暴露点

| # | 检验什么 | 预期 KB |
| :-- | :--- | :--- |
| **C1** | parse → apply --index → validate 全绿 | A10 · base-contract |
| **C2** | 多 FILE 块 → 一次 apply 刷新 catalog | design-decision |
| **C3** | parse 后文件被改 → apply 拒绝 stale base | reproducible-verification |
| **C4** | MCP collab_parse 产物 → collab_apply_plan 可吃 | cli-agent-boundaries |
| **C5** | buildBundle 为 CLI/MCP 唯一生产者 | parse-dont-validate |

## 成功标准

新增测试覆盖 C1–C4，`npm run check` 绿。
