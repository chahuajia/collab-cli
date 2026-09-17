# 阶段 2 规格：混合支付

> 扩展 phase-0/1 账本模型。Order/Entitlement 流程不变。

## 1. 双资产模型（P2-1 三问）

| 问 | 答 |
| :-- | :--- |
| 没有分离会怎样？ | 积分当余额扣，退款时无法区分营销负债与货币负债，财务对账失败 |
| 收益？ | 积分可设有效期、不可提现；余额可退款到原支付渠道 |
| 成本？ | 每次支付/退款至少查两个 Account，LedgerEntry 变多 |

```text
Account.type
  ├── BALANCE    // 货币，可退款提现（合规允许时）
  ├── POINTS     // 营销积分，不可提现，可过期
  └── SETTLEMENT // Org 户（阶段 0 已有）
```

用户持有：`User.balanceAccount` + `User.pointsAccount`（各一，按 currency/points 单位）。

**积分单位**：1 积分 = 1 分（MoneyCents 同精度），但 **refType 区分**，不可混账。

## 2. 支付命令扩展

```text
PurchaseCommand（增量）
  userId, productId
  paymentIntent:
    ├── usePoints: MoneyCents      // 期望使用的积分数
    └── useBalance: MoneyCents     // 期望使用的余额数
  // 约束：usePoints + useBalance === product.price
```

校验顺序：

1. `pointsAvailable >= usePoints` 且未过期
2. `balanceAvailable >= useBalance`
3. 不满足 → `INSUFFICIENT_POINTS` 或 `INSUFFICIENT_BALANCE`（**不**自动改单）

## 3. 扣减顺序（P2-2）

```text
pay(order):
  1. LedgerEntry(debit User.POINTS,  credit Org.SETTLEMENT, ref=ORDER_POINTS)
  2. LedgerEntry(debit User.BALANCE, credit Org.SETTLEMENT, ref=ORDER_BALANCE)
```

同一 `orderId`，不同 `refType`：`ORDER_PAYMENT_POINTS` | `ORDER_PAYMENT_BALANCE`。

## 4. 退款拆账（P2-3 / P2-4）

```text
refund(order):
  1. 查 orderId 下全部 PAYMENT 分录
  2. 先写 BALANCE 反向分录（ORDER_REFUND_BALANCE）
  3. 再写 POINTS 反向分录（ORDER_REFUND_POINTS）
  4. Entitlement → REVOKED（同阶段 0）
```

**INV-9**：退款分录金额与支付分录逐类型相等。

**INV-10**：积分退款仅还原未过期部分；已过期积分不退（阶段 2 简化：支付时已校验有效期，退款全还原）。

## 5. 积分有效期（P2-6）

```text
PointsLot（可选建模，阶段 2 简化）
  userId, amount, expiresAt

支付时 FIFO 消耗最早过期 lot。
```

阶段 2 简化：**用户级 pointsAccount 余额 + expiresAt 字段**（最近一批积分过期日），不做 lot 明细。阶段 5 商城促销再细化。

## 6. 不变量增量

| ID | 不变量 |
| :-- | :--- |
| **INV-9** | refund 分录按类型与 payment 分录金额相等 |
| **INV-10** | POINTS 与 BALANCE 的 LedgerEntry refType 永不混用 |
| **INV-11** | 混合支付 Order 的 paidAmount = sum(payment entries) |

## 7. KB 路由

| 症状 | 条目 | 拦住 |
| :-- | :--- | :--- |
| 双资产设计 | design-decision | 积分当余额字段加减 |
| 规格先行 | A10 | 扣减顺序先写清再契约 |
| 上下文预算 | A16 | PointsLot 明细延后到阶段 5 |

**gap 候选**：混合支付退款顺序无专条 — 本阶段写入 spec，暂不建 KB 条目。
