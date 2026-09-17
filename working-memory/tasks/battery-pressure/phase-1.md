# 阶段 1 暴露点：多 Product 抽象

**日期**：2026-09-17 ｜ **复杂点**：同一运营商三种计费形态共存，禁止 Order 子类

## 场景边界

| 在范围内 | 不在范围内 |
| :--- | :--- |
| 三种 Product 同目录售卖 | 多级运营商套餐继承 |
| 套餐 · 次卡 · 按电量 | 积分、混合支付 |
| 用户可同时持有多张有效 Entitlement | 优惠券、分润 |
| UsageEvent 扣减规则因 Product 而异 | BMS 多厂商适配 |

## 三种 Product（同 Org）

| ID | 名称 | PricingRule | EntitlementRule |
| :-- | :--- | :--- | :--- |
| P1 | 30天不限次 | FIXED_PRICE | TIME_WINDOW + UNLIMITED |
| P2 | 10次换电卡 | FIXED_PRICE | TIME_WINDOW + FINITE(10) |
| P3 | 按电量计费 | METERED { unit: SOC } | PAY_AS_YOU_GO（无预购窗口） |

## 暴露点

| # | 检验什么 | 预期 KB |
| :-- | :--- | :--- |
| **P1-1** | Product = 规则组合，非 Order 继承树 | design-decision |
| **P1-2** | 次卡：COMPLETED UsageEvent 扣 remaining | S13 聚合边界 |
| **P1-3** | 按电量：Pricing 依赖 UsageEvent 计量字段 | parse-dont-validate |
| **P1-4** | 多 Entitlement 并存时 swap 选哪张 | design-decision（显式策略） |
| **P1-5** | 套餐 UNLIMITED 与次卡 FINITE 验收分离 | A10 第 2 层 |
| **P1-6** | 契约扩展不破坏阶段 0 类型 | base-contract 类比 |

## 成功标准

1. 三 Product 共用 Order/Entitlement/UsageEvent，仅规则不同
2. P2 第 11 次换电被拒；P1 不受限
3. P3 单次 swap 产生 LedgerEntry（后付或预授权，本阶段选后付）
4. 规格 + 增量验收 + 契约 diff，无运行时代码
