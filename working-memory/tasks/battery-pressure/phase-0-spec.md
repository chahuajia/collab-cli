# 阶段 0 规格：单运营商月卡换电

> Review 对象第 1 层（A10）。实现代码不在本阶段交付范围。

## 1. 上下文

单城市换电平台 MVP。一个运营商、一种商品（30 天不限次换电月卡）、用户用余额购买。
换电柜完成取还电后，系统记录履约并更新电池台账。

## 2. 核心不变量

| ID | 不变量 |
| :-- | :--- |
| **INV-1** | 任意时刻 LedgerEntry 集合借贷平衡（按 currency） |
| **INV-2** | Entitlement.active ⇒ 存在对应已支付 Order |
| **INV-3** | 同一 BatteryAsset 最多一个 active UsageEvent（status=STARTED） |
| **INV-4** | UsageEvent COMPLETED ⇒ 电池 status 回归 idle |
| **INV-5** | 已 REFUNDED 的 Order 其 Entitlement 不可再产生 COMPLETED UsageEvent |

## 3. 聚合与实体

### 3.1 Product（商品，阶段 0 仅一种）

```text
Product
  id
  orgId                    // 所属运营商
  name: "30天不限次换电卡"
  pricingRule: FIXED_PRICE { amount: Money, currency: CNY }
  entitlementRule: TIME_WINDOW { durationDays: 30, swapLimit: UNLIMITED }
  fulfillmentPolicy: BATTERY_SWAP
  status: draft | published | deprecated
```

### 3.2 Order（交易）

```text
Order
  id, userId, productId, orgId
  status: CREATED | PAID | REFUNDED | CANCELLED
  paidAmount: Money
  createdAt, paidAt?, refundedAt?

  // 状态机（领域层守卫）
  CREATED  --pay-->  PAID
  CREATED  --cancel--> CANCELLED
  PAID     --refund--> REFUNDED
```

**设计决策（三问）— Order 与 Entitlement 分离**

| 问 | 答 |
| :-- | :--- |
| 没有分离会怎样？ | 退款/过期/转让时要把「交易记录」和「可用权益」绑死，改 Order 状态会破坏审计 |
| 收益？ | 支付成功后生成 Entitlement；换电只读 Entitlement；退款只撤销 Entitlement |
| 成本？ | 多一张表/聚合，状态同步靠领域事件 |

### 3.3 Entitlement（权益）

```text
Entitlement
  id, orderId, userId, productId
  validFrom, validUntil
  swapLimit: UNLIMITED | FINITE(n)    // 阶段 0 固定 UNLIMITED
  status: ACTIVE | EXPIRED | REVOKED
```

生成规则：`Order` 进入 `PAID` ⇒ 创建 `Entitlement(validFrom=now, validUntil=now+30d, ACTIVE)`。

### 3.4 UsageEvent（履约 / 用量）

```text
UsageEvent
  id, userId, entitlementId, batteryId, cabinetId
  status: STARTED | COMPLETED | FAILED
  startedAt, completedAt?
```

不限次：`COMPLETED` 不减少 swapLimit，但**必须记录**（审计、电池轨迹）。

### 3.5 BatteryAsset（电池台账，阶段 0 简化）

```text
BatteryAsset
  id, orgId, vendor, model
  status: idle | rented | maintenance
  currentHolderId?   // userId，rented 时有值

  idle    --checkout--> rented   (UsageEvent STARTED)
  rented  --return-->   idle     (UsageEvent COMPLETED)
```

### 3.6 账本（复式记账）

```text
Account
  id, ownerType: USER | ORG | PLATFORM
  ownerId, type: BALANCE, currency

LedgerEntry（追加-only，不可改删）
  id, debitAccountId, creditAccountId
  amount, currency
  refType: ORDER_PAYMENT | ORDER_REFUND
  refId, createdAt
```

**支付**：`debit User.BALANCE, credit Org.SETTLEMENT`（或 Platform 过渡户，阶段 0 简化为 Org 户）。

**退款**：反向分录，引用同一 `refId=orderId`。

## 4. 主流程

### 4.1 购买

```text
1. User 发起 Purchase(productId)
2. 校验 Product.status = published
3. 校验 User.BALANCE >= price
4. 创建 Order(CREATED)
5. 写 LedgerEntry（支付）
6. Order → PAID；创建 Entitlement(ACTIVE)
```

### 4.2 换电

```text
1. User 在柜机发起 Swap(entitlementId, cabinetId)
2. 校验 Entitlement.status=ACTIVE 且 now ∈ [validFrom, validUntil]
3. 柜机分配 BatteryAsset（status=idle）
4. 创建 UsageEvent(STARTED)；Battery → rented
5. 用户完成取电 → UsageEvent → COMPLETED；Battery 保持 rented 直至还电
6. 用户还电 → 新 UsageEvent 或同一事件闭合；Battery → idle
```

阶段 0 简化：**一次 Swap = 一次 STARTED→COMPLETED**，不建模「借出未还」长周期（阶段 1 扩展）。

### 4.3 退款

```text
1. 校验 Order.status = PAID
2. Entitlement → REVOKED
3. 写 LedgerEntry（退款分录）
4. Order → REFUNDED
5. 若有 STARTED UsageEvent → 拒绝退款（Q1 已裁决）
```

## 5. 已裁决（长运行 tick 2 默认采纳）

| # | 问题 | 裁决 |
| :-- | :--- | :--- |
| Q1 | 有进行中换电时能否退款？ | **禁止**，错误码 `REFUND_BLOCKED_IN_PROGRESS_SWAP` |
| Q2 | Org.SETTLEMENT 户阶段 0 是否建模？ | **是**，AccountType.SETTLEMENT |
| Q3 | 月卡过期自动 EXPIRED 谁触发？ | 定时任务 + 换电时双重校验 |

## 6. KB 路由记录

| 症状 | 读了什么 | 拦住了什么 |
| :--- | :--- | :--- |
| 要设计新结构 | design-decision | 阻止「Order 子类 per 套餐类型」 |
| 不变量放哪层 | S13 · parse-dont-validate | 电池状态转换不进 anemic setter |
| 一批产出前 | A10 | 本文件先于代码 |
| 冻结基座类比 | base-contract | LedgerEntry 追加-only，类似生成物不可原地篡改 |

**known-gaps 候选**：复式记账在换电域无专条（复用 design-decision + 金融常识，暂不新建）。
