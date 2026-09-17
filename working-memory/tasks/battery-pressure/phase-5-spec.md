# 阶段 5 规格：商城与促销

> 商城域首阶段。复用 phase-3 Organization；交易走 MallOrder + phase-2 混合支付可选。

## 1. 商家入驻（P5-1）

```text
Organization
  capabilities: ["MERCHANT"] | ["OPERATOR"] | both

OnboardingApplication（与运营商入驻共享框架）
  id, orgId, capability: MERCHANT | OPERATOR
  status: submitted | approved | rejected
  submittedAt, reviewedAt?

MerchantProfile
  orgId, shopName, status: active | suspended
```

**规则**：MERCHANT 不可管理 PackageTemplate；OPERATOR 不可发 Mall SKU。

## 2. 商城商品（P5-2 三问）

| 问 | 答 |
| :-- | :--- |
| 与换电 Product 合并？ | 履约完全不同 —— 独立 MallSku，避免 Entitlement 语义污染 |
| 收益？ | 清晰边界；换电域零改动 |
| 成本？ | 多一套订单聚合 MallOrder |

```text
MallSku
  id, merchantOrgId, name, price: MoneyCents
  stock, status: on_sale | off_sale

MallOrder
  id, userId, merchantOrgId
  lines: [{ skuId, qty, unitPrice }]
  status: CREATED | PAID | SHIPPED | COMPLETED | REFUNDED
  paymentIntent?          // 复用 phase-2
  discountTotal?
  paidAmount
```

**INV-16**：MallOrder 不产生 Entitlement / UsageEvent。

## 3. 优惠券（P5-3 / P5-4）

```text
CouponTemplate
  id, issuerOrgId, issuerType: OPERATOR | MERCHANT
  kind: FIXED_OFF | PERCENT_OFF
  value, minSpend?
  scope: ALL_SKU | SKU_LIST | CATEGORY
  scopeIds?
  mutexGroup: string       // 同组互斥
  campaignId
  validFrom, validUntil
  totalBudget?, perUserLimit?

UserCoupon
  id, userId, templateId
  status: available | locked | used | expired
  lockedByOrderId?
```

```text
CouponRedemption（append-only, P5-5）
  id, userCouponId, orderId, discountAmount
  redeemedAt
```

**核销流程**：

```text
1. checkout 时传入 couponIds[]
2. 校验：mutexGroup 不重复 · 叠加 ≤2 · minSpend · scope · budget
3. lock UserCoupon → MallOrder PAID → used + Redemption
4. LedgerEntry ORDER_DISCOUNT（debit 营销预算户, credit 用户应付抵扣）
```

## 4. 活动 Campaign（P5-6）

```text
Campaign
  id, ownerOrgId
  name, budgetTotal, budgetRemaining
  status: draft | active | ended
  couponTemplateIds[]
```

领券：`budgetRemaining >= coupon face value` 才发放。

## 5. 运营商 vs 商家券

| 类型 | scope 默认 | 可用于 |
| :-- | :--- | :--- |
| OPERATOR 券 | 换电 Product 或全平台 | 由 scope 字段定 |
| MERCHANT 券 | 该 merchantOrgId SKU | 仅商城 |

**禁止**：MERCHANT 券作用于 PackageTemplate；OPERATOR 券默认不作用于 MallSku（除非 scope 显式包含）。

## 6. KB 路由

| 症状 | 条目 | 拦住 |
| :-- | :--- | :--- |
| 依赖/边界 | dependency-decision | 自研完整规则引擎 vs 轻量 spec |
| 聚合边界 | design-decision | MallOrder 复用 Order 表 |
| 规格先行 | A10 | 互斥/叠加先写清 |
| 不可变 | base-contract | 改 Redemption |

**决策（P5-3）**：阶段 5 **轻量内置规则**，不引入外部引擎；复杂度超 10 条互斥规则时再评估 dependency。

**gap 候选**：优惠券互斥组合 — 本 spec 承载。
