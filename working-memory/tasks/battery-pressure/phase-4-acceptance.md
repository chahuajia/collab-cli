# 阶段 4 验收场景（A10 第 2 层）

## Fixture

| 实体 | 值 |
| :--- | :--- |
| Order O1 | orgId=L2，paidAmount=100.00，已完成 |
| Rule R1 | L2:10% · L1:5% · PLATFORM:85% |
| Binding B1 | user→promoterOrg L2，72h 内有效 |

---

## AC-32 COMPLETED 才产生 Accrual（P4-1）

```gherkin
Given Order O1 status is PAID but not completed
When time passes without completion event
Then no ProfitShareAccrual exists

When ORDER_COMPLETED is emitted for O1
Then Accruals exist for L2, L1, PLATFORM
```

## AC-33 分润金额正确（P4-4）

```gherkin
Given O1 paidAmount 100.00 and Rule R1
When accruals are created on COMPLETED
Then L2 accrual is 10.00
  And L1 accrual is 5.00
  And PLATFORM accrual is 85.00
  And sum equals 100.00
```

## AC-34 T+7 结算批（P4-2 / P4-6）

```gherkin
Given PENDING accruals for O1 created at T0
When SettlementBatch runs at T0+7 days
Then accruals status becomes SETTLED
  And LedgerEntry PROFIT_SHARING_SETTLEMENT per org
  And INV-14 holds for the batch
```

## AC-35 结算前退款 reversal（P4-3 / INV-15）

```gherkin
Given PENDING accruals for O1
When order is refunded before batch
Then accruals status is REVERSED
  And SettlementBatch at T+7 excludes O1 accruals
```

## AC-36 已结算不可退款（阶段 4 简化）

```gherkin
Given accruals for O1 already SETTLED
When refund is requested
Then rejected with ORDER_NOT_REFUNDABLE_SETTLED
```

## AC-37 推广绑定唯一（P4-5）

```gherkin
Given user has active ReferralBinding to org A
When binding to org B is attempted
Then rejected with REFERRAL_ALREADY_BOUND
```

## AC-38 推广绑定过期

```gherkin
Given binding expiredAt was yesterday
When ORDER_COMPLETED for that user
Then promoter subsidy accrual is not created
```

## AC-39 推广补贴从 PLATFORM 扣

```gherkin
Given valid binding B1 and promoter bonus 2%
When O1 completes with 100.00
Then promoterOrg accrual 2.00
  And PLATFORM accrual is 83.00 not 85.00
```
