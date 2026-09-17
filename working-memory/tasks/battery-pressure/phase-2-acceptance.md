# 阶段 2 验收场景（A10 第 2 层）

> 增量于 phase-0/1。混合支付专用于购买 P1/P2（FIXED_PRICE）。

## Fixture

| 实体 | 值 |
| :--- | :--- |
| P1 | 30.00（3000 分） |
| U1 | balance 100.00 · points 50.00 · pointsExpiresAt 未来 |
| U2 | balance 100.00 · points 5.00 |

---

## AC-17 纯余额（回归）

```gherkin
Given U1 pays P1 with usePoints 0 and useBalance 30.00
When purchase succeeds
Then one ORDER_PAYMENT_BALANCE LedgerEntry
  And no ORDER_PAYMENT_POINTS entry
```

## AC-18 混合支付（P2-2 / INV-11）

```gherkin
Given U1 pays P1 with usePoints 20.00 and useBalance 10.00
When purchase succeeds
Then ORDER_PAYMENT_POINTS entry amount is 20.00
  And ORDER_PAYMENT_BALANCE entry amount is 10.00
  And sum equals paidAmount 30.00
  And ledger debits equal credits
```

## AC-19 积分不足拒绝（P2-5）

```gherkin
Given U2 pays P1 with usePoints 20.00 and useBalance 10.00
When purchase is attempted
Then order is rejected with INSUFFICIENT_POINTS
  And no LedgerEntry written
```

## AC-20 混合退款逆序（P2-3 / INV-9）

```gherkin
Given U1 purchased P1 with 20 points + 10 balance
When refund succeeds
Then ORDER_REFUND_BALANCE 10.00 is written first
  And ORDER_REFUND_POINTS 20.00 second
  And U1 balance and points restored
  And Entitlement REVOKED
```

## AC-21 积分过期不可支付（P2-6）

```gherkin
Given U1 pointsExpiresAt was yesterday
When U1 pays with usePoints > 0
Then rejected with POINTS_EXPIRED
```

## AC-22 refType 不混用（INV-10）

```gherkin
Given any mixed payment in phase-2 scope
Then no LedgerEntry debits BALANCE account with ORDER_PAYMENT_POINTS refType
  And no LedgerEntry debits POINTS account with ORDER_PAYMENT_BALANCE refType
```

## AC-23 纯积分支付

```gherkin
Given U1 has points 100.00
When U1 pays P1 with usePoints 30.00 and useBalance 0
Then only ORDER_PAYMENT_POINTS entry exists
  And balance unchanged
```
