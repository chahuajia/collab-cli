# Working Memory

**更新**：2026-09-17 09:35

## ⚠️ 先跑这个

```powershell
node working-memory/check-freshness.mjs
```

**登记（本版）**：

| 仓库 | 登记 HEAD |
| :--- | :--- |
| `collab-cli` | `cd69a65` |
| `collaboration` | `54a37ea` |
| `evolutionary` | `1cf3bb4` |

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **CLI A4 长运行** | 🔄 锚点迁移完成，下一：真 CI | `tasks/cli-development/loop.md` |
| **evolutionary 压测** | ✅ 4–15 轮收口 | `evolutionary/specs/pressure-test-retro.md` |

## 复盘行动项

| # | 状态 |
| :-- | :--- |
| A1 REST/N+1 症状行 | ✅ v4.7.15 |
| A2 S34 症状行 | ✅ v4.7.15 |
| A3 不批量填 trigger | ✅ 维持 |
| A4 切 CLI / 真 CI | 🔄 锚点闭环；真 CI 待启动 |
| A5 domain-purity 写硬 | 待人 |

## 测量

- interceptions **5** · known-gaps **2** 开
- 真库 validate：**113 / 0**（锚点迁移后）

## 陷阱

AI 不 push
