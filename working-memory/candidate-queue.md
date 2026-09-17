# 候选队列

> 达阈值后归并沉淀。触发：队列 ≥ 5 / 任一 ≥ 7 天 / 3 个相关 / 用户要求。

## 本轮已处理（2026-09-16 23:30）

| 候选 | 处置 |
| :--- | :--- |
| higher-order-factory | **已在库**（`patterns/higher-order-factory`）→ 标吸收 |
| L1/L4 动态深度 | **已在** `W11` §「L1 深度和 L4 轮数都按任务动态决定」→ 标吸收 |
| 派生优于复制（队内旁注） | **已在** `patterns/derivation-over-copy` → 标吸收 |
| how-as-injected-function | → **新建** `patterns/how-as-injected-function` |
| rule-set-layering | → **新建** `patterns/rule-set-as-subset` |
| merge-procedure | → **新建** `W12-条目合并`（parking-lot 规程迁入） |

代谢：新增 3 → 处理 1：`patterns/rfc-process` → **dormant**（与 W7 重叠 ≥50%）。

## 当前队列

| 候选 | 来源 | 摘录 |
| :--- | :--- | :--- |
| project-evidence-vs-kb-ledger | evolutionary 0→7 复盘 | `evolution-log`/`interceptions` 主表只留跨项目摘要；项目证据留业务仓 |
| agent-workspace-boundaries | 同上 | FE/BE 集群：路径约定 + `wm/agents/{fe,be}` + `wip`；不为此拆仓 |
| pattern-id-alignment | 命名漂移 | pattern 补稳定短 id（P-）/aliases；与 A/W/S 同构演进 |

证据：`evolutionary/.../tasks/_archive/2026-09-17-selective-pressure-retro.md`  
触发：人确认后 W5；注意代谢配额。
