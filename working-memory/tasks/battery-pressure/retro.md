# battery-pressure 复盘（W4 三问）

**日期**：2026-09-17 ｜ **范围**：阶段 0–7 ｜ **方法**：COLLABORATION 选择性压测

## 做了什么

以换电平台 14 条业务需求为压力源，按七阶段演化路径产出：

- 7 × 暴露点（不可事后改）
- 7 × 规格 + 7 × 验收 + 7 × 契约 diff
- **61 条** Gherkin AC · **0 行**业务实现

## 三问

| 问 | 答 |
| :-- | :--- |
| 什么有效？ | KB 症状表路由（A10/design-decision/base-contract）稳定拦住 Order 子类、level 授权、积分当余额 |
| 什么无效/未测？ | 互动域（11/12）后置未压；gap 候选未入库 |
| 下次怎么改？ | 真实现时从 phase-0 垂直切片编码；gap ≥3 触发代谢配额 |

## 条目拦截摘要

| 条目 | 拦住 |
| :-- | :--- |
| A10 | 每层先规格后契约 |
| design-decision | Order/Entitlement 分离、Org 树、MallOrder 独立、信用子域 |
| base-contract | Ledger/Redemption/Accrual 追加-only |
| parse-dont-validate | IoT raw 在适配器 |
| W1 | stale 诊断路径 |
| A3 | level 数字、promoter 防刷 |
| A16 | PointsLot/时序库延后 |

## 产物索引

`contracts/phase-0.ts` … `phase-7.ts` · `phase-*-spec.md` · `phase-*-acceptance.md`
