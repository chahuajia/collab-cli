# 阶段 3 暴露点：多级运营商 + 套餐继承

**日期**：2026-09-17 ｜ **复杂点**：组织树 · 模板发布 · 字段白名单覆盖 · 审计

## 场景边界

| 在范围内 | 不在范围内 |
| :--- | :--- |
| L1 发布套餐模板，L2 启用并改价 | 分润结算（阶段 4） |
| 组织树 parentId + regionScope | 商家 MERCHANT capability |
| 权限 = 祖先链 + 资源范围 + 字段白名单 | 运营商入驻申请流程 UI |
| 覆盖生成新版本，不可原地改 published | 推广补贴 |

## 组织示例

```text
PLATFORM
  └── L1-华南 (region=GD)
        └── L2-深圳 (region=SZ)
```

## 暴露点

| # | 检验什么 | 预期 KB |
| :-- | :--- | :--- |
| **P3-1** | 权限不用 level 数字，用组织树 + scope | design-decision · A3 |
| **P3-2** | PackageTemplate 由 ownerOrg 发布，版本化 | base-contract 类比 |
| **P3-3** | L2 仅能在 allowedFields 内 PackageOverride | A10 规格先行 |
| **P3-4** | L2 不能改 L1 模板；只能启用+覆盖 | 主动侦查 if-else 陷阱 |
| **P3-5** | 用户下单绑定 effective Product（L2 价） | 交易域不回溯改模板 |
| **P3-6** | 变更写 AuditLog | reproducible-verification |

## 已裁决（tick 1）

| 项 | 裁决 |
| :--- | :--- |
| L2 可覆盖字段 | **price** · **displayName**（不可改 durationDays / swapLimit） |
| 模板状态 | draft → published → deprecated；published **不可原地改** |
| 生效链 | 用户可见 Product = Template + 最近 Override（同 org 链） |

## 成功标准

1. L1 发布模板 30 天卡；L2 覆盖价为 28 元；SZ 用户看到 28 元
2. L2 尝试改 durationDays → 拒绝
3. 规格 + 无运行时代码
