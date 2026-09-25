# Working Memory

**更新**：2026-09-25 21:00  

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

> **对齐于 2026-09-25**（只写判断，不写数字）：自上次声明后，evolutionary 的"视图化"线跑完并停了，
> KB 侧多了一批对外文档。**具体提交数与 HEAD 请看 `node working-memory/check-freshness.mjs` 的输出 —— 不抄进这里。**

| 任务 | 状态 | 文件 |
| :--- | :--- | :--- |
| **KB 生态重构（P0–P2）** | ✅ 收口 | `tasks/2026-09-18-kb-restructure.md` |
| **`enforced` 机制审计** | ✅ 收口 | `tasks/2026-09-18-enforced-audit.md` |
| **接手 evolutionary 实测 KB** | ✅ 收口（视图化线已停；证据见 evo WM） | `../evolutionary_start/evolutionary/working-memory/HANDOVER.md` |
| **L3 停摆复盘（09-20）** | ⚠️ 结论已落，**"零增量"仪器仍未接线** | `../evolutionary_start/evolutionary/working-memory/next-direction.md` §八 |
| **collab-pressure / -extreme** | ✅ 已停 | `tasks/collab-pressure/loop.md` |
| **evo-collab-extreme** | ⏸ 暂停（09-20 复盘见 evo WM） | `tasks/evo-collab-extreme/loop.md` |
| **CLI A4** | ✅ 收口 | `tasks/cli-development/loop.md` |
| **`collab init`（脚手架）** | 📋 规格待拍板（D1 已收敛为"单一调用点"） | `tasks/collab-init/spec.md` |
| **KB 对外分享** | 📄 SHARE / ARTICLE / CORE / WRITEUP 已落；`adoption-guide` 待提交 | KB 顶层 |

> **evolutionary 侧**：wave41 已 merge；enum 重构已提交。
> 那批积压的 127 个未提交改动已清空。

## 陷阱

- **AI 不 push**；merge `version/v0` / topic 须用户明确确认。
- **先改 git，再刷新登记** —— 勿空登记。
- **双轴勿混**：`version × phase` 分开 commit / 分记 WM，勿互相顶替。
- **计数 / HEAD / 文件数一律现算**（`git log`、`collab validate`），不抄进任何文档 —— 手抄必然腐烂。
- **新鲜度自检已不在 pre-push**（2026-09-25 移走）：现在接在**会话开始**，见仓库根 `AGENTS.md`。
  挂在 pre-push 上拦的是写者，受害的却是下一个读者；三仓都在活动时它会每两分钟红一次，
  红灯变噪音 → 只能靠顺手乱签压下去。**红灯的响应协议见根 AGENTS.md。**


## 仓职责（跨仓分工）

> 从 `working-memory/AGENTS.md` 并入（2026-09-25）。那份文件已降级为指针 ——
> **本地状态只在本文件**，两份副本必然漂移。

| 仓 | 角色 | 不该塞什么 |
| :--- | :--- | :--- |
| **collab-cli** | 工具链 / 门禁 / MCP / validate | 业务领域实现 |
| **evolutionary** | 业务实现 + 项目级 WM（**真相仓**） | CLI 协议细节 |
| **collaboration** | 协作知识库本体（长期知识） | 项目轮次日记 |
| **aggregate 根 / shared 根** | 跨仓指针 | 当第二工作区 |
