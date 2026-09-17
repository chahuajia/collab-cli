# 阶段 5 暴露点：商城促销

**日期**：2026-09-17 ｜ **复杂点**：商家入驻 · 优惠券规则 · 履约分离

## 场景边界

| 在范围内 | 不在范围内 |
| :--- | :--- |
| MERCHANT capability 入驻 | 直播/社区（阶段 7+） |
| 商城 SKU 下单（实物/服务） | 换电履约路径 |
| 运营商/商家发券 | 信用/先用后付 |
| 满减券 · 折扣券 · 互斥组 | 积分获取规则细化（PointsLot） |
| 券核销写 Ledger 折扣分录 | 外部支付渠道 |

## 暴露点

| # | 检验什么 | 预期 KB |
| :-- | :--- | :--- |
| **P5-1** | 商家入驻复用 Organization + Onboarding | phase-3 组织模型 |
| **P5-2** | 商城订单 ≠ 换电 Order；独立 MallOrder | design-decision |
| **P5-3** | Coupon 规则引擎：scope · 门槛 · 互斥 | dependency-decision |
| **P5-4** | 运营商券 vs 商家券 scope 不交叉污染 | A3 主动侦查 |
| **P5-5** | 核销 append-only CouponRedemption | base-contract |
| **P5-6** | 活动 Campaign 绑定券批次 + 预算上限 | A10 规格先行 |

## 已裁决（tick 1）

| 项 | 裁决 |
| :--- | :--- |
| 互斥 | 同 `mutexGroup` 最多用 1 张 |
| 叠加 | 不同 mutexGroup 可叠；**满减+折扣**最多 2 张 |
| 预算 | Campaign.budgetRemaining 用尽则券不可领 |
| 履约 | MallOrder → MallFulfillment（物流/自提），不走 Entitlement |

## 成功标准

1. 商家入驻后可上架 SKU、发券
2. 用户用满30减5券买商城商品，Ledger 记录折扣
3. 互斥券不可同时使用
4. 规格完成，无运行时代码
