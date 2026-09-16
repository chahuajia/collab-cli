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
| **evolutionary 压测** | ✅ 第 4–12 轮完成 | `evolutionary/specs/round-12-report.md` |

## 已归档

见 `tasks/_completed/`。

## 扩展点（记录，不实施）

**当前只有一个项目。** 未来若有多项目，用**前缀**或**目录层级**区分：

- **方式 A**：`tasks/collab-cli-<task>/`、`tasks/other-<task>/`
- **方式 B**：`projects/collab-cli/tasks/...`、`projects/other/tasks/...`

**触发条件**：出现第二个项目时升级。

## 协议

详见 [W10](../COLLABORATION/workflows/W10-工作记忆维护流程.md)。