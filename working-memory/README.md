# Working Memory

**更新**：2026-09-18 21:50

## ⚠️ 先跑这个

```powershell
node working-memory/check-freshness.mjs
```

**登记（本版）**：

| 仓库 | 登记 HEAD |
| :--- | :--- |
| `collab-cli` | `cb22d38` |
| `collaboration` | `d45a3c2` |
| `evolutionary` | `374d5fd` |

> 已接 `.husky/pre-push`。仓库路径可用 `COLLAB_CLI_DIR` / `COLLAB_KB_DIR` /
> `EVOLUTIONARY_DIR` 覆盖；**路径不可达是硬失败，不是跳过**。

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **collab-pressure-extreme** | ✅ 已停（idle 3 · v4.8.7） | `tasks/collab-pressure-extreme/loop.md` |
| **evo-collab-extreme** | 🔄 双轴极端 · 集群切片1 | `tasks/evo-collab-extreme/loop.md` |
| **collab-pressure** | ✅ round 1–17 | `tasks/collab-pressure/loop.md` |
| CLI A4 | ✅ 收口 | `tasks/cli-development/loop.md` |

## 测量

- collaboration：validate **119/0** · patterns trigger **50/50** · catalog patterns **49/49**
- known-gaps：**开 1**（WM 新鲜度）· trigger 覆盖缺口已关
- interceptions：见 KB 主表

## 陷阱

AI 不 push；merge `version/v0` / topic 须确认
