# 阶段 5 验收场景（A10 第 2 层）

## Fixture

| 实体 | 值 |
| :--- | :--- |
| Merchant M1 | MERCHANT capability，SKU S1 price=50.00 |
| Coupon C1 | 满30减5，mutexGroup=MG1，MERCHANT scope |
| Coupon C2 | 9折，mutexGroup=MG2 |
| User U1 | 持有 C1、C2 可用券 |

---

## AC-40 商家入驻

```gherkin
Given org submits OnboardingApplication capability MERCHANT
When approved
Then MerchantProfile is active
  And org cannot publish PackageTemplate
```

## AC-41 商城下单无 Entitlement（INV-16）

```gherkin
Given U1 buys MallSku S1 qty 1
When MallOrder is PAID
Then no Entitlement or UsageEvent created
  And MallOrder.paidAmount reflects payment
```

## AC-42 满减券核销（P5-5）

```gherkin
Given cart total 50.00 and coupon C1 minSpend 30
When checkout with C1
Then discountTotal is 5.00
  And paidAmount is 45.00
  And CouponRedemption append-only record exists
  And UserCoupon C1 status is used
```

## AC-43 互斥拒绝（P5-3）

```gherkin
Given two coupons same mutexGroup MG1
When checkout applies both
Then rejected with COUPON_MUTEX_VIOLATION
```

## AC-44 叠加上限

```gherkin
Given U1 applies C1 (MG1) and C2 (MG2) — 2 coupons
When checkout succeeds
Then both discounts apply

Given U1 attempts third coupon
Then rejected with COUPON_STACK_LIMIT
```

## AC-45 Campaign 预算耗尽（P5-6）

```gherkin
Given Campaign budgetRemaining is 0
When user claims coupon from campaign
Then rejected with CAMPAIGN_BUDGET_EXhaustED
```

## AC-46 商家券不作用于换电

```gherkin
Given MERCHANT coupon C1
When applied to battery PackageTemplate purchase
Then rejected with COUPON_SCOPE_MISMATCH
```

## AC-47 运营商券默认不作用于商城

```gherkin
Given OPERATOR coupon without mall scope
When applied to MallOrder
Then rejected with COUPON_SCOPE_MISMATCH
```
