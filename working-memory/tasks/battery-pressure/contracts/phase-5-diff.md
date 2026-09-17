# phase-4 → phase-5 契约 diff

| 类型 | 新增 |
| :--- | :--- |
| `OnboardingApplication` | 共享入驻框架 |
| `MerchantProfile` | MERCHANT capability |
| `MallSku` · `MallOrder` | 商城域独立订单 |
| `CouponTemplate` · `UserCoupon` · `CouponRedemption` | 促销 |
| `Campaign` | 预算控制 |
| 服务 | `CouponRuleEngine` · `MallCheckoutService` |

**INV-16**：MallOrder 不产生 Entitlement。

**phase-0..4 均未修改。**
