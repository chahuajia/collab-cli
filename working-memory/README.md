# Working Memory

**更新**：2026-09-16

> 跨对话的工作状态。**AI 主动维护，用户只需纠正**。

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **collaboration-refactor** | 🔄 进行中（本会话主要战场） | `tasks/collaboration-refactor/progress.md` |
| **collab-parse** | 📋 规格待拍板（6 个决策点，本会话未处理） | `tasks/collab-parse/spec.md` |
| **collab-apply** | ✅ 已实现（E1-E13 全绿） | `tasks/collab-apply/progress.md` |
| **cli-development** | ✅ 五命令 + apply/catalog/fix | `tasks/cli-development/progress.md` |

## 辅助文件

| 文件 | 用途 |
| :--- | :--- |
| `parking-lot.md` | 未决项——暂不处理但不遗忘 |
| `decisions.md` | 决策日志——何时做了什么决定 |

## 维护协议

**W10 工作记忆维护流程**在**独立的知识库仓库**里（本仓库内没有 `COLLABORATION/`）：

- 有工具支持 URL 读取 → 读仓库里的 `workflows/W10-working-memory.md`
- 否则 → 由用户粘贴

### 归档状态（W10 的规模上限）

| W10 规定 | 现状 |
| :--- | :--- |
| 每份进度文档 ≤ 100 行 | ✅ 已归档（2026-09-16）：主文档 **91 行**，第一至七轮冻结进 `_archive/` |
| 总行数 > 500 → 强制归档 | ⏳ 全目录仍 > 500（`spec.md` 117 / `parse-spec` 121 / `decisions` 94 …）—— 下次继续 |

**归档规则**：归档文件**永不修改**；主文档只保留"当前状态"，历史进 `_archive/<日期>-<阶段>.md`。
