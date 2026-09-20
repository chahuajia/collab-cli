# Working Memory

> 跨对话的工作状态。**AI 主动维护，用户只需纠正**。

## 协作库路径

本机协作知识库（COLLABORATION）：
D:\\actto\\front\\project\\collaboration_aggregate\\collaboration
[COLLABORATION 仓库](https://github.com/chahuajia/collaboration)

**AI 不擅自 push**。本地 commit 可以；合并到 version/v0 等须用户确认。
- 远端 URL / 分支以本机 git 为准
- 「继续」≠ 自动 merge / push

**新对话先读**：**真相仓的交接** →
`..\..\evolutionary_start\evolutionary\working-memory\HANDOVER.md`。
本仓的 `HANDOVER.md` 已改为**指针**（两份副本必然漂移，见该文件说明）。

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **collab-pressure-extreme** | ✅ 已停（idle 3 · v4.8.7） | tasks/collab-pressure-extreme/loop.md |
| **evo-collab-extreme** | ▶ 主树父写 · HEAD `c92fcb2` · 前端 159/159 · lint 绿 | `tasks/evo-collab-extreme/loop.md` |
| **collab-pressure** | ✅ L1 收口（round 1–17） | tasks/collab-pressure/loop.md |
| **evolutionary phase-5 复盘** | ✅ 已合 version/v0 · phase 归档 | evolutionary/.../battery-phase-5/retro.md |

## 陷阱（2026-09-17）

- **先改 git 再刷新登记 HEAD 到 WM**，勿空登记
- AI 不 push
- phase 合入 version/v0 须用户明确 merge
- 双轴勿混：version × phase 分开 commit/WM，勿互相顶替

## 已结束

见 tasks/_completed/；phase-0..5 已归档；version/v0 见 evolutionary WM。

## 仓职责（2026-09-17）

| 仓 | 本会话角色 | 不该塞什么 |
| :--- | :--- | :--- |
| **collab-cli** | collab-pressure* / CLI 门禁 / MCP/validate | 业务领域实现 |
| **evolutionary** | 换电实现 + 项目级 WM/报告 | CLI 协议细节 |
| **collaboration** | 协作 KB 本体 | 项目轮次日记 |
| **aggregate 根 / shared 根** | 跨仓指针；非日常写点 | 当第二工作区 |

电池压测 battery-pressure 已 **迁出** working-memory/tasks/，只留 collab-cli。
见 decisions.md 2026-09-17。

## 索引

见 [W10](../COLLABORATION/workflows/W10-working-memory.md)。
