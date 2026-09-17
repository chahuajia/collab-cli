# 阶段 3 验收场景（A10 第 2 层）

## Fixture

| 实体 | 值 |
| :--- | :--- |
| L1 | org 华南，regionScope=["GD"] |
| L2 | org 深圳，parentId=L1，regionScope=["SZ"] |
| T1 | L1 模板：30天卡，price=30.00，allowedOverrideFields=[price, displayName] |
| U-SZ | 用户 region=SZ |

---

## AC-24 L1 发布模板

```gherkin
Given L1 ADMIN creates PackageTemplate T1 in draft
When publish is invoked
Then T1 status is published with version 1
  And AuditLog records publish action
```

## AC-25 published 不可原地改（P3-2）

```gherkin
Given T1 is published version 1
When L1 attempts to mutate baseProduct.durationDays in place
Then operation is rejected
  And L1 must create version 2 draft to change duration
```

## AC-26 L2 价格覆盖（P3-3 / INV-13）

```gherkin
Given T1 published at 30.00
  And L2 has no override
When U-SZ views catalog in SZ
Then EffectiveProduct price is 30.00

Given L2 activates override patches price 28.00
When U-SZ views catalog in SZ
Then EffectiveProduct price is 28.00
```

## AC-27 字段白名单拒绝（P3-4）

```gherkin
Given L2 enables T1
When L2 submits patch durationDays 60
Then rejected with FIELD_NOT_OVERRIDABLE
  And no PackageOverride activated
```

## AC-28 L2 不能改 L1 模板

```gherkin
Given T1 owned by L1
When L2 ADMIN attempts to publish or deprecate T1 directly
Then rejected with ORG_NOT_OWNER
```

## AC-29 下单 snapshot（INV-12）

```gherkin
Given U-SZ purchases at EffectiveProduct price 28.00
When L2 later changes override to 25.00
Then existing Order.productSnapshot still shows 28.00
  And paidAmount unchanged
```

## AC-30 祖先链授权（P3-1）

```gherkin
Given resource owned by L2
When L1 ADMIN manages that resource
Then allowed (L1 is ancestor)

Given resource owned by L1
When L2 ADMIN attempts manage
Then rejected unless resource is template enabled for override
```

## AC-31 Override 撤销审计

```gherkin
Given active L2 override
When L2 revokes override
Then AuditLog records override.revoke
  And U-SZ sees L1 template price again
```
