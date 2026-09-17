# 阶段 4 规格：分润与结算

> 依赖 phase-3 组织树。账本仍用 LedgerEntry（SETTLEMENT 户间划转）。

## 1. 核心原则（P4-1 三问）

| 问 | 答 |
| :-- | :--- |
| 没有延迟结算会怎样？ | 退款/纠纷时要从已打款账户扣回，资金追回成本高 |
| 收益？ | Accrual 意向 → Batch 确认；退款只 reversal 未结算部分 |
| 成本？ | 多一张 Accrual 表 + 定时 Batch 任务 |

## 2. 推广关系

```text
ReferralBinding
  userId, promoterOrgId
  boundAt, expiresAt          // 绑定后 72h 内有效下单算推广
  status: active | expired

规则：
  - 每 user 仅一条 active binding
  - 绑定不可变更 promoter（防刷）；过期后不可补绑
```

## 3. 分润规则

```text
ProfitSharingRule
  id, orgId, eventType: ORDER_COMPLETED
  splits: [{ orgId, percentage }]   // 如 L2:10, L1:5, PLATFORM: remainder
  effectiveFrom, effectiveUntil
  version

约束（P4-4）：
  sum(explicit percentages) <= 100
  remainder 归 PLATFORM SETTLEMENT 户
```

## 4. 分润意向（P4-2 / P4-3）

```text
ProfitShareAccrual（追加-only）
  id, orderId, orgId, amount, currency
  ruleVersion, status: PENDING | SETTLED | REVERSED
  createdAt, settledAt?, reversalOf?

触发：
  on ORDER_COMPLETED:
    1. 解析 ReferralBinding（若有效）
    2. 按 ProfitSharingRule 计算各方 amount
    3. 写 N 条 Accrual(status=PENDING)

退款（ORDER_REFUNDED）：
  - 若 Accrual 仍 PENDING → status=REVERSED，写 reversal 记录
  - 若已 SETTLED → 写负向 Accrual（下一阶段简化：阶段 4 禁止已结算后退款）
```

**阶段 4 简化**：已 SETTLED 的订单 **不可退款**（或人工作业）；规格留 extension point。

## 5. 结算批（P4-6）

```text
SettlementBatch
  id, periodStart, periodEnd
  status: OPEN | CLOSED | PAID
  createdAt, closedAt?

流程：
  1. T+7 日切：收集 period 内 status=PENDING 的 Accrual
  2. 按 orgId 汇总 → 写 LedgerEntry(PROFIT_SHARING_SETTLEMENT)
  3. Accrual → SETTLED，关联 batchId
  4. Batch → CLOSED
```

```text
LedgerEntry.refType 增量：
  PROFIT_SHARING_SETTLEMENT
  refId: SettlementBatchId
```

**INV-14**：Batch 内 sum(Accrual.amount) = sum(LedgerEntry.amount) 按 org 分组。

**INV-15**：REVERSED Accrual 不可进入 Batch。

## 6. 与组织树联动

```text
订单 orgId = L2（售卖方）
规则 splits:
  L2 10% · L1 5% · PLATFORM 85%
推广补贴（可选）：
  promoterOrgId 额外 2% 从 PLATFORM remainder 扣
```

## 7. KB 路由

| 症状 | 条目 | 拦住 |
| :-- | :--- | :--- |
| 何时沉淀 | A4 | PAID 时就分润 |
| 设计三问 | design-decision | 实时打款 |
| 不可变 | base-contract | 改已 SETTLED Accrual |
| 防刷 | A3 | 无限换 promoter |

**gap 候选**：分润延迟结算 — 本 spec 承载；若重复出现再建 patterns 条目。
