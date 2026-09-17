# 阶段 7 验收场景（A10 第 2 层）

## Fixture

| 实体 | 值 |
| :--- | :--- |
| VendorA | MQTT 适配器 |
| VendorB | HTTP 适配器 |
| Battery B1 | vendorA, shadow soc=80 |

---

## AC-55 适配器产出统一事件（P7-1 / P7-3）

```gherkin
Given VendorA sends raw MQTT payload
When adapter parseTelemetry runs
Then BatteryTelemetryReported with normalized soc/voltage

Given VendorB sends HTTP JSON
When adapter parseTelemetry runs
Then same event shape as VendorA
```

## AC-56 业务只读 Shadow（P7-2 / INV-18）

```gherkin
Given swap service needs battery soc
When swap is initiated
Then it reads DeviceShadow only
  And never calls vendor HTTP/MQTT directly
```

## AC-57 Shadow 更新

```gherkin
Given shadow soc 80
When BatteryTelemetryReported soc 75 arrives
Then shadow soc is 75
  And lastSeenAt refreshed
  And stale is false
  And TelemetryRecord appended
```

## AC-58 stale 禁止按电量计费（INV-19）

```gherkin
Given shadow stale true for B1
When U1 attempts P3 metered swap with B1
Then rejected with TELEMETRY_STALE
```

## AC-59 命令幂等（P7-5）

```gherkin
Given commandId X sent twice within 24h
When adapter processes duplicate
Then only one physical command sent
  And both return same BatteryCommandAcked
```

## AC-60 通信丢失告警（P7-4）

```gherkin
Given lastSeenAt older than 5 minutes
When stale checker runs
Then shadow stale true
  And BatteryAlertRaised COMM_LOST
  And MaintenanceTicket opened
```

## AC-61 W1 诊断路径

```gherkin
Given monitoring page shows outdated soc
When operator triages
Then first check shadow.stale and lastSeenAt
  And only then adapter connectivity
```
