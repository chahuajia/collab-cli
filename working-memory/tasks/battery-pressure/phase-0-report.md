# 阶段 0 暴露报告

**日期**：2026-09-17 ｜ **产物**：规格 + 验收骨架 ｜ **业务代码**：无

| # | 结果 | 证据 |
| :-- | :--- | :--- |
| P0-1 | ✅ | `phase-0-spec.md` 先于任何实现 |
| P0-2 | ✅ | Order / Entitlement / UsageEvent 分离 + 三问表 |
| P0-3 | ✅ | LedgerEntry 追加-only |
| P0-4 | ✅ | BatteryAsset 状态机 + 聚合守卫描述 |
| P0-5 | ✅ | UNLIMITED 仍记 UsageEvent |
| P0-6 | ✅ | 退款 REVOKED + 反向分录 |
| P0-7 | ✅ | 9 条 Gherkin AC |

**拦截 0** · **gap 0 新增**（候选：换电域复式记账专条 — 暂不建，复用 design-decision）

## 待你 review（A10 第 1–2 层）

1. `phase-0-spec.md` — 聚合边界、状态机、开放问题 Q1–Q3
2. `phase-0-acceptance.md` — AC-1..9 是否覆盖你的业务直觉

## 下一步（review 通过后）

1. 补第 3 层：TypeScript 接口 / 伪类型文件（仍无实现）
2. 或进入阶段 1 暴露点（多 Product 抽象）
