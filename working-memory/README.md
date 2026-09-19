# Working Memory

**更新**：2026-09-19 19:35

## ⚠️ 先跑这个

```powershell
node working-memory/check-freshness.mjs
```

判据是**时间**：上面那行 `**更新**：` 必须晚于三个仓最后一次产品代码提交。

> **这一行只能人写，不要脚本自动刷新。** 自动刷新 = 永远通过 = 这个检查就死了 ——
> 而那正是本仓删过两次的"假绿灯"（`echo TODO` 的 CI、写死 `entries: 113` 的测试）。
> 它是"有人真的看过这份记忆"的**唯一凭据**；必须可能是假的，否则它就不是凭据。

已接 `.husky/pre-push`；仓库路径可用 `COLLAB_CLI_DIR` / `COLLAB_KB_DIR` /
`EVOLUTIONARY_DIR` 覆盖，**不可达是硬失败不是跳过**。
`collab-cli` 自身比较时**排除 `working-memory/`** —— 否则"更新本文件"会让它自己过期。

## 本文件的边界

**只写"在做什么、为什么"。不写可计算的事实。**

计数、HEAD、提交状态、文件数 —— 这些都有命令能算出（`git status` /
`collab validate` / `collab catalog`），手抄进来必然腐烂，而且会污染认真读者的判断。
本文件历史上烂过两次：`测量` 栏写 119/0 而实际 122/0；
`活跃任务` 栏写「待提交：FALSIFIER_REQUIRED ⏳ 4 改 2 新」而那批早已 commit。

> 同类教训另见 KB 的 `meta/interceptions.md`：它的表头写"当前条数 7"而表里 8 行，
> **骗过了四个读者**（其中一个是专门去审计它的）。

## 活跃任务

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **KB 生态重构（P0–P2）** | ✅ 收口 · 见任务文件的"未做"清单 | `tasks/2026-09-18-kb-restructure.md` |
| **`enforced` 机制审计** | ✅ 收口 · 3/8 够格毕业，4 个缺陷已修 | `tasks/2026-09-18-enforced-audit.md` |
| **接手 evolutionary 实测 KB** | ✅ operator 域 JPA 清零 · 集群仍暂停、未派代理 | `../evolutionary_start/evolutionary/working-memory/tasks/operator-jpa/slice-1-report.md` |
| **collab-pressure** | ✅ round 1–17 | `tasks/collab-pressure/loop.md` |
| **collab-pressure-extreme** | ✅ 已停（idle 3 · v4.8.7） | `tasks/collab-pressure-extreme/loop.md` |
| **evo-collab-extreme** | ⏸ 已暂停（用户 19:17） | `tasks/evo-collab-extreme/loop.md` |
| CLI A4 | ✅ 收口 | `tasks/cli-development/loop.md` |

> **evolutionary 侧**：wave41 已 merge；enum 重构已提交。
> 那批积压的 127 个未提交改动已清空。

## 陷阱

AI 不 push；merge `version/v0` / topic 须确认。
`.husky/pre-push` 会跑 `check-freshness` —— 产品代码一动、这里没跟着改就会被拦下。
**这是设计，不是故障。**
