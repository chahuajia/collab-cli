# 阶段 6 验收场景（A10 第 2 层）

## Fixture

| 实体 | 值 |
| :--- | :--- |
| U1 | creditLimit=100.00, usedCredit=0, balance=0 |
| P1 | 月卡 30.00 |

---

## AC-48 信用购无余额扣款（P6-2 / INV-17）

```gherkin
Given U1 balance 0 and credit available 100.00
When U1 purchases P1 with credit
Then Order is PAID
  And CreditLedgerDebt OPEN for 30.00
  And usedCredit is 30.00
  And no ORDER_PAYMENT_BALANCE LedgerEntry
  And Entitlement is ACTIVE
```

## AC-49 超额拒绝（P6-5）

```gherkin
Given U1 credit available 10.00
When U1 purchases P1 at 30.00 with credit
Then rejected with CREDIT_LIMIT_EXCEEDED
  And no Order PAID
```

## AC-50 账单出账（P6-3）

```gherkin
Given OPEN CreditLedgerDebt 30.00 for January
When billing runs on Feb 1
Then BillingStatement DUE totalDue 30.00
  And Debt status BILLED
```

## AC-51 还款恢复（P6-3）

```gherkin
Given DUE statement totalDue 30.00
  And U1 balance 50.00
When U1 repays statement in full
Then Statement PAID
  And usedCredit is 0
  And Debt PAID
  And CreditProfile status good
```

## AC-52 逾期冻结（P6-4）

```gherkin
Given DUE statement past dueDate unpaid
When overdue job runs
Then CreditProfile status overdue
  And ACTIVE Entitlements become FROZEN
  And swap is rejected with CREDIT_OVERDUE_BLOCKED
```

## AC-53 还款解冻

```gherkin
Given U1 overdue with FROZEN entitlement
When statement repaid in full
Then CreditProfile status good
  And Entitlement returns ACTIVE
  And swap allowed again
```

## AC-54 政策版本仅影响新购（P6-6）

```gherkin
Given U1 usedCredit 30 under policy v1 limit 100
When policy v2 lowers limit to 20
Then existing debt unchanged
  And new credit purchase rejected until repayment
```
