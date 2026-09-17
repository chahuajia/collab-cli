# 阶段 7 规格：多厂商电池 IoT

> 扩展 phase-0 BatteryAsset · 支撑 phase-1 P3 按电量计量。

## 1. 适配器（P7-1 三问）

| 问 | 答 |
| :-- | :--- |
| 厂商协议进领域层会怎样？ | 换厂商 = 改 swap 逻辑；测试不可能 mock |
| 收益？ | 适配器边界解析 → 统一事件 |
| 成本？ | N 个适配器维护 + 注册表 |

```text
BatteryProviderAdapter（端口）
  vendorId: string
  discover(): ExternalDeviceRef[]
  parseTelemetry(raw: unknown): BatteryTelemetryReported | ParseError
  sendCommand(cmd: BatteryCommand): Promise<BatteryCommandAcked | CommandError>
  subscribe(callback): Unsubscribe

边界：raw unknown 只在适配器内；领域只收 typed event。
```

```text
AdapterRegistry
  register(adapter: BatteryProviderAdapter)
  get(vendorId): BatteryProviderAdapter
```

## 2. DeviceShadow（P7-2）

```text
DeviceShadow
  batteryId, vendorId, externalDeviceId
  soc, voltage, temperature, location?
  lockState: locked | unlocked
  status: idle | rented | maintenance   // 与 BatteryAsset 同步
  lastSeenAt, stale: boolean
  updatedAt

规则：
  - 业务层（swap、监控页）**只读 Shadow**
  - 遥测事件 → 更新 Shadow + 追加 TelemetryRecord
  - lastSeenAt 超过阈值 → stale=true
```

**INV-18**：领域服务禁止 import 厂商 SDK。

**INV-19**：stale=true 时禁止 P3 计量 swap（AC 链接 phase-1）。

## 3. 统一领域事件（P7-3）

```text
BatteryTelemetryReported
  batteryId, vendorId, soc, voltage, reportedAt

BatteryAlertRaised
  batteryId, alertType: OVERHEAT | LOW_SOC | COMM_LOST
  severity, raisedAt

BatteryCommandAcked
  commandId, batteryId, action: LOCK | UNLOCK | RESET
  success, ackedAt
```

```text
TelemetryRecord（时序，append-only）
  batteryId, soc, voltage, recordedAt
  // 存储实现待定；阶段 7 仅契约
```

## 4. 命令安全（P7-5）

```text
BatteryCommand
  commandId, batteryId, action, issuedBy, issuedAt

规则：
  - commandId 唯一；适配器侧 dedupe 24h
  - issuedBy 须通过 device 所属 org 权限校验
  - 失败 → BatteryCommandAcked success=false，不 silent retry
```

## 5. 告警 → 运维（P7-4）

```text
MaintenanceTicket（简化）
  id, batteryId, alertType, status: open | resolved
  createdAt

COMM_LOST 且 stale → 自动开 ticket
```

**W1 路由**：监控页 SOC 不更新 → 先查 shadow.stale / lastSeenAt，再查适配器连接。

## 6. 存储分离（P7-6）

| 数据 | 存储 | 原因 |
| :--- | :--- | :--- |
| BatteryAsset · Shadow 最新 | 关系库 | 事务与 swap 一致 |
| TelemetryRecord 历史 | 时序抽象 | 写多读少、按时间查 |

**dependency-decision 裁决**：阶段 7 **不引入** Influx/Timescale 依赖；用 `TelemetryStore` 端口抽象，实现后换。

## 7. KB 路由

| 症状 | 条目 | 拦住 |
| :-- | :--- | :--- |
| 领域 purity | domain-purity | SDK 进 swap |
| 边界解析 | parse-dont-validate | 领域处理 raw MQTT |
| 页面不更新 | W1 | 盲目重试厂商 API |
| 依赖 | dependency-decision | 过早绑定时序库 |

**gap 候选**：IoT 命令重放攻击 — 记 known-gaps 候选，阶段 7 仅 commandId dedupe。
