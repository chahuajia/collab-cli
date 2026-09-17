# phase-3 → phase-4 契约 diff

| 类型 | 新增 |
| :--- | :--- |
| `ReferralBinding` | 推广关系 72h |
| `ProfitSharingRule` | splits + promoterBonus |
| `ProfitShareAccrual` | PENDING/SETTLED/REVERSED |
| `SettlementBatch` | T+7 批结算 |
| 服务 | `ProfitSharingEngine` · `SettlementBatchService` |
| Ledger refType | + `PROFIT_SHARING_SETTLEMENT`（见 spec） |

**phase-0..3 均未修改。**
