# Working Memory

**更新**：2026-09-16

> 跨对话的工作状态。**AI 主动维护，用户只需纠正**。

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **实战项目压测** | 🔄 第 2 轮：查因已完，**待拍板** | `specs/round-2-diagnosis.md`（在项目仓库里） |

## 下一个会话从这里开始

> **上一个会话的上下文已到 ~80%。** 不要试图回忆 —— 按下面读。

**项目**：`D:\actto\front\project\evolutionary_start\evolutionary`
（换电站 DDD 演练：Next.js + Spring Boot。**产物是暴露报告，不是产品。**）

| 项 | 内容 |
| :--- | :--- |
| **第 1 轮（已完成）** | 后端领域层 `Battery` 状态机 + 11 JUnit 测试（绿）。产物：`specs/round-1-report.md` |
| **第 1 轮暴露了 7 条** | E1 路由表没被用（**最刺眼**）· E2 分类判据缺失 · E3 A8 三问没跑 · E4 反面没命中 · E5 ✅没滥加条目 · E6 规范绑栈(Java 的 Result) · E7 `maven.compiler.release` 静默失效 |
| **第 2 轮第一步（已完成）** | "路由表为什么没被用"的查因：`specs/round-2-diagnosis.md`。**最简因**：不是"AI 忘了读"，而是 **108 条里 97 条没有可路由的 `trigger`**（`trigger` 不在 `base-contract` / `naming-conventions` / 任何模板里；`collab new` 不产生它；validate 不管它），**且没有任何机制会发现"没读"**。反事实检验：`trigger` 列对第 1 轮 4 个需求命中 **0/4**，而 KB `AGENTS.md` 那张手写症状表命中 2/4 |
| **下一步（待你拍板）** | `specs/round-2-diagnosis.md` §七 的四条候选：**A** 入口补症状表 · **B** 给"没读"加强制点 · **C** catalog 降级为目录（与 KB `AGENTS.md` 冲突，需 RFC）· **D** 先把"读了也没用"从推断变成实测。我的建议顺序：**D → A+C → B**（B 单独做最像 E7 那个"看起来生效实则没有"） |
| **不要碰** | `collaboration` 仓库未 commit 的改动（`agreements/_index.md`、`catalog.json`、新增 `A20-外部输入分流.md`）；`agreements/` 已 **9/10 配额**；`evolutionary/` 的代码未 commit |

**起步顺序**：`AGENTS.md` → `catalog.json`（看 `trigger`）→ 按需读 2–3 条 → 本文件。

## 已结束的阶段

| 阶段 | 结果 | 快照（永不修改） |
| :--- | :--- | :--- |
| **CLI MVP**（2026-09-16） | ✅ 工具侧达成：**600 tests / 44 files**、**107 entries / 0 issues**、11 命令、"AI 产出 → 入库"闭环 | `_archive/2026-09-16-cli-mvp.md` |

> 阶段内的子任务（`collab-apply` / `collab-parse` / `mcp-integration` / `cli-audit` /
> `collaboration-refactor`）**均已收口**，状态在快照里，不在本表。

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
| 总行数 > 500 → 强制归档 | ⏳ 仍 > 500（第八至十轮已入档；`spec.md` / `parse-spec` / `decisions` 待处理） |

**归档规则**：归档文件**永不修改**；主文档只保留"当前状态"，历史进 `_archive/<日期>-<阶段>.md`。
