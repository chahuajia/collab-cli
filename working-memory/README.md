# Working Memory

**更新**：2026-09-16 22:35 ｜ **上一版**：`_archive/2026-09-16-readme-before-d-experiment.md`

> 跨对话的工作状态。**AI 主动维护，用户只需纠正**。

## ⚠️ 先跑这个，否则别信下面的"活跃任务"

```powershell
node check-freshness.mjs
```

它拿本文件登记的 commit 跟三个仓库的**实际 HEAD** 比对。不一致 = 这份记忆落后了。

**登记（本版）**：

| 仓库 | 登记 HEAD |
| :--- | :--- |
| `collab-cli` | `7a51699` |
| `collaboration` | `9729913` |
| `evolutionary` | `5e0122b` |

> **为什么必须有这个**：上一版 README 停在 **18:18**，之后 5 小时的工作没进去，
> 而它写的内容（"D 实验第 2 轮待拍板"）**会把新会话引到已经过去的位置**。
> **过期的工作记忆比没有工作记忆更坏 —— 它长得像"查过了"。**

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **D 实验：读了到底有没有用** | 🔄 **r3 已就位，待跑** | `tasks/d-experiment/progress.md` |

## 换会话 / 换 agent 的接手顺序

**不要靠回忆，按顺序读**：

1. 本文件（先跑 `check-freshness.mjs`）
2. `tasks/d-experiment/progress.md` —— 活跃任务全状态
3. `tasks/d-experiment/anchors.md` —— **不可协商的约束**（每次新对话必读）
4. `retro-context.md` —— 这一阶段对"上下文处理"的复盘（含已知失效点）
5. 三个仓库 `git log --oneline -5`

## 已结束的阶段

| 阶段 | 结果 | 快照 |
| :--- | :--- | :--- |
| CLI MVP（09-16） | 600 tests / 44 files、11 命令、"AI 产出 → 入库"闭环 | `_archive/2026-09-16-cli-mvp.md` |
| **知识库收敛**（09-16） | 约定 **19 → 10**；新增**集成层** `integrations/`；`A20`/`A21`；`meta/base-contract.md` 冻结基座；`ADR-0005..0010`；新增 `meta/known-gaps.md` 缺口账本 | 见 `collaboration` 的 `git log` |
| 对照实验 D 前两轮 | r1 **有威胁**（基线回声）、r2 **处理未施加**（brief 把处理组关掉了）→ 均不入判据 | `_experiment/round-3-verdict.md`、`round-3-r2.md` |

## 陷阱（新会话必读）

- **`_experiment/` 是"派发方工作台"，不是实验坏境**：判据表、基线、驱动器都在那儿，
  **被试读得到**（同一台机器、同一用户、全盘可读）。r1 就是因此报废。做隔离实验前先读 `retro-context.md`。
- **两臂必须串行、同一个中性路径** `D:\swap-station`；归档在 `_runs\<轮次>-<臂>`。
- **别在"被试窗口"里跑任何命令**（一次 `Set-Clipboard` 就让 r1 的臂 B 报废）。
- `agreements/` 配额 **10/10 已满**，`collab new agreement` 会被拒。
- **AI 不 commit、不 push**（MCP 里连工具都不存在）；改动留在工作区待人确认。
- 知识点工具脚本：`collab-cli` 的 `node dist/cli/index.js --dir <知识库> validate|catalog|index`。
  注意 **`index` 是破坏性的**（会重排并写入空白列），改索引要手工改。