# Working Memory

> 跨对话的工作状态。**AI 主动维护，用户只需纠正**。
>
## 依赖的外部知识库

本项目的协作规范**不在本仓库内**——它在独立的项目：
本地地址：D:\actto\front\project\collaboration_aggregate\collaboration
[COLLABORATION 仓库](https://github.com/chahuajia/collaboration)。

**AI 进入项目时，需要读取该仓库**。读取方式：
- 如果有工具支持 URL 读取 → 直接读
- 否则 → 用户粘贴关键文件内容（按"阅读顺序"）

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **evolutionary 压测** | ✅ 已收口（入口 harvest v4.7.15） | `evolutionary/specs/pressure-test-retro.md` |

## 已归档

见 `tasks/_completed/`。

## 仓库归属（2026-09-17 决策）

| 仓库 | 放什么 | 不放什么 |
| :--- | :--- | :--- |
| **collab-cli** | `collab-pressure`、CLI 开发、MCP/validate 工具链压测 | 换电等业务域规格与契约 |
| **evolutionary** | 前后端实现 + 该产品的 WM/压测 | CLI 工具代码 |
| **collaboration** | 长期 KB 条目 | 任务进度、业务规格 |
| **aggregate 根 / shared 仓** | ≥2 消费者才提取的共享协议/脚本 | 单仓私货 |

业务压测（如 `battery-pressure`）→ **业务仓** `working-memory/tasks/`，不留在 collab-cli。
详见 `decisions.md` 2026-09-17 三行。

## 协议

详见 [W10](../COLLABORATION/workflows/W10-工作记忆维护流程.md)。