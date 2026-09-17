# 阶段 0 验收场景（A10 第 2 层）

> 形式化规格表达。实现阶段每条须对应自动化测试；本阶段仅骨架。

## Fixture 约定

| 实体 | 初始值 |
| :--- | :--- |
| User `U1` | balance = 100.00 CNY |
| Org `O1` | 唯一运营商，OPERATOR capability |
| Product `P1` | 30 天不限次，price = 30.00 |
| Battery `B1` | status = idle, orgId = O1 |

---

## AC-1 购买成功

```gherkin
Given U1 balance is 100.00
  And P1 is published at 30.00
When U1 purchases P1
Then Order status is PAID
  And Entitlement is ACTIVE with validUntil = today + 30 days
  And U1 balance is 70.00
  And LedgerEntry sum debits equals sum credits for this order
```

## AC-2 余额不足

```gherkin
Given U1 balance is 10.00
When U1 purchases P1
Then Order is not PAID
  And no Entitlement created
  And U1 balance remains 10.00
  And no LedgerEntry for this attempt
```

## AC-3 有效期内换电（不限次）

```gherkin
Given U1 has ACTIVE entitlement for P1
  And B1 is idle
When U1 completes swap at cabinet C1 with B1
Then UsageEvent status is COMPLETED
  And B1 status returns to idle after return flow
  And entitlement remains ACTIVE
  And swap count is not decremented (UNLIMITED)
```

## AC-4 连续换电三次

```gherkin
Given U1 has ACTIVE entitlement
When U1 completes swap 3 times with different batteries
Then 3 UsageEvents COMPLETED
  And entitlement still ACTIVE
  And all batteries end idle
```

## AC-5 过期不可换电

```gherkin
Given U1 entitlement validUntil was yesterday
  And status is EXPIRED
When U1 attempts swap
Then swap is rejected
  And no UsageEvent COMPLETED
```

## AC-6 退款

```gherkin
Given U1 has PAID order and ACTIVE entitlement
  And no IN_PROGRESS UsageEvent
When refund is requested for the order
Then Order status is REFUNDED
  And Entitlement status is REVOKED
  And U1 balance restored by paid amount
  And refund LedgerEntry balances payment entry
```

## AC-7 退款后不可换电

```gherkin
Given entitlement REVOKED after refund
When U1 attempts swap
Then swap is rejected
```

## AC-8 电池互斥

```gherkin
Given B1 is rented to U1 (UsageEvent IN_PROGRESS)
When U2 attempts swap with B1
Then swap is rejected for U2
  And B1 remains rented to U1
```

## AC-9 账本恒等式

```gherkin
Given any sequence of purchase, swap, refund in phase-0 scope
Then sum(debits) = sum(credits) per currency across all LedgerEntries
```

---

## Review 检查清单

- [ ] 每条 AC 只断言一个业务结果
- [ ] 无 AC 依赖「积分」「多级运营商」「商城」
- [ ] INV-1..5 均可由 AC-1..9 间接覆盖
