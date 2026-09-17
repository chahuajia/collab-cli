# Collaboration 复杂场景选择性压测

**启动**：2026-09-17 ｜ **压力源**：`collab-cli` 复杂功能 ｜ **非 A/B**

## 方法

1. 每轮**先写** `round-N.md` 暴露点（不可事后改）
2. 按 KB `AGENTS.md` 症状表路由，不靠回忆
3. 找不到 → `known-gaps`；拦住 → `interceptions`
4. 复杂 = 多命令/多规则/多仓库联动，非 hello-world

## 轮次规划（初稿）

| 轮 | 复杂场景 | 预期 KB 条目 |
| :-- | :--- | :--- |
| 1 | `collab index --dry-run`（写命令的对称只读预览） | A10 · design-decision |
| 2 | MCP validate + 真库路径 `--dir` | cli-agent-boundaries · S10 |
| 3 | apply 冲突 + catalog/index 派生链 | base-contract · reproducible-verification |
| 4 | parse → apply 联动 | ✅ |
| 5 | fix ↔ validate 规则对齐 | ✅ |
| 6 | new → index → validate 工作流 | ✅ |
| 7 | new → index → commit 发布链 | ✅ |
| 8 | new → index → commit → push 全链 | ✅ |
| 9 | catalog ↔ CATALOG_STALE 门禁 | ✅ |
| 10 | CLI catalog ↔ MCP collab_catalog | ✅ |
| 11 | 发布链补 catalog 步 | ✅ |
| 12 | MCP search → read → validate | ✅ |
| 13 | collab memory WM 新鲜度 | ✅ |
| 14 | MCP parse → CLI apply 写入链 | ✅ |
| 15 | fix → index → catalog 修复链 | ✅ |
| 16+ | 待暴露 | — |

## 测量

同 evolutionary：interceptions 计数 · known-gaps 行 · validate 归零
