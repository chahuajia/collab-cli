# 阶段 0 tick 2：类型契约报告

**日期**：2026-09-17 ｜ **A10 第 3 层** ｜ **运行时代码**：无

| 项 | 结果 |
| :-- | :--- |
| 契约文件 | `contracts/phase-0.ts` |
| 实体 | Product · Order · Entitlement · UsageEvent · BatteryAsset · Account · LedgerEntry |
| 端口 | PurchaseService · SwapService · RefundService |
| 错误码 | 8 个 DomainErrorCode，覆盖 AC-2/5/6/7/8 |
| INV-3 对齐 | UsageEvent `STARTED` = 进行中（规格正文已统一） |

**拦截 0** · **gap 0**

## 下一 tick 候选

1. 将 Q1–Q3 默认值写入 spec 为「已裁决」
2. 写 `phase-1.md` 暴露点（多 Product 抽象）
