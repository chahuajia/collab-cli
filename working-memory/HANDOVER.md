# 交接：本文件已改为**指针**

**更新**：2026-09-19

**真相在这里**：

```
D:\actto\front\project\evolutionary_start\evolutionary\working-memory\HANDOVER.md
```

（相对本仓：`..\..\evolutionary_start\evolutionary\working-memory\HANDOVER.md`）

---

## 为什么不再放副本

这个文件此前是交接文档的**副本**（与 evolutionary 侧同构）。2026-09-19 发现了两件事：

1. **两份副本必然漂移** —— evolutionary 侧已经更新到 wave42 收口、基线 218/0、
   集群可运行；而这里的副本仍写着 `HEAD 303dc35` 和「⏸ 暂停 · 未说继续勿派子代理」。
   **一个过期的交接文档比没有更坏** —— 它长得像"查过了"。
2. **谁来更新它，没有规定** —— 于是两边各更新各的，或者都不更新。

这与 KB 里 `patterns/derivation-over-copy` 是同一条：
**副本的成本不是写的那一次，是之后每一次同步。** 而这里连"之后"都没有。

## 本仓该记什么

**只记本仓自己的事**（`working-memory/` 的其他文件照常）：

| 文件 | 内容 |
| :--- | :--- |
| `README.md` | 本仓当前状态 + `**更新**：` 时间戳（`check-freshness` 会看） |
| `AGENTS.md` | 活跃任务表（含 evolutionary 侧任务的**状态指针**） |
| `tasks/` | 本仓自己的任务记录 |

**跨仓的进度、波次、基线 → 一律以 evolutionary 侧为准**，不要在这里抄第二份。

## 历史 v1 副本

2026-09-19 之前的副本内容已无独立价值（它描述的是 `303dc35` 时刻的状态，
那之后 evolutionary 已前进若干提交）。需要回溯请查 git 历史。
