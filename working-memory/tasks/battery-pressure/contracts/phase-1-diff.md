# phase-0 → phase-1 契约 diff

**原则**：`phase-0.ts` **不修改**；增量在 `phase-1.ts`。

| 类型 | 阶段 0 | 阶段 1 增量 |
| :--- | :--- | :--- |
| `PricingRule` | 仅 `FIXED_PRICE` | + `METERED { unit, rate }` |
| `EntitlementRule` | 仅 `TIME_WINDOW` | + `PAY_AS_YOU_GO` |
| `Product` | 固定规则字段 | `ProductPhase1` 用联合类型 |
| `Entitlement` | `validUntil` 必填 | + `remainingSwaps?` · `meteringMode?` · `validUntil?` |
| `UsageEvent` | 无计量 | + `meterReading?` · `chargedAmount?` |
| `LedgerEntry.refType` | PAYMENT / REFUND | + `METERED_CHARGE` |
| `LedgerEntry.refId` | OrderId | OrderId \| UsageEventId |
| `DomainErrorCode` | 8 个 | + `ENTITLEMENT_EXHAUSTED` |
| `SwapCommand` | entitlementId 必填 | `entitlementId?` + `EntitlementSelector` |

**兼容性**：阶段 0 的 P1 月卡即 `ProductPhase1` 中 FIXED_PRICE + TIME_WINDOW 的一个实例。
