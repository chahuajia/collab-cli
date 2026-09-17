# 阶段 0 暴露点：交易正确性垂直切片

**日期**：2026-09-17 ｜ **复杂点**：Order/Entitlement 分离 · 复式记账 · 换电核销 · 电池状态机

## 场景边界

| 在范围内 | 不在范围内 |
| :--- | :--- |
| 单城、单运营商 | 多级运营商、分润 |
| 一种 Product：30 天不限次月卡 | 按量、次卡、混合 Product |
| 仅余额支付 | 积分、信用、混合支付 |
| 换电一次完整履约 | 多厂商 BMS、遥测争议 |
| 电池 idle ↔ rented | 充电、维修、退役 |

## 暴露点

| # | 检验什么 | 预期 KB |
| :-- | :--- | :--- |
| **P0-1** | 规格先于任何实现（A10） | A10-review-前置原则 |
| **P0-2** | Order ≠ Entitlement ≠ UsageEvent 三问成立 | design-decision |
| **P0-3** | 余额变动走 LedgerEntry，禁止字段加减 | base-contract（不可变记录类比） |
| **P0-4** | 电池状态转换由聚合操作守卫 | S13 · parse-dont-validate |
| **P0-5** | 不限次月卡：换电产生 UsageEvent 但不扣次数 | Smart-Constructor 边界 |
| **P0-6** | 退款：权益撤销 + 账本反向分录 | design-decision |
| **P0-7** | 验收场景可执行表述（Given/When/Then） | A10 第 2 层 |

## 成功标准

1. 用户购买月卡 → 30 天内换电 N 次，账本借贷平衡
2. 同一电池不会同时 rented 给两人
3. 退款后 Entitlement 失效，不可再换电
4. 规格 + 验收表通过人工 review，**无业务代码**
