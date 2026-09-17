# 阶段 6 规格：信用与先用后付

> 独立子域，不并入 phase-2 PaymentIntent。仅换电 Order。

## 1. 核心原则（P6-1 三问）

| 问 | 答 |
| :-- | :--- |
| 把信用当余额扣会怎样？ | 退款/对账/逾期惩罚与货币负债混淆 |
| 收益？ | CreditAccount + BillingStatement 清晰 |
| 成本？ | 多账户类型 + 周期任务 + 冻结逻辑 |

```text
Account.type 增量：
  CREDIT   // 用户信用负债账户（usedCredit 反映于此）

CreditProfile
  userId, creditLimit, usedCredit
  status: good | overdue | frozen
  scoreTier: A | B | C        // 阶段 6 简化，人工授予 limit
  policyVersion
```

## 2. 先用后付购买（P6-2）

```text
PurchaseWithCreditCommand
  userId, productId

流程：
  1. 校验 creditLimit - usedCredit >= price
  2. 创建 Order(PAID) — 无 BALANCE LedgerEntry
  3. 写 CreditLedgerDebt（append-only）
  4. usedCredit += price
  5. 创建 Entitlement(ACTIVE) — 同 phase 0
```

```text
CreditLedgerDebt
  id, userId, orderId, amount
  status: OPEN | BILLED | PAID | WRITTEN_OFF
  createdAt, billedStatementId?, paidAt?
```

**INV-17**：信用购 Order 无 ORDER_PAYMENT_BALANCE 分录，仅有 CreditLedgerDebt。

## 3. 账单周期（P6-3）

```text
BillingStatement
  id, userId
  periodStart, periodEnd
  totalDue, status: OPEN | DUE | PAID | OVERDUE
  dueDate                     // periodEnd + 7d 宽限期
  createdAt, paidAt?

流程（每月 T+1）：
  1. 收集 status=OPEN 的 CreditLedgerDebt
  2. 生成 BillingStatement(DUE)
  3. Debt → BILLED
```

## 4. 还款

```text
RepayCommand
  userId, statementId, amount

  1. 校验 amount >= totalDue（阶段 6 不支持部分还款）
  2. LedgerEntry：debit BALANCE, credit 清账过渡户
  3. Debt → PAID；usedCredit -= totalDue
  4. Statement → PAID
  5. 若 status=overdue → 恢复 good
```

## 5. 逾期（P6-4 / P6-5）

```text
on dueDate 未 PAID:
  1. CreditProfile.status → overdue
  2. 所有 ACTIVE Entitlement → FROZEN（新状态或 metadata）
  3. swap / 新信用购 → CREDIT_OVERDUE_BLOCKED

on overdue + 7d（即 dueDate+7）:
  status → frozen（需人工或全额还款解封）
```

**Entitlement 增量状态**：`FROZEN`（可恢复，区别于 REVOKED/EXPIRED）。

## 6. 政策版本（P6-6）

```text
CreditPolicy
  version, tierLimits: { A: limit, B: limit, C: limit }
  effectiveFrom

变更 limit 仅对新购生效；已有 usedCredit 不清零。
```

## 7. KB 路由

| 症状 | 条目 | 拦住 |
| :-- | :--- | :--- |
| 独立子域 | design-decision | 信用当 PaymentIntent |
| 规格先行 | A10 | 逾期规则先写 |
| 状态守卫 | S13 | 散落 if overdue 在 swap |
| 版本 | A6 | 静默改 creditLimit |

**gap 候选**：信用子域无专条 — 本 spec 承载。
