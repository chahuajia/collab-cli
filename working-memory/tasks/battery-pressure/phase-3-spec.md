# 阶段 3 规格：多级运营商套餐继承

> 运营域首阶段。交易/账本/权益流程同 phase 0–2。

## 1. Organization（统一模型落地）

```text
Organization
  id, name, parentId?
  capabilities: ["OPERATOR"]
  regionScope: string[]      // 如 ["GD"] / ["SZ"]
  status: pending | active | suspended

RoleBinding
  userId, orgId, role: ADMIN | OPERATOR_STAFF
  // 权限校验入口，非 level 数字
```

**权限判定（P3-1）**：

```text
canManage(orgId, resource):
  resource.ownerOrgId == orgId
  OR resource.ownerOrgId 是 orgId 的祖先
  AND resource.region ⊆ org.regionScope（若适用）
```

禁止：`if (org.level <= 2)` —— level 仅作展示，**不作授权依据**。

## 2. PackageTemplate（P3-2）

```text
PackageTemplate
  id, ownerOrgId, version
  baseProduct: ProductPhase1   // 引用 phase-1 规则组合
  status: draft | published | deprecated
  inheritedFrom?: templateId    // L2 启用 L1 模板时填写
  publishedAt?

状态机：
  draft --publish--> published
  published --deprecate--> deprecated
  published 内容不可 mutate → 新版本 version+1
```

## 3. PackageOverride（P3-3 / P3-4）

```text
PackageOverride
  id, orgId, templateId, templateVersion
  allowedFields: readonly ("price" | "displayName")[]
  patches: { price?: MoneyCents; displayName?: string }
  effectiveFrom, effectiveUntil?
  status: draft | active | revoked

规则：
  - orgId 必须是 template.ownerOrg 的**后代**
  - patches 的 key ⊆ allowedFields（模板级配置，L1 发布模板时声明）
  - 激活 Override 不修改 Template；生成 **EffectiveProduct** 视图
```

```text
EffectiveProduct（只读视图，非持久化聚合根）
  resolve(template, override?) → ProductPhase1
  // 用户下单时 snapshot 到 Order.productSnapshot
```

**INV-12**：Order 保存 productSnapshot；事后 Template 变更不影响已售订单。

**INV-13**：L2 无 Override 时，继承 L1 published 模板原价。

## 4. 主流程

### 4.1 L1 发布模板

```text
1. L1 ADMIN 创建 PackageTemplate(draft)
2. publish → status=published, version=1
3. L2 可见「可启用模板列表」
```

### 4.2 L2 覆盖价格

```text
1. L2 ADMIN enableTemplate(templateId)
2. 创建 PackageOverride(patches: { price: 2800 }, allowedFields 来自模板)
3. activate → SZ region 用户看到 EffectiveProduct.price=28.00
```

### 4.3 越权拒绝

```text
L2 提交 patches: { durationDays: 60 }
→ REJECT FIELD_NOT_OVERRIDABLE
```

## 5. AuditLog（P3-6）

```text
AuditLog
  id, actorUserId, orgId, action, resourceType, resourceId
  before?, after?, createdAt

必记：publish · override.activate · override.revoke · deprecate
```

## 6. KB 路由

| 症状 | 条目 | 拦住 |
| :-- | :--- | :--- |
| 新结构 | design-decision | level 数字授权 |
| 主动侦查 | A3 | 「二级只能改自己的」硬编码 |
| 不可原地改 | base-contract | published 模板 mutate |
| 规格先行 | A10 | EffectiveProduct 先定义再契约 |

**gap 候选**：组织树权限无专条 — 本阶段 spec 承载，阶段 4 分润时再评估是否入库。
