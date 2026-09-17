# phase-2 → phase-3 契约 diff

| 类型 | 新增 |
| :--- | :--- |
| `Organization` | parentId · regionScope · capabilities |
| `RoleBinding` | userId × orgId × role |
| `PackageTemplate` | 版本化模板 + allowedOverrideFields |
| `PackageOverride` | 字段白名单 patches |
| `OrderProductSnapshot` | INV-12 下单快照 |
| `AuditLog` | publish/deprecate/override 审计 |
| 服务 | `OrgPermissionService` · `EffectiveProductResolver` |

**phase-0..2 均未修改。**
