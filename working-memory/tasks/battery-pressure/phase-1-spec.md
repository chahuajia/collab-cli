# 阶段 1 规格：多 Product 规则组合

> 在 phase-0-spec 之上扩展。阶段 0 产物保持有效。

## 1. 核心原则（P1-1 三问）

| 问 | 答 |
| :-- | :--- |
| 没有组合抽象会怎样？ | 每种套餐写 OrderMonthly / OrderCount / OrderMetered 子类，加「混合计费」时类爆炸 |
| 收益？ | 新形态 = 新 PricingRule + EntitlementRule 组合，Order 流程不变 |
| 成本？ | 规则引擎分支 + swap 时选 entitlement 策略 |

## 2. 规则类型扩展

```text
PricingRule
  ├── FIXED_PRICE      { amount, currency }           // P1, P2
  └── METERED          { unit: SOC | DURATION, rate } // P3

EntitlementRule
  ├── TIME_WINDOW      { durationDays, swapLimit }    // P1, P2
  └── PAY_AS_YOU_GO    { maxConcurrent: 1 }           // P3，无 validUntil
```

```text
Product（示例）
  P1: FIXED_PRICE + TIME_WINDOW(30d, UNLIMITED)
  P2: FIXED_PRICE + TIME_WINDOW(90d, FINITE(10))
  P3: METERED(SOC)   + PAY_AS_YOU_GO
```

## 3. Entitlement 扩展

```text
Entitlement（阶段 1 增量字段）
  remainingSwaps?: number     // FINITE 时有值；UNLIMITED 无字段
  meteringMode?: PAY_AS_YOU_GO
```

生成规则：

| Product | Entitlement |
| :-- | :--- |
| P1 | validUntil=+30d, swapLimit=UNLIMITED |
| P2 | validUntil=+90d, remainingSwaps=10 |
| P3 | 无 validUntil；meteringMode=PAY_AS_YOU_GO；每次 swap 后结算 |

## 4. UsageEvent 扩展（P1-3）

```text
UsageEvent（增量）
  meterReading?: { socBefore: number; socAfter: number }
  chargedAmount?: MoneyCents   // P3 完成后写入
```

P3 流程：swap COMPLETED → 计算 `(socBefore - socAfter) × rate` → LedgerEntry(METERED_CHARGE)。

## 5. 多 Entitlement 选择策略（P1-4）

用户同时持有 P1 + P2 时，swap 需**显式**或**默认策略**：

| 策略 | 规则 |
| :-- | :--- |
| **默认（阶段 1）** | 优先扣 FINITE 次卡；无次卡或已用尽 → 用 UNLIMITED 套餐 |
| 显式 | API 传 `entitlementId`（阶段 0 已有） |

禁止隐式「随便扣一张」—— 必须可追溯。

## 6. 不变量增量

| ID | 不变量 |
| :-- | :--- |
| **INV-6** | FINITE Entitlement：COMPLETED UsageEvent 恰好使 remainingSwaps -= 1 |
| **INV-7** | remainingSwaps = 0 ⇒ 该 Entitlement 不可再产生 COMPLETED UsageEvent |
| **INV-8** | P3 的 LedgerEntry 在 UsageEvent COMPLETED 后生成，引用 usageEventId |

## 7. KB 路由

| 症状 | 条目 | 拦住 |
| :-- | :--- | :--- |
| 新结构 | design-decision | Order 子类 |
| 计量在边界 | parse-dont-validate | soc 解析在柜机适配层，领域只收 number |
| 多资源选择 | design-decision | 隐式 entitlement 选择 |

**gap 候选**：按电量争议（BMS 缺报）→ 阶段 7 再开 Spike
