# phase-1 → phase-2 契约 diff

| 类型 | 阶段 1 | 阶段 2 增量 |
| :--- | :--- | :--- |
| `AccountType` | BALANCE · SETTLEMENT | + **POINTS** |
| `LedgerRefType` | + METERED_CHARGE | + PAYMENT/REFUND 按 **POINTS/BALANCE** 拆分 |
| `PurchaseCommand` | productId only | + **PaymentIntent** { usePoints, useBalance } |
| `UserWallet` | — | balance + points + pointsExpiresAt |
| `DomainErrorCode` | — | + INSUFFICIENT_POINTS · POINTS_EXPIRED · PAYMENT_INTENT_MISMATCH |
| 服务 | PurchaseService | + **MixedPaymentService** · PaymentIntentValidator |

**phase-0.ts / phase-1.ts 均未修改。**
