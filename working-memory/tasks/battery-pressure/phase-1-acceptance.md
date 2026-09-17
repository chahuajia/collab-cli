# 阶段 1 验收场景（A10 第 2 层）

> 增量于 phase-0-acceptance.md。阶段 0 的 AC-1..9 仍有效。

## Fixture

| 实体 | 值 |
| :--- | :--- |
| P1 | 30天不限次，30.00 |
| P2 | 90天10次卡，50.00 |
| P3 | 按 SOC，0.50 元/1% |
| U1 | balance 200.00 |

---

## AC-10 次卡扣减（P2 / INV-6）

```gherkin
Given U1 purchased P2 with remainingSwaps 10
When U1 completes one swap
Then remainingSwaps is 9
  And UsageEvent is COMPLETED
```

## AC-11 次卡用尽（P2 / INV-7）

```gherkin
Given U1 entitlement for P2 has remainingSwaps 0
When U1 attempts swap using that entitlement
Then swap is rejected with ENTITLEMENT_EXHAUSTED
  And no UsageEvent COMPLETED
```

## AC-12 不限次不受次卡规则影响（P1）

```gherkin
Given U1 has P1 UNLIMITED entitlement
When U1 completes 20 swaps
Then entitlement remains ACTIVE
  And no remainingSwaps field is tracked
```

## AC-13 按电量后付（P3 / INV-8）

```gherkin
Given U1 has P3 PAY_AS_YOU_GO entitlement
  And U1 balance is 200.00
When U1 completes swap with socBefore 80 and socAfter 60
Then chargedAmount equals 10% × rate (10 units × 0.50 = 5.00)
  And LedgerEntry refType is METERED_CHARGE
  And U1 balance decreases by chargedAmount
```

## AC-14 多 Entitlement 默认策略（P1-4）

```gherkin
Given U1 holds ACTIVE P1 (UNLIMITED) and P2 (remainingSwaps 3)
When U1 swap without explicit entitlementId
Then FINITE P2 is consumed (remainingSwaps becomes 2)
  And P1 remains untouched
```

## AC-15 显式指定 Entitlement

```gherkin
Given U1 holds P1 and P2
When U1 swap with entitlementId pointing to P1
Then P1 is used
  And P2 remainingSwaps unchanged
```

## AC-16 按电量余额不足

```gherkin
Given U1 balance is 1.00
  And P3 swap would charge 5.00
When swap completes metering
Then LedgerEntry is not written OR swap fails with INSUFFICIENT_BALANCE
  And behavior matches spec default: fail before COMPLETED
```

---

## Review 清单

- [ ] AC-10..12 覆盖 FINITE vs UNLIMITED
- [ ] AC-13/16 覆盖 P3 计量与账本
- [ ] AC-14/15 覆盖 entitlement 选择策略
