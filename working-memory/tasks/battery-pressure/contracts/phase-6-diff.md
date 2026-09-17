# phase-5 → phase-6 契约 diff

| 类型 | 新增 |
| :--- | :--- |
| `CreditProfile` | limit · usedCredit · status |
| `CreditLedgerDebt` | append-only 负债 |
| `BillingStatement` | 自然月账单 |
| `CreditPolicy` | 版本化额度 |
| Entitlement | + **FROZEN** 状态 |
| 服务 | CreditPurchase · Billing · Repayment |

**INV-17**：信用购无 BALANCE 支付分录。

**phase-0..5 均未修改。**
