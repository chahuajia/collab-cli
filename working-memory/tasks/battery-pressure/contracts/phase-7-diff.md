# phase-6 → phase-7 契约 diff

| 类型 | 新增 |
| :--- | :--- |
| `BatteryProviderAdapter` | 厂商协议隔离 |
| `DeviceShadow` | 业务只读模型 |
| 领域事件 | TelemetryReported · AlertRaised · CommandAcked |
| `TelemetryRecord` + `TelemetryStore` | 时序端口 |
| `MaintenanceTicket` | 告警工单 |
| 服务 | AdapterRegistry · DeviceShadowRepository |

**INV-18/19**：领域不 import SDK；stale 禁 P3 计量。

**phase-0..6 均未修改。**
